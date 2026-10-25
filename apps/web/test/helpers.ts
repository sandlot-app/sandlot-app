import { sampleHalfInning, sampleSetup } from '@sandlot/engine/scripts/sample-events.ts';
import { ENGINE_VERSION, EVENT_SCHEMA_VERSION, replay } from '@sandlot/engine';
import type { Command, Event, EventId, GameId, GameState, GroupId, OpponentId, PlayerRef, SessionId, Timestamp } from '@sandlot/engine';
import type { Pins, Snapshot } from '../src/snapshot.ts';

export const gameId = '11111111-1111-1111-1111-111111111111' as GameId;
const sessionId = '22222222-2222-2222-2222-222222222222' as SessionId;

export const sampleEvents = (): Event[] =>
  sampleHalfInning({ gameId, sessionId, lockEpoch: 1 }).flatMap((request) => request.events);

export function pins(overrides: Partial<Pins> = {}): Pins {
  const { rules, ...setup } = sampleSetup();
  return { engineVersion: ENGINE_VERSION, schemaVersion: EVENT_SCHEMA_VERSION, rules, setup, ...overrides };
}

/** One more play after `events`, numbered to continue them. */
export function withPlay(events: Event[], id: string, ...commands: Command[]): Event[] {
  const last = events.at(-1)!;
  return [
    ...events,
    ...commands.map((command, i): Event => ({
      id: `${id}-event-${i}` as EventId,
      gameId,
      seq: last.seq + 1 + i,
      group: id as GroupId,
      lockEpoch: last.lockEpoch,
      source: 'tap',
      at: '2026-10-25T17:10:00.000Z' as Timestamp,
      command,
    })),
  ];
}

export const awayPlayer = (n: number): PlayerRef => ({ kind: 'opponent', id: `away-${n}` as OpponentId });

export function serverState(events: Event[]): GameState {
  const { rules, ...setup } = sampleSetup();
  const result = replay({ ...setup, rules }, events);
  if (!result.ok) throw new Error(`fixture events were rejected: ${result.code}`);
  return result.state;
}

/** What `get_snapshot` returns once the page already holds events through `afterSeq`. */
export function snapshot(events: Event[], options: { afterSeq?: number; state?: GameState | null; pins?: Partial<Pins> } = {}): Snapshot {
  const { afterSeq = 0, state, pins: pinOverrides } = options;
  return {
    gameId,
    revision: events.at(-1)?.seq ?? 0,
    ...pins(pinOverrides),
    state: state === undefined ? (events.length > 0 ? serverState(events) : null) : state,
    events: events.filter((event) => event.seq > afterSeq),
  };
}
