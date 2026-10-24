import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { openOfflineGame } from '../src/scoring/offline-game.ts';
import type { SqlDatabase, SqlConnection, SqlValue } from '../src/scoring/database.ts';

function connect(path: string): SqlDatabase {
  const database = new DatabaseSync(path);
  database.exec('PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 1');
  const connection: SqlConnection = {
    async exec(sql) { database.exec(sql); },
    async all<T>(sql: string, values: SqlValue[] = []): Promise<T[]> {
      return database.prepare(sql).all(...values) as T[];
    },
    async run(sql, values = []) { database.prepare(sql).run(...values); },
  };
  return {
    ...connection,
    async transaction(task) {
      database.exec('BEGIN IMMEDIATE');
      try {
        await task(connection);
        database.exec('COMMIT');
      } catch (error) {
        database.exec('ROLLBACK');
        throw error;
      }
    },
    async close() { database.close(); },
  };
}

const boundary = { newId: randomUUID, now: () => '2026-10-24T17:00:00.000Z' };

test('a local storage format changed after opening blocks scoring without appending a play', async () => {
  const database = connect(':memory:');
  const opened = await openOfflineGame(database, boundary);
  assert.equal(opened.kind, 'ready');
  if (opened.kind !== 'ready') return;
  await opened.record({ kind: 'start' });
  await database.exec('PRAGMA user_version = 2');
  assert.deepEqual(await opened.record({ kind: 'pitch', result: 'ball' }), { kind: 'blocked', reason: 'version' });
  assert.deepEqual(await database.all('SELECT count(*) AS saved FROM local_events'), [{ saved: 3 }]);
  await database.close();
});

test('a committed play is recovered by its original group if commit completion is uncertain', async () => {
  const database = connect(':memory:');
  let loseCompletion = false;
  const uncertain: SqlDatabase = {
    ...database,
    async transaction(task) {
      await database.transaction(task);
      if (loseCompletion) { loseCompletion = false; throw new Error('Commit response lost'); }
    },
  };
  const opened = await openOfflineGame(uncertain, boundary);
  assert.equal(opened.kind, 'ready');
  if (opened.kind !== 'ready') return;
  await opened.record({ kind: 'start' });
  loseCompletion = true;
  const pitched = await opened.record({ kind: 'pitch', result: 'ball' });
  assert.equal(pitched.kind, 'saved');
  if (pitched.kind === 'saved') {
    assert.equal(pitched.game.state.count.balls, 1);
    assert.equal(pitched.game.waitingPlays, 2);
  }
  const reopened = await openOfflineGame(database, boundary);
  assert.equal(reopened.kind, 'ready');
  if (reopened.kind === 'ready') assert.deepEqual(reopened.game, pitched.kind === 'saved' ? pitched.game : null);
  await database.close();
});

test('a scorer saves a pitch and reopens the same game from a fresh SQLite connection', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'sandlot-offline-'));
  const path = join(directory, 'games.db');
  try {
    const first = connect(path);
    const opened = await openOfflineGame(first, boundary);
    assert.equal(opened.kind, 'ready');
    if (opened.kind !== 'ready') return;
    assert.equal(opened.game, null);
    const started = await opened.record({ kind: 'start' });
    assert.equal(started.kind, 'saved');
    const pitched = await opened.record({ kind: 'pitch', result: 'ball' });
    assert.equal(pitched.kind, 'saved');
    if (pitched.kind !== 'saved') return;
    assert.deepEqual(pitched.game.state.count, { balls: 1, strikes: 0, pitches: 1 });
    assert.equal(pitched.game.waitingPlays, 2);
    assert.equal(pitched.game.context.kind, 'local_demo');
    await first.close();

    const second = connect(path);
    const reopened = await openOfflineGame(second, boundary);
    assert.equal(reopened.kind, 'ready');
    if (reopened.kind !== 'ready') return;
    assert.deepEqual(reopened.game, pitched.game);
    await second.close();
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
