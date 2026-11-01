import type { BallInPlayOutcome, PitchResult, Position, RunnerEvent, Trajectory } from '@sandlot/engine';

// The AI's answer to one press: the Structured Outputs schema it must answer in, its type, and the one strict reader
// that voice-parse runs on the model's reply and the phone runs again on the wire. The answer names players only by
// role and base, plus the words the scorer used for each one, so the phone can check names. It never decides
// anything: decide() and the engine do (rule 6). The model's free-text notes stop at this reader.

// One list per enum. The schema, the reader and the type all come from these, and `satisfies` breaks the build if
// the engine renames a value.
const results = ['play', 'question', 'not_a_play', 'unclear'] as const;
const pitchResults = ['ball', 'called_strike', 'swinging_strike', 'foul', 'foul_tip', 'hit_by_pitch'] as const satisfies readonly Exclude<PitchResult, 'in_play'>[];
const outcomes = ['single', 'double', 'ground_rule_double', 'triple', 'home_run', 'out', 'error', 'fielders_choice',
  'sacrifice_fly', 'sacrifice_bunt', 'double_play', 'triple_play'] as const satisfies readonly BallInPlayOutcome[];
const trajectories = ['ground', 'line', 'fly', 'popup', 'bunt'] as const satisfies readonly Trajectory[];
const runnerEvents = ['stolen_base', 'caught_stealing', 'pickoff', 'wild_pitch', 'passed_ball', 'advance_on_error'] as const satisfies readonly RunnerEvent[];
export const positions = ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'ROVER'] as const satisfies readonly Position[];
const bases = ['1', '2', '3'] as const;
const destinations = ['1', '2', '3', 'home', 'out'] as const;

export type BaseKey = typeof bases[number];
export type DestinationKey = typeof destinations[number];

/**
 * The words the scorer used for a player, exactly as heard: "Parker", or "24" for "number 24". Both null when they
 * used none ("he", "the runner", "everybody"). Never a name the model looked up in the game.
 */
export type Named = { name: string | null; number: string | null };

type Fielder = Named & { position: typeof positions[number] };
type AnswerEvent = Named & { event: typeof runnerEvents[number]; from: BaseKey; to: DestinationKey; fielders: Fielder[] };

/** One whole way the press could have gone. Every runner is keyed by the base they were on when the press began. */
export type AnswerReading = {
  /** The batter of the last at-bat in the press. */
  batter: Named;
  /** The batters of earlier at-bats the press's pitches ended, in order ("Shah strikes out, then Diaz walks"). Usually empty. */
  earlier_batters: Named[];
  pitcher: Named;
  /** Pitches before any ball in play, in order. Never the pitch that was hit. */
  pitches: (typeof pitchResults[number])[];
  ball_in_play: null | {
    outcome: typeof outcomes[number];
    trajectory: typeof trajectories[number] | null;
    fielders: Fielder[];
    batter_to: DestinationKey;
    /** Where every runner on base ended up. */
    runners: (Named & { from: BaseKey; to: DestinationKey })[];
    /** True when the batter was put out before any runner on the play, as on a 3-6 double play. */
    batter_out_first: boolean;
  };
  /** Runner events before any ball in play. */
  runner_events: AnswerEvent[];
  /** Runner events after the ball in play ("Soto singles, he steals second"), keyed by the base the runner was on after it. */
  runner_events_after: AnswerEvent[];
  /** Runners the scorer named who moved only because a walk or hit by pitch forced them along. The engine moves them. */
  forced_runners: (Named & { from: BaseKey })[];
  /** Names the scorer said and then took back ("Cole, no, I mean Shah"). They name nobody in the play. */
  taken_back: Named[];
};

/** A play has one reading, a question two (the likelier first), anything else none. There is no field for notes. */
export type Answer =
  | { result: 'play'; fix_last: boolean; readings: [AnswerReading] }
  | { result: 'question'; fix_last: boolean; readings: [AnswerReading, AnswerReading] }
  | { result: 'not_a_play' | 'unclear'; fix_last: false; readings: [] };

const oneOf = <T extends readonly string[]>(values: T, description?: string) =>
  ({ type: 'string', enum: [...values], ...(description ? { description } : {}) }) as const;
