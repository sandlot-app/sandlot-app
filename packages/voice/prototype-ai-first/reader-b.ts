// PROTOTYPE, THROWAWAY. Reader B, "AI-first": no phrase patterns. One model call per press sees the whole game state and
// returns the whole play's result by role and base (never by name). We map the answer to engine Commands and let the
// engine's applyGroup decide. An illegal answer is "rejected" and is never saved.

import { applyGroup } from '@sandlot/engine';
import type { Advance, Base, Command, Destination, GameState, Position, Trajectory } from '@sandlot/engine';
import { readBack, type PressGame } from '../src/index.ts';
import { entryFor, samePlayer } from '../src/players.ts';
import { passesRunner } from '../src/resolve.ts';
import { append, endState, stateOf } from './game.ts';
import type { OpenAi } from './openai.ts';
import type { Ideal, Prepared, Outcome } from './types.ts';

export type Read = Pick<Outcome, 'did' | 'end' | 'note' | 'cardRight'>;

// ---------------------------------------------------------------- the answer's schema

const positions = ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'] as const;
const pitchResults = ['ball', 'called_strike', 'swinging_strike', 'foul', 'foul_tip', 'hit_by_pitch'] as const;
// The engine's BallInPlayOutcome, all twelve.
const outcomes = ['single', 'double', 'ground_rule_double', 'triple', 'home_run', 'out', 'error', 'fielders_choice', 'sacrifice_fly', 'sacrifice_bunt', 'double_play', 'triple_play'] as const;
const trajectories = ['ground', 'line', 'fly', 'popup', 'bunt'] as const;
const results = ['play', 'not_a_play', 'question', 'unclear'] as const;
const destinations = ['1', '2', '3', 'home', 'out'] as const;
const bases = ['1', '2', '3'] as const;
const runnerEvents = ['stolen_base', 'caught_stealing', 'pickoff', 'wild_pitch', 'passed_ball', 'advance_on_error'] as const;

const oneOf = (values: readonly string[], description?: string) => ({ type: 'string', enum: [...values], ...(description ? { description } : {}) });
const nullable = (schema: object) => ({ anyOf: [schema, { type: 'null' }] });
const object = (properties: Record<string, object>, description?: string) => ({
  type: 'object', additionalProperties: false, required: Object.keys(properties), properties, ...(description ? { description } : {}),
});

/** Strict Structured Outputs schema: every field required, null for "not said", no extra fields. */
export const answerSchema = object({
  result: oneOf(results, 'play: the words say what happened. not_a_play: cheering, chatter, a question from the scorer. question: two readings are both believable and nothing said picks one. unclear: you cannot tell what happened.'),
  pitches: { type: 'array', items: oneOf(pitchResults), description: 'Pitches thrown before any ball in play, in order. Do not list the pitch that was hit.' },
  ball_in_play: nullable(object({
    outcome: oneOf(outcomes),
    trajectory: nullable(oneOf(trajectories)),
    fielders: { type: 'array', items: oneOf(positions), description: 'Positions that handled the ball, in order. Empty if not said.' },
    batter_to: oneOf(destinations, 'Where the batter ended up.'),
    runners: {
      type: 'array',
      description: 'Where each runner who was on base before the play ended up, by the base they started on.',
      items: object({ from: oneOf(bases), to: oneOf(destinations) }),
    },
  }, 'Set when the batter put the ball in play. Null otherwise.')),
  runner_events: {
    type: 'array',
    description: 'Things runners did between pitches, by the base they were on. Use "out" as the destination for caught_stealing and pickoff.',
    items: object({ event: oneOf(runnerEvents), from: oneOf(bases), to: oneOf(destinations) }),
  },
  fix_last: { type: 'boolean', description: 'True only when the scorer is correcting the last saved play.' },
  unsure: { type: 'array', items: { type: 'string' }, description: 'Short notes on anything you could not settle. Never names.' },
});

export type Answer = {
  result: typeof results[number];
  pitches: string[];
  ball_in_play: { outcome: string; trajectory: string | null; fielders: string[]; batter_to: string; runners: { from: string; to: string }[] } | null;
  runner_events: { event: string; from: string; to: string }[];
  fix_last: boolean;
  unsure: string[];
};

