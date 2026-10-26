import type { Base, Position } from '@sandlot/engine';
import type { Mention, ParseResult, Spoken, Target } from './types.ts';

// The parser model's side of voice-parse: the JSON schema it must answer in, the instructions, and the strict check that
// turns its answer into the same ParseResult the local grammar returns. The model proposes; `route` and the engine decide.

const positions = ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'] as const;
const kinds = ['pitch', 'strikeout', 'walk', 'hit', 'out', 'error', 'reached', 'steal', 'caught_stealing', 'pickoff', 'advance', 'moves', 'scores', 'undo'] as const;
const pitchResults = ['ball', 'strike', 'called_strike', 'swinging_strike', 'foul', 'foul_tip', 'hit_by_pitch'] as const;
const trajectories = ['ground', 'fly', 'line', 'popup'] as const;
const targets = ['1', '2', '3', 'home'] as const;

const nullable = (schema: object) => ({ anyOf: [schema, { type: 'null' }] });
const oneOf = (values: readonly string[]) => ({ type: 'string', enum: [...values] });

const whoSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['name', 'number', 'base'],
  properties: {
    name: nullable({ type: 'string', description: 'The name as heard, like "Ramirez". Null for "the runner", "he" or no name.' }),
    number: nullable({ type: 'string', description: 'A jersey number, as digits.' }),
    base: nullable(oneOf(['1', '2', '3'])),
  },
};

/** The Structured Outputs schema for the parser model's answer. Every field is required, with null for "not said". */
export const parserSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['result', 'plays'],
  properties: {
    result: oneOf(['plays', 'not_a_command', 'question', 'unclear']),
    plays: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['kind', 'words', 'pitch', 'looking', 'bases', 'trajectory', 'fielder', 'event', 'to', 'who'],
        properties: {
          kind: oneOf(kinds),
          words: { type: 'string', description: 'The words of the transcript this play came from.' },
          pitch: nullable(oneOf(pitchResults)),
          looking: nullable({ type: 'boolean' }),
          bases: nullable({ type: 'integer', enum: [1, 2, 3, 4] }),
          trajectory: nullable(oneOf(trajectories)),
          fielder: nullable(oneOf(positions)),
          event: nullable(oneOf(['wild_pitch', 'passed_ball'])),
          to: nullable(oneOf(targets)),
          who: nullable(whoSchema),
        },
      },
    },
  },
} as const;

/** What the model knows about the game: who might be named. Never stored or logged. */
export type ParserContext = { batting: string[]; fielding: string[]; runners: string[] };

export function parserInstructions(context: ParserContext): string {
  return [
    'You turn what a youth baseball scorekeeper said into plays. You never decide what is legal, and you never guess.',
    'Answer "unclear" when the words could mean more than one play, or name an outcome you are not sure of.',
    'Answer "not_a_command" for crowd noise or talk that is not a play, and "question" for a question.',
    'Kinds: pitch (ball, strike, called_strike, swinging_strike, foul, foul_tip, hit_by_pitch; use "strike" when looking or swinging was not said),',
    'strikeout (looking true/false, or null if not said), walk, hit (bases 1-4, fielder = where it went), out (trajectory, fielder),',
    'error (fielder), reached ("safe at first" with no hit or error said), steal (to), caught_stealing (to = the base the runner tried for),',
    'pickoff (to = the base the runner was on), advance (event wild_pitch or passed_ball, to), moves (a runner going to a base on the play just named),',
    'scores (a runner scoring on the play just named), undo ("scratch that", "undo").',
    'Fielders: P C 1B 2B 3B SS LF CF RF; "left" is LF, "short" is SS. Bases: "1", "2", "3", "home".',
    'Put the name exactly as heard in who.name. Use null for "he", "the runner" or no name. Never replace a name with one from the lists.',
    'If the speaker corrects themself ("single, no, a double"), give only the final intent.',
    `Batting team: ${context.batting.join(', ') || 'unknown'}. Fielding team: ${context.fielding.join(', ') || 'unknown'}.`,
    `Runners on base: ${context.runners.join(', ') || 'none'}.`,
  ].join('\n');
}

const isOneOf = <T extends string>(values: readonly T[], value: unknown): value is T => typeof value === 'string' && (values as readonly string[]).includes(value);
const base = (value: unknown): Base | undefined => value === '1' ? 1 : value === '2' ? 2 : value === '3' ? 3 : undefined;
const target = (value: unknown): Target | undefined => value === 'home' ? 'home' : base(value);
const position = (value: unknown): Position | undefined => isOneOf(positions, value) ? value : undefined;

