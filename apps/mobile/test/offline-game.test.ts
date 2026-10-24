import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { openOfflineGame } from '../src/scoring/offline-game.ts';
import type { RecordResult } from '../src/scoring/offline-game.ts';
import type { SqlDatabase } from '../src/scoring/database.ts';
import { connect } from './database.ts';

const boundary = { newId: randomUUID, now: () => '2026-10-24T17:00:00.000Z' };

test('an interrupted process loses no earlier plays and a committed process survives a fresh open', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'sandlot-crash-'));
  const path = join(directory, 'games.db');
  try {
    const initial = connect(path);
    const opened = await openOfflineGame(initial, boundary);
    assert.equal(opened.kind, 'ready');
    if (opened.kind !== 'ready') return;
    const started = await opened.record({ kind: 'start' });
    await initial.close();
    const worker = fileURLToPath(new URL('./crash-worker.ts', import.meta.url));
    const interrupted = spawnSync(process.execPath, ['--experimental-strip-types', worker, path, 'crash'], { encoding: 'utf8' });
    assert.equal(interrupted.status, 67, interrupted.stderr);
    const recovered = connect(path);
    const afterCrash = await openOfflineGame(recovered, boundary);
    assert.equal(afterCrash.kind, 'ready');
    if (afterCrash.kind === 'ready' && started.kind === 'saved') assert.deepEqual(afterCrash.game, started.game);
    await recovered.exec('DROP TRIGGER crash_outbox');
    await recovered.close();
    const committed = spawnSync(process.execPath, ['--experimental-strip-types', worker, path, 'commit'], { encoding: 'utf8' });
    assert.equal(committed.status, 0, committed.stderr);
    const fresh = connect(path);
    const afterCommit = await openOfflineGame(fresh, boundary);
    assert.equal(afterCommit.kind, 'ready');
    if (afterCommit.kind === 'ready') {
      assert.deepEqual(afterCommit.game?.state.count, { balls: 0, strikes: 1, pitches: 1 });
      assert.equal(afterCommit.game?.waitingPlays, 2);
    }
    await fresh.close();
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('a competing SQLite writer cannot create a duplicate sequence or report a saved pitch', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'sandlot-competing-'));
  const path = join(directory, 'games.db');
  try {
    const database = connect(path);
    const opened = await openOfflineGame(database, boundary);
    assert.equal(opened.kind, 'ready');
    if (opened.kind !== 'ready') return;
    const started = await opened.record({ kind: 'start' });
    const other = connect(path);
    await other.exec('BEGIN IMMEDIATE');
    assert.deepEqual(await opened.record({ kind: 'pitch', result: 'ball' }), { kind: 'blocked', reason: 'storage' });
    await other.exec('ROLLBACK');
    await other.close();
    assert.deepEqual(await opened.record({ kind: 'pitch', result: 'ball' }), { kind: 'blocked', reason: 'storage' });
    const reopened = await openOfflineGame(database, boundary);
    assert.equal(reopened.kind, 'ready');
    if (reopened.kind === 'ready') {
      if (started.kind === 'saved') assert.deepEqual(reopened.game, started.game);
      const pitch = await reopened.record({ kind: 'pitch', result: 'ball' });
      assert.equal(pitch.kind, 'saved');
      if (pitch.kind === 'saved') assert.equal(pitch.game.waitingPlays, 2);
    }
    await database.close();
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('a local storage format changed after opening blocks scoring without appending a play', async () => {
  const database = connect(':memory:');
  const opened = await openOfflineGame(database, boundary);
  assert.equal(opened.kind, 'ready');
  if (opened.kind !== 'ready') return;
  await opened.record({ kind: 'start' });
  await database.exec('PRAGMA user_version = 2');
  assert.deepEqual(await opened.record({ kind: 'pitch', result: 'ball' }), { kind: 'blocked', reason: 'version' });
  assert.equal((await database.all<{ saved: number }>('SELECT count(*) AS saved FROM local_events'))[0]!.saved, 3);
  await database.close();
});

test('a failed outbox insert rolls back the full bootstrap and a later pitch without losing earlier plays', async () => {
  const database = connect(':memory:');
  const opened = await openOfflineGame(database, boundary);
  assert.equal(opened.kind, 'ready');
  if (opened.kind !== 'ready') return;
  const rejectOutbox = "CREATE TRIGGER reject_outbox BEFORE INSERT ON local_outbox BEGIN SELECT RAISE(ABORT, 'disk refused play'); END";
  await database.exec(rejectOutbox);
  assert.deepEqual(await opened.record({ kind: 'start' }), { kind: 'unsaved' });
  const empty = await openOfflineGame(database, boundary);
  assert.equal(empty.kind, 'ready');
  if (empty.kind === 'ready') assert.equal(empty.game, null);
  await database.exec('DROP TRIGGER reject_outbox');
  const started = await opened.record({ kind: 'start' });
  assert.equal(started.kind, 'saved');
  await database.exec(rejectOutbox);
  assert.deepEqual(await opened.record({ kind: 'pitch', result: 'ball' }), { kind: 'unsaved' });
  const unchanged = await openOfflineGame(database, boundary);
  assert.equal(unchanged.kind, 'ready');
  if (unchanged.kind === 'ready' && started.kind === 'saved') assert.deepEqual(unchanged.game, started.game);
  await database.exec('DROP TRIGGER reject_outbox');
  const saved = await opened.record({ kind: 'pitch', result: 'called_strike' });
  assert.equal(saved.kind, 'saved');
  if (saved.kind === 'saved') {
    assert.deepEqual(saved.game.state.count, { balls: 0, strikes: 1, pitches: 1 });
    assert.equal(saved.game.waitingPlays, 2);
  }
  await database.close();
});

test('walks, strikeouts, and repeated undo use the saved engine history and stop at game setup', async () => {
  const database = connect(':memory:');
  const opened = await openOfflineGame(database, boundary);
  assert.equal(opened.kind, 'ready');
  if (opened.kind !== 'ready') return;
  assert.deepEqual(await opened.record({ kind: 'pitch', result: 'ball' }), { kind: 'rejected', code: 'game_not_started' });
  const started = await opened.record({ kind: 'start' });
  assert.equal(started.kind, 'saved');
  if (started.kind === 'saved') assert.equal(started.game.canUndo, false);
  assert.deepEqual(await opened.record({ kind: 'start' }), started);
  let result: RecordResult = started;
  for (let index = 0; index < 4; index += 1) result = await opened.record({ kind: 'pitch', result: 'ball' });
  assert.equal(result.kind, 'saved');
  if (result.kind === 'saved') {
    assert.equal(result.game.state.bases[1]?.player.id, 'away-1');
    assert.equal(result.game.state.nextBatter.away, 1);
    assert.equal(result.game.waitingPlays, 5);
  }
  const beforeUndo = await database.all<{ event_json: string }>('SELECT event_json FROM local_events ORDER BY seq');
  result = await opened.record({ kind: 'undo' });
  assert.equal(result.kind, 'saved');
  if (result.kind === 'saved') {
    assert.deepEqual(result.game.state.count, { balls: 3, strikes: 0, pitches: 3 });
    assert.deepEqual(result.game.state.bases, {});
    assert.equal(result.game.waitingPlays, 6);
  }
  const afterUndo = await database.all<{ event_json: string }>('SELECT event_json FROM local_events ORDER BY seq');
  assert.deepEqual(afterUndo.slice(0, beforeUndo.length), beforeUndo);
  for (let index = 0; index < 3; index += 1) result = await opened.record({ kind: 'undo' });
  assert.equal(result.kind, 'saved');
  if (result.kind === 'saved') {
    assert.equal(result.game.canUndo, false);
    assert.equal(result.game.state.status, 'in_progress');
    assert.deepEqual(result.game.state.count, { balls: 0, strikes: 0, pitches: 0 });
    assert.equal(result.game.waitingPlays, 9);
  }
  assert.deepEqual(await opened.record({ kind: 'undo' }), { kind: 'rejected', code: 'nothing_to_undo' });
  for (let index = 0; index < 3; index += 1) result = await opened.record({ kind: 'pitch', result: 'swinging_strike' });
  assert.equal(result.kind, 'saved');
  if (result.kind === 'saved') {
    assert.equal(result.game.state.outs, 1);
    assert.deepEqual(result.game.state.count, { balls: 0, strikes: 0, pitches: 0 });
  }
  const reopened = await openOfflineGame(database, boundary);
  assert.equal(reopened.kind, 'ready');
  if (reopened.kind === 'ready' && result.kind === 'saved') assert.deepEqual(reopened.game, result.game);
  await database.close();
});

test('rapid taps get an explicit busy result and never duplicate a pitch', async () => {
  const database = connect(':memory:');
  const opened = await openOfflineGame(database, boundary);
  assert.equal(opened.kind, 'ready');
  if (opened.kind !== 'ready') return;
  await opened.record({ kind: 'start' });
  const first = opened.record({ kind: 'pitch', result: 'ball' });
  assert.deepEqual(await opened.record({ kind: 'pitch', result: 'ball' }), { kind: 'busy' });
  const pitched = await first;
  assert.equal(pitched.kind, 'saved');
  if (pitched.kind === 'saved') assert.equal(pitched.game.state.count.balls, 1);
  const next = await opened.record({ kind: 'pitch', result: 'called_strike' });
  assert.equal(next.kind, 'saved');
  if (next.kind === 'saved') {
    assert.equal(next.game.waitingPlays, 3);
    assert.deepEqual(next.game.state.count, { balls: 1, strikes: 1, pitches: 2 });
  }
  await database.close();
});

for (const mutation of [
  { sql: "UPDATE local_games SET engine_version = 'future'", reason: 'version' },
  { sql: 'UPDATE local_games SET schema_version = 999', reason: 'version' },
  { sql: "UPDATE local_games SET setup_json = '{}'", reason: 'corrupt' },
  { sql: "UPDATE local_events SET event_json = 'not json' WHERE seq = 1", reason: 'corrupt' },
  { sql: 'DELETE FROM local_outbox', reason: 'corrupt' },
  { sql: 'UPDATE local_outbox SET event_count = 99', reason: 'corrupt' },
  { sql: 'UPDATE local_events SET seq = 99 WHERE seq = 2', reason: 'corrupt' },
]) {
  test(`saved data blocks rather than resets after ${mutation.sql}`, async () => {
    const database = connect(':memory:');
    const opened = await openOfflineGame(database, boundary);
    assert.equal(opened.kind, 'ready');
    if (opened.kind !== 'ready') return;
    await opened.record({ kind: 'start' });
    await database.exec(mutation.sql);
    const before = await database.all('SELECT * FROM local_events ORDER BY seq');
    assert.deepEqual(await openOfflineGame(database, boundary), { kind: 'blocked', reason: mutation.reason });
    assert.deepEqual(await opened.record({ kind: 'pitch', result: 'ball' }), { kind: 'blocked', reason: mutation.reason });
    assert.deepEqual(await database.all('SELECT * FROM local_events ORDER BY seq'), before);
    await database.close();
  });
}

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