const isIn = (values: readonly string[], value: unknown) => typeof value === 'string' && values.includes(value);
const listOf = (values: readonly string[], value: unknown) => Array.isArray(value) && value.every((item) => isIn(values, item));

/** A strict check of the model's answer. Null means malformed, which counts as a failure, never a play. */
export function parseAnswer(raw: unknown): Answer | null {
  if (!raw || typeof raw !== 'object') return null;
  const a = raw as Record<string, any>;
  if (!isIn(results, a.result) || !listOf(pitchResults, a.pitches) || typeof a.fix_last !== 'boolean') return null;
  if (!Array.isArray(a.unsure) || a.unsure.some((item: unknown) => typeof item !== 'string')) return null;
  if (!Array.isArray(a.runner_events) || a.runner_events.some((e: any) => !isIn(runnerEvents, e?.event) || !isIn(bases, e?.from) || !isIn(destinations, e?.to))) return null;
  const bip = a.ball_in_play;
  if (bip !== null) {
    if (!bip || typeof bip !== 'object' || !isIn(outcomes, bip.outcome) || !(bip.trajectory === null || isIn(trajectories, bip.trajectory))) return null;
    if (!listOf(positions, bip.fielders) || !isIn(destinations, bip.batter_to)) return null;
    if (!Array.isArray(bip.runners) || bip.runners.some((r: any) => !isIn(bases, r?.from) || !isIn(destinations, r?.to))) return null;
  }
  return a as Answer;
}

/** The short form in cases.jsonl, expanded to the full answer. */
export function expandIdeal(ideal: Ideal): Answer {
  const move = (text: string) => { const [from, to] = text.split('>'); return { from: from!, to: to! }; };
  return {
    result: ideal.result ?? 'play',
    pitches: ideal.p ?? [],
    ball_in_play: ideal.bip ? {
      outcome: ideal.bip.o, trajectory: ideal.bip.t ?? null, fielders: ideal.bip.f ?? [], batter_to: ideal.bip.b, runners: (ideal.bip.r ?? []).map(move),
    } : null,
    runner_events: (ideal.ev ?? []).map((text) => { const [event, rest] = text.split(':'); return { event: event!, ...move(rest!) }; }),
    fix_last: ideal.fix ?? false,
    unsure: [],
  };
}

// ---------------------------------------------------------------- instructions and the game as text

export const instructions = [
  'You are an experienced youth-baseball scorekeeper who watched the whole play. A parent keeping the book said out loud what just happened. The words came from speech-to-text, so expect filler, cheering, restarts, mis-hearings and run-on sentences.',
  'Return the whole result of that one press as JSON. The game state below is the state BEFORE the press. Describe players by role and base only, never by name: "the batter", and each runner by the base they were on before the press ("1", "2", "3").',
  '',
  'Fields:',
  '- result: "play" when the words say what happened. "not_a_play" for cheering, chatter, a question the scorer asked, or anything that is not a play. "question" when two readings are both believable and nothing said picks one (say what you could not settle in unsure). "unclear" when you cannot tell what happened.',
  '- pitches: balls and strikes thrown before any ball in play, in order (ball, called_strike, swinging_strike, foul, foul_tip, hit_by_pitch). Do not list the pitch that was hit. A strike with no detail is called_strike. A fourth ball, a third strike or a hit by pitch ends the at-bat by itself: just list that pitch.',
  '- ball_in_play: null unless the batter put the ball in play. Otherwise: the outcome; the trajectory (null if not said); the fielders who handled it, as positions; batter_to (where the batter ended up: "1", "2", "3", "home" or "out"); and runners: where EVERY runner who was on base before the play ended up ("1", "2", "3", "home" or "out"), keyed by the base they started on. A runner who stays put is {from: "3", to: "3"}.',
  '- runner_events: steals, caught stealing, pickoffs, wild pitches, passed balls and advances on an error, keyed by the base the runner was on.',
  '- fix_last: true only when the scorer is correcting the last saved play ("no, that was a double"). Then give the whole corrected play, as if the last saved play had never happened: its batter is the batter of that play, and runner bases are the bases they were on before it (that earlier state is shown with the last saved play).',
  '- unsure: short notes on anything you could not settle, never names. [] if nothing.',
  '',
  'Rules:',
  '1. Understand the whole play like a scorekeeper who watched it, then fill in what was not said with the usual outcome. On a double or triple every runner scores. On a home run everyone scores, the batter too. On a single, a walk or a hit by pitch, runners move only as far as they are forced. On an out or an error, runners hold unless the words say otherwise. When the words say where a runner went, believe them.',
  '2. "All runners", "all base runners", "both runners", "the runners", "everybody" and "everyone" name every runner on base. "Head home", "head to home", "come home", "come in", "cross" and "score" mean scoring.',
  '3. A call about the batter that repeats what his own hit already did ("Moss stays at third" after his triple) is not a second event.',
  '4. If the speaker corrects themselves mid-sentence ("single, no, a double"), only the final version counts.',
  '5. Ignore cheering, filler and chatter around the play.',
  '6. Ask (result "question") only when two readings are both believable and nothing said picks one. If one reading is the usual one, take it and note your assumption in unsure.',
  '7. "He", "she", "they" and "the kid" mean whoever the sentence is about: the batter, or the one runner who could have done that. If two runners could have, that is a question.',
  '8. Team slang: "rips one to the gap" is an extra-base hit (a double unless a triple is said); "bloop", "dunk" and "duck snort" are soft singles; "dribbler", "tapper" and "chopper" are weak ground balls; "moonshot" and "went yard" are home runs; "punched out" and "rung up" are strikeouts.',
].join('\n');

