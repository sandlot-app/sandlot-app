import type {
  Advance, Command, Event, EventId, GameControl, GameId, GroupId, LineupSlot,
  OpponentId, PlayerId, PlayerRef, SessionId, Substitution, Timestamp,
} from './types.ts';

/** One play sent from the scorer's phone to `sync-events`. See docs/contract.md. */
export type UploadRequest = { sessionId: SessionId; events: Event[] };

const MAX_INTEGER = 2 ** 31 - 1;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const POSITIONS = ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'ROVER'] as const;
const PITCH_RESULTS = ['ball', 'called_strike', 'swinging_strike', 'foul', 'foul_tip', 'hit_by_pitch', 'in_play'] as const;
const OUTCOMES = ['single', 'double', 'ground_rule_double', 'triple', 'home_run', 'out', 'error', 'fielders_choice', 'sacrifice_fly', 'sacrifice_bunt', 'double_play', 'triple_play'] as const;
const TRAJECTORIES = ['ground', 'line', 'fly', 'popup', 'bunt'] as const;
const RUNNER_EVENTS = ['stolen_base', 'caught_stealing', 'pickoff', 'wild_pitch', 'passed_ball', 'balk', 'advance_on_error', 'defensive_indifference', 'left_early', 'missed_base'] as const;
const BATTER_OUT_REASONS = ['thrown_bat', 'batting_out_of_order', 'max_pitches'] as const;
const DESTINATIONS = [1, 2, 3, 'home', 'out'] as const;
const SIDES = ['home', 'away'] as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isText = (value: unknown): value is string => typeof value === 'string' && value.length > 0;
const isId = (value: unknown): value is string => isText(value) && value.length <= 128;
const isCount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value > 0 && value <= MAX_INTEGER;
const isOneOf = <T extends string | number>(value: unknown, choices: readonly T[]): value is T =>
  choices.some((choice) => choice === value);

// Postgres text and jsonb cannot hold U+0000, including in unknown command fields.
const hasNull = (value: unknown): boolean =>
  typeof value === 'string'
    ? value.includes('\0')
    : Array.isArray(value)
      ? value.some(hasNull)
      : isRecord(value) && Object.entries(value).some(([key, item]) => key.includes('\0') || hasNull(item));

function parseArray<T>(value: unknown, parse: (item: unknown) => T | null): T[] | null {
  if (!Array.isArray(value)) return null;
  const parsed: T[] = [];
  for (const item of value) {
    const result = parse(item);
    if (result === null) return null;
    parsed.push(result);
  }
  return parsed;
}

function parsePlayerRef(value: unknown): PlayerRef | null {
  if (!isRecord(value) || !isText(value.id)) return null;
  const kind = value.kind as PlayerRef['kind'];
  switch (kind) {
    case 'player': return { ...value, kind, id: value.id as PlayerId };
    case 'opponent': return { ...value, kind, id: value.id as OpponentId };
    default: kind satisfies never; return null;
  }
}

function parseAdvance(value: unknown): Advance | null {
  if (!isRecord(value) || !isOneOf(value.to, DESTINATIONS)) return null;
  const runner = parsePlayerRef(value.runner);
  return runner ? { ...value, runner, to: value.to } : null;
}

function parseSubstitution(value: unknown): Substitution | null {
  if (!isRecord(value)) return null;
  const incoming = parsePlayerRef(value.in);
  if (!incoming) return null;
  const kind = value.kind as Substitution['kind'];
  switch (kind) {
    case 'pinch_hitter':
    case 'pinch_runner':
    case 'courtesy_runner': {
      const outgoing = parsePlayerRef(value.out);
      return outgoing ? { ...value, kind, in: incoming, out: outgoing } : null;
    }
    case 'defensive':
      return isOneOf(value.position, POSITIONS) ? { ...value, kind, in: incoming, position: value.position } : null;
    case 'pitching_change':
    case 'late_arrival': return { ...value, kind, in: incoming };
    default: kind satisfies never; return null;
  }
}

function parseLineupSlot(value: unknown): LineupSlot | null {
  if (!isRecord(value) || (value.position !== null && !isOneOf(value.position, POSITIONS))) return null;
  const player = parsePlayerRef(value.player);
  return player ? { ...value, player, position: value.position } : null;
}

