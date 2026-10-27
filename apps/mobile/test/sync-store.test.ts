import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { EVENT_SCHEMA_VERSION } from '@sandlot/engine';
import { openOfflineGame, type ServerGame } from '../src/scoring/offline-game.ts';
import { connect } from './database.ts';

const boundary = { newId: randomUUID, now: () => '2026-10-27T17:00:00.000Z' };
const server: ServerGame = { gameId: '6f1d2c4e-0000-4000-8000-000000000001', sessionId: '6f1d2c4e-0000-4000-8000-0000000000a1', lockEpoch: 3 };

async function open(database = connect(':memory:')) {
  const session = await openOfflineGame(database, boundary);
  if (session.kind !== 'ready') throw new Error(`Session must open: ${session.reason}`);
  return { database, session };
}

async function saved(promise: ReturnType<Awaited<ReturnType<typeof open>>['session']['record']>) {
  const result = await promise;
  if (result.kind !== 'saved') throw new Error(`The play must save: ${JSON.stringify(result)}`);
  return result.game;
}

test('a synced game takes the server’s game, session and epoch, and uploads its plays exactly as saved, in order', async () => {
  const { database, session } = await open();
  const started = await saved(session.record({ kind: 'start', server }));
  assert.equal(started.id, server.gameId);
  assert.deepEqual(started.context, { kind: 'synced', sessionId: server.sessionId, lockEpoch: 3 });
  const ball = await saved(session.record({ kind: 'pitch', result: 'ball' }));
  assert.equal(ball.waitingPlays, 2);

  const first = await session.nextUpload();
  assert.ok(first);
  assert.equal(first.schemaVersion, EVENT_SCHEMA_VERSION);
  assert.equal(first.sessionId, server.sessionId);
  assert.deepEqual(first.events.map((event) => [event.seq, event.gameId, event.lockEpoch, event.command.kind]),
    [[1, server.gameId, 3, 'game'], [2, server.gameId, 3, 'game'], [3, server.gameId, 3, 'game']]);
  const stored = await database.all<{ event_json: string }>('SELECT event_json FROM local_events ORDER BY seq LIMIT 3');
  assert.deepEqual(first.events, stored.map((row) => JSON.parse(row.event_json)), 'the request carries the saved events unchanged');
  assert.deepEqual(await session.nextUpload(), first, 'until it is acknowledged, the same group is offered again');

  const acknowledged = await session.acknowledge(first.events[0]!.group, 3);
  assert.equal(acknowledged?.waitingPlays, 1);
  const second = await session.nextUpload();
  assert.deepEqual(second?.events.map((event) => [event.seq, event.command.kind]), [[4, 'pitch']]);
});

test('acknowledgments are kept in order, survive reopening, and an out-of-order one changes nothing', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'sandlot-sync-'));
  try {
    const path = join(directory, 'games.db');
    const { database, session } = await open(connect(path));
    await saved(session.record({ kind: 'start', server }));
    await saved(session.record({ kind: 'pitch', result: 'ball' }));
    await saved(session.record({ kind: 'undo' }));
    const bootstrap = await session.nextUpload();
    assert.ok(bootstrap);
    const groups = await database.all<{ group_id: string }>('SELECT group_id FROM local_outbox ORDER BY first_seq');
    assert.equal(await session.acknowledge(groups[2]!.group_id, 5), null, 'the undo cannot be acknowledged before the ball');
    assert.equal(await session.acknowledge(groups[0]!.group_id, 2), null, 'an acknowledgment must name the group’s last seq');
    assert.equal((await session.acknowledge(groups[0]!.group_id, 3))?.waitingPlays, 2);
    await database.close();

    const reopened = await open(connect(path));
    assert.equal(reopened.session.game?.waitingPlays, 2);
    assert.deepEqual((await reopened.session.nextUpload())?.events.map((event) => event.seq), [4]);
    assert.equal((await reopened.session.acknowledge(groups[1]!.group_id, 4))?.waitingPlays, 1);
    assert.equal((await reopened.session.acknowledge(groups[2]!.group_id, 5))?.waitingPlays, 0);
    assert.equal(await reopened.session.nextUpload(), null);
    const after = await saved(reopened.session.record({ kind: 'pitch', result: 'foul' }));
    assert.equal(after.waitingPlays, 1, 'a new play waits again after everything was acknowledged');
    await reopened.database.close();
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('a local demo game never offers an upload', async () => {
  const { session } = await open();
  const started = await saved(session.record({ kind: 'start' }));
  assert.deepEqual(started.context, { kind: 'local_demo' });
  await saved(session.record({ kind: 'pitch', result: 'ball' }));
  assert.equal(await session.nextUpload(), null);
});

test('a game saved by the first storage format opens unchanged and keeps scoring', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'sandlot-sync-'));
  try {
    const path = join(directory, 'games.db');
    const old = new DatabaseSync(path);
    old.exec(`
      CREATE TABLE local_games (
        slot INTEGER PRIMARY KEY CHECK (slot = 1), id TEXT NOT NULL UNIQUE,
        setup_json TEXT NOT NULL, engine_version TEXT NOT NULL, schema_version INTEGER NOT NULL,
        context TEXT NOT NULL CHECK (context = 'local_demo'), bootstrap_group TEXT NOT NULL
      );
      CREATE TABLE local_events (
        game_id TEXT NOT NULL REFERENCES local_games(id), seq INTEGER NOT NULL CHECK (seq > 0),
        event_id TEXT NOT NULL, group_id TEXT NOT NULL, event_json TEXT NOT NULL,
        PRIMARY KEY (game_id, seq), UNIQUE (game_id, event_id)
      );
      CREATE TABLE local_outbox (
        game_id TEXT NOT NULL, group_id TEXT NOT NULL, first_seq INTEGER NOT NULL,
        event_count INTEGER NOT NULL CHECK (event_count > 0), PRIMARY KEY (game_id, group_id),
        UNIQUE (game_id, first_seq), FOREIGN KEY (game_id, first_seq) REFERENCES local_events(game_id, seq)
      );
      PRAGMA user_version = 1;
    `);
    old.close();
    const first = await open(connect(path));
    const started = await saved(first.session.record({ kind: 'start' }));
    const before = await first.database.all<{ event_json: string }>('SELECT event_json FROM local_events ORDER BY seq');
    await first.database.close();

    const second = await open(connect(path));
    assert.deepEqual(second.session.game, started);
    assert.deepEqual(await second.database.all<{ event_json: string }>('SELECT event_json FROM local_events ORDER BY seq'), before);
    assert.equal((await saved(second.session.record({ kind: 'pitch', result: 'ball' }))).waitingPlays, 2);
    await second.database.close();
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