const team = { home: 'Hawks', away: 'Marlins' } as const;
const ordinal = (n: number) => n === 1 ? '1st' : n === 2 ? '2nd' : n === 3 ? '3rd' : `${n}th`;

const label = (game: PressGame, player: Parameters<typeof entryFor>[1]) => {
  const entry = entryFor(game.roster, player);
  return entry ? `${entry.name} #${entry.number}` : 'unknown player';
};

/** Outs, count and runners in plain words. */
export function situationWords(game: PressGame, state: GameState): string {
  const runners = ([1, 2, 3] as const).flatMap((base) => {
    const player = state.bases[base]?.player;
    return player ? [`${ordinal(base)}: ${label(game, player)}`] : [];
  });
  return `${state.outs} ${state.outs === 1 ? 'out' : 'outs'}, count ${state.count.balls}-${state.count.strikes}, runners ${runners.join('; ') || 'none'}`;
}

/** The full game state as text, the last saved play in plain words, and the transcript. */
export function stateText(prep: Prepared): string {
  const { game } = prep;
  const state = stateOf(game);
  const batting = state.half === 'top' ? 'away' : 'home';
  const fielding = batting === 'away' ? 'home' : 'away';
  const due = state.nextBatter[batting];
  const bases = ([1, 2, 3] as const).map((base) => {
    const runner = state.bases[base]?.player;
    return `${ordinal(base)}: ${runner ? label(game, runner) : 'empty'}`;
  });
  const slot = (side: 'home' | 'away') => state.lineups[side];
  return [
    'GAME STATE (before this press)',
    `Inning: ${state.half} of the ${ordinal(state.inning)}. Outs: ${state.outs}. Count: ${state.count.balls} balls, ${state.count.strikes} strikes.`,
    `Score: ${team.away} ${state.score.away}, ${team.home} ${state.score.home}.`,
    `Batting: ${team[batting]} (${batting}). Fielding: ${team[fielding]} (${fielding}).`,
    `Batter due up: ${label(game, slot(batting)[due]!.player)}.`,
    `Pitcher: ${label(game, state.pitchers[fielding]!)}.`,
    `Runners: ${bases.join('; ')}.`,
    `Fielders by position: ${slot(fielding).map((s) => `${s.position} ${label(game, s.player)}`).join('; ')}.`,
    `Batting lineup, in batting order: ${slot(batting).map((s, index) => `${index + 1}. ${label(game, s.player)} (${s.position})${index === due ? ' <- due up' : ''}`).join('; ')}.`,
    `Fielding lineup: ${slot(fielding).map((s) => `${label(game, s.player)} (${s.position})`).join('; ')}.`,
    prep.lastPlay
      ? `Last saved play: ${prep.lastPlay.words}. (Before that play: ${prep.lastPlay.before}.)`
      : 'Last saved play: none yet.',
    '',
    'TRANSCRIPT',
    `"${prep.transcript}"`,
  ].join('\n');
}