/** A field the model may leave null. Present but unreadable is `bad`, which rejects the whole answer rather than dropping the field. */
const bad = Symbol('bad');
function optional<T>(value: unknown, read: (value: unknown) => T | undefined): T | undefined | typeof bad {
  if (value === null || value === undefined) return undefined;
  return read(value) ?? bad;
}

function mention(value: unknown): Mention | undefined | null {
  if (value === null || value === undefined) return undefined;
  if (typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  const name = optional(raw.name, (text) => typeof text === 'string' ? text.trim().toLowerCase() : undefined);
  const number = optional(raw.number, (text) => typeof text === 'string' && /^\d{1,2}$/.test(text) ? text : undefined);
  const on = optional(raw.base, base);
  if (name === bad || number === bad || on === bad) return null;
  const who: Mention = {};
  if (name) who.name = name;
  if (number) who.number = number;
  if (on) who.base = on;
  return Object.keys(who).length ? who : undefined;
}

/** One play from the model's answer, or null when anything in it is off. */
function play(raw: unknown): Spoken | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Record<string, unknown>;
  const who = mention(value.who);
  const fielder = optional(value.fielder, position);
  const to = value.kind === 'pickoff' ? optional(value.to, base) : optional(value.to, target);
  if (who === null || fielder === bad || to === bad) return null;
  const at = fielder ? { fielder } : {};
  const person = (key: 'batter' | 'runner') => who ? { [key]: who } : {};
  switch (value.kind) {
    case 'pitch': return isOneOf(pitchResults, value.pitch) ? { kind: 'pitch', result: value.pitch, ...person('batter') } : null;
    case 'strikeout': {
      const looking = optional(value.looking, (flag) => typeof flag === 'boolean' ? flag : undefined);
      if (looking === bad) return null;
      return { kind: 'strikeout', ...(looking === undefined ? {} : { looking }), ...person('batter') };
    }
    case 'walk': return { kind: 'walk', ...person('batter') };
    case 'hit': return value.bases === 1 || value.bases === 2 || value.bases === 3 || value.bases === 4 ? { kind: 'hit', bases: value.bases, ...at, ...person('batter') } : null;
    case 'out': return isOneOf(trajectories, value.trajectory) ? { kind: 'out', trajectory: value.trajectory, ...at, ...person('batter') } : null;
    case 'error': return { kind: 'error', ...at, ...person('batter') };
    case 'reached': return { kind: 'reached', ...at, ...person('batter') };
    case 'steal': return { kind: 'steal', ...(to ? { to } : {}), ...person('runner') };
    case 'caught_stealing': return { kind: 'caught_stealing', ...(to ? { at: to } : {}), ...person('runner') };
    case 'pickoff': return { kind: 'pickoff', ...(to && to !== 'home' ? { at: to } : {}), ...person('runner') };
    case 'advance':
      if (value.event !== 'wild_pitch' && value.event !== 'passed_ball') return null;
      return { kind: 'advance', event: value.event, ...(to ? { to } : {}), ...person('runner') };
    case 'moves': return to ? { kind: 'moves', to, ...person('runner') } : null;
    case 'scores': return { kind: 'scores', ...person('runner') };
    case 'undo': return { kind: 'undo' };
    default: return null;
  }
}

/** Checks the model's answer strictly. Anything malformed or empty is `unclear`, so a bad answer can never save a play. */
export function fromModel(answer: unknown): ParseResult {
  if (!answer || typeof answer !== 'object') return { kind: 'unclear' };
  const { result, plays } = answer as Record<string, unknown>;
  if (result === 'not_a_command') return { kind: 'not_a_command', question: false };
  if (result === 'question') return { kind: 'not_a_command', question: true };
  if (result !== 'plays' || !Array.isArray(plays) || !plays.length || plays.length > 8) return { kind: 'unclear' };
  const read = plays.map(play);
  if (read.some((spoken) => spoken === null)) return { kind: 'unclear' };
  const parts = plays.map((raw) => {
    const words = (raw as Record<string, unknown>).words;
    return typeof words === 'string' ? words.slice(0, 200) : '';
  });
  return { kind: 'plays', plays: read as Spoken[], parts, model: true };
}
