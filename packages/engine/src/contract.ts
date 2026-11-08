import type {
  Advance, Command, Event, EventId, GameControl, GameId, GroupId, LineupSlot,
  OpponentId, PlayerId, PlayerRef, SessionId, Substitution, Timestamp,
} from './types.ts';
import { EVENT_SCHEMA_VERSION } from './version.ts';

/** One play sent from the scorer's phone to `sync-events`. See docs/contract.md. */
export type UploadRequest = { schemaVersion: typeof EVENT_SCHEMA_VERSION; sessionId: SessionId; events: Event[] };

export type ParsedUpload =
  | { ok: true; request: UploadRequest }
  | { ok: false; code: 'invalid' | 'unsupported_version' };

const INVALID = { ok: false, code: 'invalid' } as const;

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

const onlyKeys = (value: Record<string, unknown>, keys: readonly string[]): boolean =>
  Object.keys(value).every((key) => keys.includes(key));

function boundedWire(value: unknown): boolean {
  const pending = [{ value, depth: 0 }];
  let nodes = 0;
  while (pending.length) {
    const current = pending.pop()!;
    if (++nodes > 20_000 || current.depth > 32) return false;
    if (typeof current.value === 'string') {
      if (current.value.length > 128 || current.value.includes('\0')) return false;
    } else if (Array.isArray(current.value)) {
      if (current.value.length > 40) return false;
      for (const child of current.value) pending.push({ value: child, depth: current.depth + 1 });
    } else if (isRecord(current.value)) {
      const entries = Object.entries(current.value);
      if (entries.length > 16) return false;
      for (const [key, child] of entries) {
        if (key.length > 64 || key.includes('\0')) return false;
        pending.push({ value: child, depth: current.depth + 1 });
      }
    }
  }
  return true;
}

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
  if (!isRecord(value) || !onlyKeys(value, ['kind', 'id']) || !isId(value.id)) return null;
  const kind = value.kind as PlayerRef['kind'];
  switch (kind) {
    case 'player': return { ...value, kind, id: value.id as PlayerId };
    case 'opponent': return { ...value, kind, id: value.id as OpponentId };
    default: kind satisfies never; return null;
  }
}

function parseAdvance(value: unknown): Advance | null {
  if (!isRecord(value) || !onlyKeys(value, ['runner', 'to', 'outType']) || !isOneOf(value.to, DESTINATIONS)) return null;
  const runner = parsePlayerRef(value.runner);
  if (!runner) return null;
  if (value.to === 'out') {
    return isOneOf(value.outType, ['force', 'batter_before_first', 'non_force'])
      ? { ...value, runner, to: 'out', outType: value.outType }
      : null;
  }
  return 'outType' in value ? null : { ...value, runner, to: value.to };
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
      if (!onlyKeys(value, ['kind', 'in', 'out'])) return null;
      const outgoing = parsePlayerRef(value.out);
      return outgoing ? { ...value, kind, in: incoming, out: outgoing } : null;
    }
    case 'defensive':
      return onlyKeys(value, ['kind', 'in', 'position']) && isOneOf(value.position, POSITIONS) ? { ...value, kind, in: incoming, position: value.position } : null;
    case 'pitching_change':
    case 'late_arrival': return onlyKeys(value, ['kind', 'in']) ? { kind, in: incoming } : null;
    default: kind satisfies never; return null;
  }
}

function parseLineupSlot(value: unknown): LineupSlot | null {
  if (!isRecord(value) || !onlyKeys(value, ['player', 'position']) || (value.position !== null && !isOneOf(value.position, POSITIONS))) return null;
  const player = parsePlayerRef(value.player);
  return player ? { ...value, player, position: value.position } : null;
}

function parseGameControl(value: unknown): GameControl | null {
  if (!isRecord(value)) return null;
  const kind = value.kind as GameControl['kind'];
  switch (kind) {
    case 'lineup_set': {
      if (!onlyKeys(value, ['kind', 'side', 'lineup']) || !isOneOf(value.side, SIDES)) return null;
      const lineup = parseArray(value.lineup, parseLineupSlot);
      return lineup ? { ...value, kind, side: value.side, lineup } : null;
    }
    case 'start':
      return onlyKeys(value, ['kind', 'umpireStart']) && isText(value.umpireStart) ? { ...value, kind, umpireStart: value.umpireStart as Timestamp } : null;
    case 'end_half':
      return onlyKeys(value, ['kind', 'reason']) && isOneOf(value.reason, ['manual', 'time_limit']) ? { ...value, kind, reason: value.reason } : null;
    case 'end_game':
      return onlyKeys(value, ['kind', 'reason']) && isOneOf(value.reason, ['final', 'called', 'time_limit']) ? { ...value, kind, reason: value.reason } : null;
    default: kind satisfies never; return null;
  }
}