// ---------------------------------------------------------------- the answer as engine Commands

const batterDefault: Record<string, Destination | null> = {
  single: 1, double: 2, ground_rule_double: 2, triple: 3, home_run: 'home', out: 'out', sacrifice_fly: 'out', sacrifice_bunt: 'out',
  error: 1, fielders_choice: 1, double_play: null, triple_play: null,
};
const hits = ['single', 'double', 'ground_rule_double', 'triple', 'home_run'];
const to = (text: string): Exclude<Destination, 'out'> => text === 'home' ? 'home' : Number(text) as Base;

export type Mapped =
  | { ok: true; groups: Command[][]; before: GameState; after: GameState; words: string }
  | { ok: false; why: string };

const fail = (why: string): Mapped => ({ ok: false, why });

/**
 * The answer as groups of commands, and the state they lead to. Runners are looked up by the base they were on, the
 * batter is derived from the game, and the engine decides whether the whole thing is legal. A fix is two groups: an undo
 * of the last play, then the replacement (the engine's `correct` command is not implemented yet).
 */
export function toCommands(game: PressGame, answer: Answer): Mapped {
  const before = stateOf(game);
  let base = game;
  const groups: Command[][] = [];
  if (answer.fix_last) {
    const last = game.events.at(-1);
    if (!last || last.group === 'setup' || last.command.kind === 'undo') return fail('it fixes the last play, but there is none');
    const undo: Command = { kind: 'undo', target: last.group };
    try { base = append(game, 'fix-undo', [undo]); } catch { return fail('the last play cannot be undone'); }
    groups.push([undo]);
  }
  const state = stateOf(base);
  const runnerOn = (from: string) => state.bases[Number(from) as Base]?.player;
  const commands: Command[] = [];

  // Lead runner first, because the engine checks each runner's base as it moves them.
  const eventsSeen = new Set<string>();
  for (const event of [...answer.runner_events].sort((a, b) => Number(b.from) - Number(a.from))) {
    const runner = runnerOn(event.from);
    if (!runner) return fail(`no runner on ${ordinal(Number(event.from))} for the ${event.event}`);
    if (eventsSeen.has(event.from)) return fail(`two runner events for the runner on ${ordinal(Number(event.from))}`);
    eventsSeen.add(event.from);
    commands.push({ kind: 'runner', event: event.event as Extract<Command, { kind: 'runner' }>['event'], runner, to: event.to === 'out' ? 'out' : to(event.to) });
  }
  for (const pitch of answer.pitches) commands.push({ kind: 'pitch', result: pitch as Extract<Command, { kind: 'pitch' }>['result'] });

  const bip = answer.ball_in_play;
  if (bip) {
    let pre = state;
    if (commands.length) {
      const prefix = applyGroup(base.setup, base.events, commands);
      if (!prefix.ok) return fail(`the engine refused the pitches and runner events: ${prefix.code}`);
      pre = prefix.state;
    }
    const side = pre.half === 'top' ? 'away' : 'home';
    const batter = pre.lineups[side][pre.nextBatter[side]]!.player;
    const hit = hits.includes(bip.outcome);
    const defaultTo = batterDefault[bip.outcome]!;
    const baseNow = (player: Parameters<typeof samePlayer>[0]) => ([1, 2, 3] as const).find((b) => pre.bases[b] && samePlayer(pre.bases[b]!.player, player)) ?? 0;
    // A force play needs every base behind the runner full. The batter's out, when the engine derives it, comes first and ends all force plays.
    let forceThrough = 0;
    for (const b of [1, 2, 3] as const) { if (!pre.bases[b]) break; forceThrough = b; }
    if (defaultTo === 'out' && bip.batter_to === 'out') forceThrough = -1;
    const advances: Advance[] = [];
    const seen = new Set<string>();
    for (const move of [...bip.runners].sort((a, b) => Number(b.from) - Number(a.from))) {
      if (seen.has(move.from)) return fail(`two moves for the runner on ${ordinal(Number(move.from))}`);
      seen.add(move.from);
      const runner = runnerOn(move.from);
      if (!runner) return fail(`no runner on ${ordinal(Number(move.from))}`);
      if (move.to === 'out') {
        const from = baseNow(runner);
        const flies = bip.trajectory === 'fly' || bip.trajectory === 'line' || bip.trajectory === 'popup';
        advances.push({ runner, to: 'out', outType: !hit && !flies && from >= 1 && from <= forceThrough ? 'force' : 'non_force' });
        forceThrough = Math.min(forceThrough, from - 1);
      } else {
        advances.push({ runner, to: to(move.to) });
      }
    }
    // The batter is derived from the outcome. Only when the answer says something else does he get an advance of his own, last.
    if (bip.batter_to !== String(defaultTo)) {
      advances.push(bip.batter_to === 'out' ? { runner: batter, to: 'out', outType: 'batter_before_first' } : { runner: batter, to: to(bip.batter_to) });
    }
    commands.push(
      { kind: 'pitch', result: 'in_play' },
      { kind: 'ball_in_play', outcome: bip.outcome as Extract<Command, { kind: 'ball_in_play' }>['outcome'], trajectory: bip.trajectory as Trajectory | null, fielders: bip.fielders as Position[], advances },
    );
  }
  if (!commands.length) return fail('the answer holds no pitch, runner event or ball in play');
  const result = applyGroup(base.setup, base.events, commands);
  if (!result.ok) return fail(`the engine refused it: ${result.code}`);
  if (passesRunner(base, commands)) return fail('a runner would pass another runner');
  groups.push(commands);
  return { ok: true, groups, before, after: result.state, words: readBack(base, commands) };
}