const nullable = <T extends object>(schema: T) => ({ anyOf: [schema, { type: 'null' }] }) as const;
const object = <T extends Record<string, object>>(properties: T, description?: string) => ({
  type: 'object', additionalProperties: false, required: Object.keys(properties), properties, ...(description ? { description } : {}),
}) as const;
const named = {
  name: nullable({ type: 'string', description: 'The name the scorer used for this player, exactly as heard. Null if they used none.' }),
  number: nullable({ type: 'string', description: 'The jersey number the scorer used for this player, as digits. Null if none.' }),
};

const fielderSchema = object({ position: oneOf(positions), ...named });
const runnerEventSchema = object({ event: oneOf(runnerEvents), from: oneOf(bases), to: oneOf(destinations), ...named, fielders: { type: 'array', items: fielderSchema } });

const readingSchema = object({
  batter: object(named, 'How the scorer named the batter of the last at-bat in the press.'),
  earlier_batters: { type: 'array', items: object(named), description: 'How the scorer named the batters of earlier at-bats the pitches in this press ended, in order. Usually empty.' },
  pitcher: object(named, 'How the scorer named the pitcher.'),
  pitches: { type: 'array', items: oneOf(pitchResults), description: 'Pitches before any ball in play, in order. Not the pitch that was hit.' },
  ball_in_play: nullable(object({
    outcome: oneOf(outcomes),
    trajectory: nullable(oneOf(trajectories)),
    fielders: { type: 'array', items: fielderSchema, description: 'Fielders who handled the ball, in order.' },
    batter_to: oneOf(destinations, 'Where the batter ended up.'),
    runners: {
      type: 'array',
      items: object({ from: oneOf(bases), to: oneOf(destinations), ...named }),
      description: 'Where every runner on base before the press ended up, keyed by the base they started on.',
    },
    batter_out_first: { type: 'boolean', description: 'True only when the batter was put out before any runner on the play, as on a 3-6 double play.' },
  }, 'Set when the batter put the ball in play. Null otherwise.')),
  runner_events: {
    type: 'array',
    items: runnerEventSchema,
    description: 'Steals, caught stealing, pickoffs, wild pitches, passed balls and advances on an error before any ball in play, by the base the runner was on.',
  },
  runner_events_after: {
    type: 'array',
    items: runnerEventSchema,
    description: 'The same, after the ball in play, by the base the runner was on after it. Usually empty.',
  },
  forced_runners: {
    type: 'array',
    items: object({ from: oneOf(bases), ...named }),
    description: 'Runners the scorer named who moved only because a walk or hit by pitch forced them along, by the base they were on.',
  },
  taken_back: { type: 'array', items: object(named), description: 'Names the scorer said and then took back. Usually empty.' },
});

/** Strict Structured Outputs schema: every field required, null for "not said", no extra fields. Notes come last. */
export const answerSchema = object({
  result: oneOf(results),
  fix_last: { type: 'boolean', description: 'True only when the scorer is correcting the last saved play.' },
  readings: { type: 'array', items: readingSchema, description: 'play: exactly one. question: exactly two, the likelier first. Otherwise none.' },
  unsure: { type: 'array', items: { type: 'string' }, description: 'Short notes on anything you could not settle. Never names.' },
});

/** Limits a real press never reaches. Past them the answer is malformed, not trimmed. */
const limits = { pitches: 12, runnerEvents: 6, fielders: 6, names: 4, name: 40 } as const;

type Raw = Record<string, unknown>;
const isObject = (value: unknown): value is Raw => typeof value === 'object' && value !== null && !Array.isArray(value);
const isOneOf = <T extends string>(values: readonly T[], value: unknown): value is T =>
  typeof value === 'string' && (values as readonly string[]).includes(value);