function parseCommand(value: unknown): Command | null {
  if (!isRecord(value)) return null;
  const kind = value.kind as Command['kind'];
  switch (kind) {
    case 'pitch':
      return onlyKeys(value, ['kind', 'result']) && isOneOf(value.result, PITCH_RESULTS) ? { ...value, kind, result: value.result } : null;
    case 'ball_in_play': {
      if (!onlyKeys(value, ['kind', 'outcome', 'trajectory', 'fielders', 'advances']) || !isOneOf(value.outcome, OUTCOMES) ||
        (value.trajectory !== null && !isOneOf(value.trajectory, TRAJECTORIES))) return null;
      const fielders = parseArray(value.fielders, (position) => isOneOf(position, POSITIONS) ? position : null);
      const advances = parseArray(value.advances, parseAdvance);
      return fielders && advances ? { ...value, kind, outcome: value.outcome, trajectory: value.trajectory, fielders, advances } : null;
    }
    case 'runner': {
      if (!onlyKeys(value, ['kind', 'event', 'runner', 'to']) || !isOneOf(value.event, RUNNER_EVENTS) || !isOneOf(value.to, DESTINATIONS)) return null;
      const runner = parsePlayerRef(value.runner);
      return runner ? { ...value, kind, event: value.event, runner, to: value.to } : null;
    }
    case 'batter_out':
      return onlyKeys(value, ['kind', 'reason']) && isOneOf(value.reason, BATTER_OUT_REASONS) ? { ...value, kind, reason: value.reason } : null;
    case 'substitution': {
      if (!onlyKeys(value, ['kind', 'side', 'change']) || !isOneOf(value.side, SIDES)) return null;
      const change = parseSubstitution(value.change);
      return change ? { ...value, kind, side: value.side, change } : null;
    }
    case 'game': {
      if (!onlyKeys(value, ['kind', 'control'])) return null;
      const control = parseGameControl(value.control);
      return control ? { ...value, kind, control } : null;
    }
    case 'undo':
      return onlyKeys(value, ['kind', 'target']) && isId(value.target) ? { ...value, kind, target: value.target as GroupId } : null;
    case 'correct': {
      if (!onlyKeys(value, ['kind', 'target', 'replacement']) || !isId(value.target)) return null;
      const replacement = parseArray(value.replacement, parseCommand);
      return replacement ? { ...value, kind, target: value.target as GroupId, replacement } : null;
    }
    default: kind satisfies never; return null;
  }
}

function parseEvent(value: unknown): Event | null {
  if (!isRecord(value) || !onlyKeys(value, ['id', 'gameId', 'seq', 'group', 'lockEpoch', 'source', 'at', 'command'])) return null;
  const { id, gameId, seq, group, lockEpoch, source, at } = value;
  if (!isId(id) || !isText(gameId) || !UUID.test(gameId) || !isCount(seq) || !isId(group) ||
    !isCount(lockEpoch) || !isOneOf(source, ['tap', 'voice']) || !isText(at)) return null;
  const command = parseCommand(value.command);
  return command ? {
    id: id as EventId, gameId: gameId as GameId, seq, group: group as GroupId, lockEpoch,
    source, at: at as Timestamp, command,
  } : null;
}

/**
 * Checks wire shape and play consistency. Game legality belongs to the engine.
 * Only the envelope every schema version shares is read before the version check,
 * because a body in another event format cannot be read by the rest of this parser.
 */
export function parseUploadRequest(body: unknown): ParsedUpload {
  if (!isRecord(body) || !isText(body.sessionId) || !Array.isArray(body.events) || body.events.length < 1) return INVALID;
  if (body.schemaVersion !== EVENT_SCHEMA_VERSION) return { ok: false, code: 'unsupported_version' };
  if (!onlyKeys(body, ['schemaVersion', 'sessionId', 'events']) || !UUID.test(body.sessionId) || body.events.length > 20 || !boundedWire(body)) return INVALID;
  const events = parseArray(body.events, parseEvent);
  const first = events?.[0];
  if (!events || !first) return INVALID;
  if (new Set(events.map((event) => event.id)).size !== events.length || !events.every((event, index) =>
    event.gameId === first.gameId && event.group === first.group && event.lockEpoch === first.lockEpoch &&
    event.at === first.at && event.seq === first.seq + index)) return INVALID;
  return { ok: true, request: { schemaVersion: EVENT_SCHEMA_VERSION, sessionId: body.sessionId as SessionId, events } };
}