// ---------------------------------------------------------------- the reader

/** The text the Responses API returned, or why there is none. */
function outputOf(response: unknown): { text: string } | { why: string } {
  const body = response as { status?: string; incomplete_details?: { reason?: string }; output?: { content?: { type?: string; text?: string }[] }[] } | null;
  if (!body) return { why: 'unreadable response' };
  if (body.status === 'incomplete') return { why: `incomplete (${body.incomplete_details?.reason ?? 'unknown'})` };
  for (const item of body.output ?? []) {
    for (const part of item.content ?? []) {
      if (part.type === 'refusal') return { why: 'the model refused' };
      if (part.type === 'output_text' && typeof part.text === 'string') return { text: part.text };
    }
  }
  return { why: 'no text in the response' };
}

const brief = (text: string) => text.length > 90 ? `${text.slice(0, 87)}...` : text;

export async function readerB(prep: Prepared, openai: OpenAi, model: string): Promise<Read> {
  let response: Response;
  try {
    response = await openai('/v1/responses', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model,
        instructions,
        input: stateText(prep),
        max_output_tokens: 2000,
        store: false,
        text: { format: { type: 'json_schema', name: 'ai_first_play', strict: true, schema: answerSchema } },
      }),
    });
  } catch {
    return { did: 'failed', note: 'no answer (network error or timeout)' };
  }
  if (!response.ok) return { did: 'failed', note: `HTTP ${response.status}` };
  const output = outputOf(await response.json().catch(() => null));
  if ('why' in output) return { did: 'failed', note: output.why };
  let answer: Answer | null;
  try { answer = parseAnswer(JSON.parse(output.text)); } catch { answer = null; }
  if (!answer) return { did: 'failed', note: 'the answer broke the schema' };
  const unsure = answer.unsure.length ? ` [unsure: ${brief(answer.unsure.join('; '))}]` : '';
  if (answer.result === 'not_a_play') return { did: 'no_play', note: `not a play${unsure}` };
  if (answer.result !== 'play') return { did: 'asked', note: `${answer.result}${unsure}` };
  const mapped = toCommands(prep.game, answer);
  if (!mapped.ok) return { did: 'rejected', note: mapped.why };
  return { did: 'saved', end: endState(prep.game, mapped.before, mapped.after), note: `${answer.fix_last ? 'FIX: ' : ''}${mapped.words}${unsure}` };
}