function readNamed(raw: unknown): Named | null {
  if (!isObject(raw)) return null;
  const { name, number } = raw;
  if (name !== null && (typeof name !== 'string' || !name.trim() || name.length > limits.name || !/^[\p{L}\p{N} .'’-]+$/u.test(name))) return null;
  if (number !== null && (typeof number !== 'string' || !/^\d{1,3}$/.test(number))) return null;
  return { name: name === null ? null : name.trim(), number };
}

/** Reads each item of a list, or null when it isn't a short list or any item is off. */
function list<T>(raw: unknown, max: number, read: (item: unknown) => T | null): T[] | null {
  if (!Array.isArray(raw) || raw.length > max) return null;
  const items = raw.map(read);
  return items.some((item) => item === null) ? null : items as T[];
}

const distinctFrom = (moves: { from: BaseKey }[]) => new Set(moves.map((move) => move.from)).size === moves.length;

function readMove(raw: unknown): (Named & { from: BaseKey; to: DestinationKey }) | null {
  if (!isObject(raw) || !isOneOf(bases, raw.from) || !isOneOf(destinations, raw.to)) return null;
  const who = readNamed(raw);
  return who && { from: raw.from, to: raw.to, ...who };
}

function readFielder(raw: unknown): Fielder | null {
  if (!isObject(raw) || !isOneOf(positions, raw.position)) return null;
  const who = readNamed(raw);
  return who && { position: raw.position, ...who };
}

function readEvents(raw: unknown): AnswerEvent[] | null {
  const events = list(raw, limits.runnerEvents, (item) => {
    const move = readMove(item);
    const fielders = isObject(item) ? list(item.fielders, limits.fielders, readFielder) : null;
    return move && fielders && isObject(item) && isOneOf(runnerEvents, item.event) ? { event: item.event, ...move, fielders } : null;
  });
  return events && distinctFrom(events) ? events : null;
}

function readBallInPlay(raw: unknown): AnswerReading['ball_in_play'] | undefined {
  if (raw === null) return null;
  if (!isObject(raw) || !isOneOf(outcomes, raw.outcome) || !isOneOf(destinations, raw.batter_to)) return undefined;
  if (raw.trajectory !== null && !isOneOf(trajectories, raw.trajectory)) return undefined;
  const fielders = list(raw.fielders, limits.fielders, readFielder);
  const runners = list(raw.runners, 3, readMove);
  if (!fielders || !runners || !distinctFrom(runners) || typeof raw.batter_out_first !== 'boolean') return undefined;
  return { outcome: raw.outcome, trajectory: raw.trajectory, fielders, batter_to: raw.batter_to, runners, batter_out_first: raw.batter_out_first };
}

function readReading(raw: unknown): AnswerReading | null {
  if (!isObject(raw)) return null;
  const batter = readNamed(raw.batter);
  const pitcher = readNamed(raw.pitcher);
  const earlier = list(raw.earlier_batters, 3, readNamed);
  const pitches = list(raw.pitches, limits.pitches, (item) => isOneOf(pitchResults, item) ? item : null);
  const ballInPlay = readBallInPlay(raw.ball_in_play);
  const events = readEvents(raw.runner_events);
  const after = readEvents(raw.runner_events_after);
  const forced = list(raw.forced_runners, 3, (item) => {
    if (!isObject(item) || !isOneOf(bases, item.from)) return null;
    const who = readNamed(item);
    return who && { from: item.from, ...who };
  });
  const takenBack = list(raw.taken_back, limits.names, readNamed);
  if (!batter || !pitcher || !earlier || !pitches || ballInPlay === undefined || !events || !after || !forced || !distinctFrom(forced) || !takenBack) return null;
  if (!pitches.length && !ballInPlay && !events.length) return null;
  // Events after the ball in play need one to come after.
  if (after.length && !ballInPlay) return null;
  return {
    batter, earlier_batters: earlier, pitcher, pitches, ball_in_play: ballInPlay,
    runner_events: events, runner_events_after: after, forced_runners: forced, taken_back: takenBack,
  };
}

/**
 * The one strict reader. It rebuilds the answer field by field, so the notes and any key the schema doesn't name
 * can't pass through. Null for anything off; a null answer saves nothing.
 */
export function readAnswer(raw: unknown): Answer | null {
  if (!isObject(raw) || !isOneOf(results, raw.result) || typeof raw.fix_last !== 'boolean' || !Array.isArray(raw.readings)) return null;
  if (raw.result === 'not_a_play' || raw.result === 'unclear') return { result: raw.result, fix_last: false, readings: [] };
  const readings = raw.readings.map(readReading);
  if (readings.some((reading) => reading === null)) return null;
  const [first, second] = readings as AnswerReading[];
  if (raw.result === 'play') return readings.length === 1 ? { result: 'play', fix_last: raw.fix_last, readings: [first!] } : null;
  return readings.length === 2 ? { result: 'question', fix_last: raw.fix_last, readings: [first!, second!] } : null;
}
