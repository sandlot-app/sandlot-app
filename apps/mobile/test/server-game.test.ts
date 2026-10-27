import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ENGINE_VERSION, EVENT_SCHEMA_VERSION } from '@sandlot/engine';
import { demoSetup } from '../src/scoring/demo-game.ts';
import { demoPins, findServerGame, type ServerRows } from '../src/sync/server-game.ts';

const session = { id: '6f1d2c4e-0000-4000-8000-0000000000a1', game_id: '6f1d2c4e-0000-4000-8000-000000000001', epoch: 2 };
// Postgres jsonb stores keys in its own order, so the server's copy reads back reordered.
const reordered = (value: unknown): unknown => Array.isArray(value) ? value.map(reordered)
  : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).reverse().map(([key, inner]) => [key, reordered(inner)])) : value;
const { rules, ...setup } = demoSetup;
const game = { id: session.game_id, engine_version: ENGINE_VERSION, schema_version: EVENT_SCHEMA_VERSION, rules: reordered(rules), setup: reordered(setup), lock_epoch: 2, revision: 0 };

const rows = (overrides: { session?: object | null; game?: object | null } = {}): ServerRows => ({
  latestSession: async () => ('session' in overrides ? overrides.session as never : session),
  game: async () => ('game' in overrides ? overrides.game as never : game),
});

test('the phone’s newest scoring session names the server game it scores', async () => {
  assert.deepEqual(await findServerGame(rows()), {
    kind: 'found', server: { gameId: session.game_id, sessionId: session.id, lockEpoch: 2 },
  });
});

test('no session means the seed script hasn’t named this phone the scorer yet', async () => {
  assert.deepEqual(await findServerGame(rows({ session: null })), { kind: 'none' });
});

test('a game that doesn’t match this app, or already has plays, or moved to another scorer, is refused', async () => {
  assert.deepEqual(await findServerGame(rows({ game: { ...game, engine_version: '0.1.0' } })), { kind: 'mismatch' });
  assert.deepEqual(await findServerGame(rows({ game: { ...game, setup: { ...setup, pitcherOutsEarlierToday: { 'home-1': 3 } } } })), { kind: 'mismatch' });
  assert.deepEqual(await findServerGame(rows({ game: { ...game, revision: 4 } })), { kind: 'mismatch' });
  assert.deepEqual(await findServerGame(rows({ game: { ...game, lock_epoch: 3 } })), { kind: 'mismatch' });
  assert.deepEqual(await findServerGame(rows({ game: null })), { kind: 'none' });
});

test('no answer from the server reads as offline', async () => {
  assert.deepEqual(await findServerGame({ latestSession: async () => { throw new Error('offline'); }, game: async () => game }), { kind: 'offline' });
});

test('the seed script’s pins are the phone’s own demo setup, so the server replays exactly what the phone scores', () => {
  assert.deepEqual(demoPins(), { engineVersion: ENGINE_VERSION, schemaVersion: EVENT_SCHEMA_VERSION, rules, setup });
});
