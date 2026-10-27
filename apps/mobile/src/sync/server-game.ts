import { ENGINE_VERSION, EVENT_SCHEMA_VERSION } from '@sandlot/engine';
import { demoSetup } from '../scoring/demo-game.ts';
import type { ServerGame } from '../scoring/offline-game.ts';

// How the phone learns the game it scores (docs/contract.md, Demo access): the seed script makes this phone's
// anonymous user the scorer of a public demo game, and the phone reads its own newest session back.

export type SessionRow = { id: string; game_id: string; epoch: number };
export type GameRow = {
  id: string; engine_version: string; schema_version: number; rules: unknown; setup: unknown; lock_epoch: number; revision: number;
};
/** The two reads, each through row-level security: a scorer reads their own sessions and their own game. Null means none. */
export type ServerRows = { latestSession(): Promise<SessionRow | null>; game(id: string): Promise<GameRow | null> };

export type ServerGameResult =
  | { kind: 'found'; server: ServerGame }
  /** This phone isn't any game's scorer yet. */
  | { kind: 'none' }
  /** The game can't take this phone's plays: other pins or setup, plays already on it, or a newer scorer. */
  | { kind: 'mismatch' }
  | { kind: 'offline' };

/** The version pins, rules and setup the seed script gives the demo game, so the server replays what the phone scores. */
export function demoPins() {
  const { rules, ...setup } = demoSetup;
  return { engineVersion: ENGINE_VERSION, schemaVersion: EVENT_SCHEMA_VERSION, rules, setup };
}

/** JSON with every object's keys sorted, since Postgres jsonb keeps keys in its own order. */
function canonical(value: unknown): string {
  const sorted = (inner: unknown): unknown => Array.isArray(inner) ? inner.map(sorted)
    : inner && typeof inner === 'object' ? Object.fromEntries(Object.keys(inner).sort().map((key) => [key, sorted((inner as Record<string, unknown>)[key])]))
      : inner;
  return JSON.stringify(sorted(value));
}

export async function findServerGame(rows: ServerRows): Promise<ServerGameResult> {
  try {
    const session = await rows.latestSession();
    if (!session) return { kind: 'none' };
    const game = await rows.game(session.game_id);
    if (!game) return { kind: 'none' };
    const pins = demoPins();
    const fits = game.engine_version === pins.engineVersion && game.schema_version === pins.schemaVersion
      && canonical(game.rules) === canonical(pins.rules) && canonical(game.setup) === canonical(pins.setup)
      // A new synced game starts from the server's first play, under the game's current scoring session.
      && game.revision === 0 && game.lock_epoch === session.epoch;
    return fits ? { kind: 'found', server: { gameId: game.id, sessionId: session.id, lockEpoch: session.epoch } } : { kind: 'mismatch' };
  } catch {
    return { kind: 'offline' };
  }
}