function parseGameControl(value: unknown): GameControl | null {
  if (!isRecord(value)) return null;
  const kind = value.kind as GameControl['kind'];
  switch (kind) {
    case 'lineup_set': {
      if (!isOneOf(value.side, SIDES)) return null;
      const lineup = parseArray(value.lineup, parseLineupSlot);
      return lineup ? { ...value, kind, side: value.side, lineup } : null;
    }
    case 'start':
      return isText(value.umpireStart) ? { ...value, kind, umpireStart: value.umpireStart as Timestamp } : null;
    case 'end_half':
      return isOneOf(value.reason, ['manual', 'time_limit']) ? { ...value, kind, reason: value.reason } : null;
    case 'end_game':
      return isOneOf(value.reason, ['final', 'called', 'time_limit']) ? { ...value, kind, reason: value.reason } : null;
    default: kind satisfies never; return null;
  }
}

function parseCommand(value: unknown): Command | null {
  if (!isRecord(value)) return null;
  const kind = value.kind as Command['kind'];
  switch (kind) {
    case 'pitch':
      return isOneOf(value.result, PITCH_RESULTS) ? { ...value, kind, result: value.result } : null;
    case 'ball_in_play': {
      if (!isOneOf(value.outcome, OUTCOMES) ||
        (value.trajectory !== null && !isOneOf(value.trajectory, TRAJECTORIES))) return null;
      const fielders = parseArray(value.fielders, (position) => isOneOf(position, POSITIONS) ? position : null);
      const advances = parseArray(value.advances, parseAdvance);
      return fielders && advances ? { ...value, kind, outcome: value.outcome, trajectory: value.trajectory, fielders, advances } : null;
    }
    case 'runner': {
      if (!isOneOf(value.event, RUNNER_EVENTS) || !isOneOf(value.to, DESTINATIONS)) return null;
      const runner = parsePlayerRef(value.runner);
      return runner ? { ...value, kind, event: value.event, runner, to: value.to } : null;
    }
    case 'batter_out':
      return isOneOf(value.reason, BATTER_OUT_REASONS) ? { ...value, kind, reason: value.reason } : null;
    case 'substitution': {
      if (!isOneOf(value.side, SIDES)) return null;
      const change = parseSubstitution(value.change);
      return change ? { ...value, kind, side: value.side, change } : null;
    }
    case 'game': {
      const control = parseGameControl(value.control);
      return control ? { ...value, kind, control } : null;
    }
    case 'undo':
      return isId(value.target) ? { ...value, kind, target: value.target as GroupId } : null;
    case 'correct': {
      if (!isId(value.target)) return null;
      const replacement = parseArray(value.replacement, parseCommand);
      return replacement ? { ...value, kind, target: value.target as GroupId, replacement } : null;
    }
    default: kind satisfies never; return null;
  }
}

function parseEvent(value: unknown): Event | null {
  if (!isRecord(value) || hasNull(value)) return null;
  const { id, gameId, seq, group, lockEpoch, source, at } = value;
  if (!isId(id) || !isText(gameId) || !UUID.test(gameId) || !isCount(seq) || !isId(group) ||
    !isCount(lockEpoch) || !isOneOf(source, ['tap', 'voice']) || !isText(at)) return null;
  const command = parseCommand(value.command);
  return command ? {
    id: id as EventId, gameId: gameId as GameId, seq, group: group as GroupId, lockEpoch,
    source, at: at as Timestamp, command,
  } : null;
}

/** Checks wire shape and play consistency. Game legality belongs to the engine. */
export function parseUploadRequest(body: unknown): UploadRequest | null {
  if (!isRecord(body) || !isText(body.sessionId) || !UUID.test(body.sessionId) ||
    !Array.isArray(body.events) || body.events.length < 1 || body.events.length > 20) return null;
  const events = parseArray(body.events, parseEvent);
  const first = events?.[0];
  if (!events || !first) return null;
  if (new Set(events.map((event) => event.id)).size !== events.length || !events.every((event, index) =>
    event.gameId === first.gameId && event.group === first.group && event.lockEpoch === first.lockEpoch &&
    event.at === first.at && event.seq === first.seq + index)) return null;
  return { sessionId: body.sessionId as SessionId, events };
}
