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
import { beginInPlay, completePlay, outcomeChoices, runnerRows } from '../src/scoring/tap-play.ts';

const boundary = { newId: randomUUID, now: () => '2026-10-24T17:00:00.000Z' };

test('delayed tap plays and save retries preserve the original action time in saved events', async () => {
  const database = connect(':memory:');
  let clock = '2026-10-24T17:00:00.000Z';
  const timedBoundary = {newId: randomUUID, now: () => clock};
  const session = await openOfflineGame(database, timedBoundary);
  assert.equal(session.kind, 'ready');
  if (session.kind !== 'ready') throw new Error('Session must open');
  const started = await session.record({kind: 'start'});
  assert.equal(started.kind, 'saved');
  if (started.kind !== 'saved') throw new Error('Game must start');
  clock = '2026-10-24T17:01:00.000Z';
  const draft = beginInPlay(started.game, clock);
  const choice = outcomeChoices.find((choice) => choice.id === 'single')!;
  const bunt = outcomeChoices.find((choice) => choice.id === 'sac-bunt')!;
  const rejectedAction = completePlay({...draft, choice: bunt, step: 'runners', rows: runnerRows(started.game, bunt)});
  assert.ok(rejectedAction);
  clock = '2026-10-24T17:01:20.000Z';
  assert.deepEqual(await session.record(rejectedAction), {kind: 'rejected', code: 'bunting_not_allowed'});
  const action = completePlay({...draft, choice, step: 'runners', rows: runnerRows(started.game, choice)});
  assert.ok(action);
  clock = '2026-10-24T17:01:30.000Z';
  await database.exec("CREATE TRIGGER reject_timed_outbox BEFORE INSERT ON local_outbox BEGIN SELECT RAISE(ABORT, 'save refused'); END");
  assert.deepEqual(await session.record(action), {kind: 'unsaved'});
  await database.exec('DROP TRIGGER reject_timed_outbox');
  clock = '2026-10-24T17:02:00.000Z';
  const retried = await session.record(action);
  assert.equal(retried.kind, 'saved');
  if (retried.kind !== 'saved') throw new Error('Retry must save');
  const savedHit = await database.all<{event_json: string}>('SELECT event_json FROM local_events WHERE seq > ? ORDER BY seq', [started.game.revision]);
  assert.deepEqual(savedHit.map((row) => JSON.parse(row.event_json).at), ['2026-10-24T17:01:00.000Z', '2026-10-24T17:01:00.000Z']);

  clock = '2026-10-24T17:03:00.000Z';
  const runnerDraft = {kind: 'runner' as const, mode: 'steal' as const, at: clock, game: retried.game,
    rows: runnerRows(retried.game, null).map((row) => ({...row, to: 'home' as const}))};
  const rejectedRunnerAction = completePlay(runnerDraft);
  assert.ok(rejectedRunnerAction);
  clock = '2026-10-24T17:03:20.000Z';
  assert.deepEqual(await session.record(rejectedRunnerAction), {kind: 'rejected', code: 'stealing_home_not_allowed'});
  const runnerAction = completePlay({...runnerDraft, rows: runnerDraft.rows.map((row) => ({...row, to: 2}))});
  assert.ok(runnerAction);
  clock = '2026-10-24T17:03:45.000Z';
  const moved = await session.record(runnerAction);
  assert.equal(moved.kind, 'saved');
  if (moved.kind !== 'saved') throw new Error('Runner play must save');
  const savedRunner = await database.all<{event_json: string}>('SELECT event_json FROM local_events WHERE seq > ?', [retried.game.revision]);
  assert.deepEqual(savedRunner.map((row) => JSON.parse(row.event_json).at), ['2026-10-24T17:03:00.000Z']);
  const reopened = await openOfflineGame(database, timedBoundary);
  assert.equal(reopened.kind, 'ready');
  if (reopened.kind === 'ready') assert.deepEqual(reopened.game, moved.game);
  await database.close();
});

test('an attempted new play cannot be mistaken for an older play with the same generated group ID', async () => {
  const database = connect(':memory:');
  let repeatedId: string | null = null;
  const opened = await openOfflineGame(database, {
    ...boundary,
    newId: () => repeatedId ?? randomUUID(),
  });
  assert.equal(opened.kind, 'ready');
  if (opened.kind !== 'ready') return;
  const started = await opened.record({ kind: 'start' });
  repeatedId = (
    await database.all<{ group_id: string }>(
      'SELECT group_id FROM local_outbox',
    )
  )[0]!.group_id;
  assert.deepEqual(await opened.record({ kind: 'pitch', result: 'ball' }), {
    kind: 'unsaved',
  });
  const reopened = await openOfflineGame(database, boundary);
  assert.equal(reopened.kind, 'ready');
  if (reopened.kind === 'ready' && started.kind === 'saved')
    assert.deepEqual(reopened.game, started.game);
  await database.close();
});

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
    const interrupted = spawnSync(
      process.execPath,
      ['--experimental-strip-types', worker, path, 'crash'],
      { encoding: 'utf8' },
    );
    assert.equal(interrupted.status, 67, interrupted.stderr);
    const recovered = connect(path);
    const afterCrash = await openOfflineGame(recovered, boundary);
    assert.equal(afterCrash.kind, 'ready');
    if (afterCrash.kind === 'ready' && started.kind === 'saved')
      assert.deepEqual(afterCrash.game, started.game);
    await recovered.exec('DROP TRIGGER crash_outbox');
    await recovered.close();
    const committed = spawnSync(
      process.execPath,
      ['--experimental-strip-types', worker, path, 'commit'],
      { encoding: 'utf8' },
    );
    assert.equal(committed.status, 0, committed.stderr);
    const fresh = connect(path);
    const afterCommit = await openOfflineGame(fresh, boundary);
    assert.equal(afterCommit.kind, 'ready');
    if (afterCommit.kind === 'ready') {
      assert.deepEqual(afterCommit.game?.state.count, {
        balls: 0,
        strikes: 1,
        pitches: 1,
      });
      assert.equal(afterCommit.game?.waitingPlays, 2);
    }
    await fresh.close();
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
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
    assert.deepEqual(await opened.record({ kind: 'pitch', result: 'ball' }), {
      kind: 'blocked',
      reason: 'storage',
    });
    await other.exec('ROLLBACK');
    await other.close();
    assert.deepEqual(await opened.record({ kind: 'pitch', result: 'ball' }), {
      kind: 'blocked',
      reason: 'storage',
    });
    const reopened = await openOfflineGame(database, boundary);
    assert.equal(reopened.kind, 'ready');
    if (reopened.kind === 'ready') {
      if (started.kind === 'saved')
        assert.deepEqual(reopened.game, started.game);
      const pitch = await reopened.record({ kind: 'pitch', result: 'ball' });
      assert.equal(pitch.kind, 'saved');
      if (pitch.kind === 'saved') assert.equal(pitch.game.waitingPlays, 2);
    }
    await database.close();
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('a local storage format changed after opening blocks scoring without appending a play', async () => {
  const database = connect(':memory:');
  const opened = await openOfflineGame(database, boundary);
  assert.equal(opened.kind, 'ready');
  if (opened.kind !== 'ready') return;
  await opened.record({ kind: 'start' });
  await database.exec('PRAGMA user_version = 2');
  assert.deepEqual(await opened.record({ kind: 'pitch', result: 'ball' }), {
    kind: 'blocked',
    reason: 'version',
  });
  assert.equal(
    (
      await database.all<{ saved: number }>(
        'SELECT count(*) AS saved FROM local_events',
      )
    )[0]!.saved,
    3,
  );
  await database.close();
});

test('a failed outbox insert rolls back the full bootstrap and a later pitch without losing earlier plays', async () => {
  const database = connect(':memory:');
  const opened = await openOfflineGame(database, boundary);
  assert.equal(opened.kind, 'ready');
  if (opened.kind !== 'ready') return;
  const rejectOutbox =
    "CREATE TRIGGER reject_outbox BEFORE INSERT ON local_outbox BEGIN SELECT RAISE(ABORT, 'disk refused play'); END";
  await database.exec(rejectOutbox);
  assert.deepEqual(await opened.record({ kind: 'start' }), { kind: 'unsaved' });
  const empty = await openOfflineGame(database, boundary);
  assert.equal(empty.kind, 'ready');
  if (empty.kind === 'ready') assert.equal(empty.game, null);
  await database.exec('DROP TRIGGER reject_outbox');
  const started = await opened.record({ kind: 'start' });
  assert.equal(started.kind, 'saved');
  await database.exec(rejectOutbox);
  assert.deepEqual(await opened.record({ kind: 'pitch', result: 'ball' }), {
    kind: 'unsaved',
  });
  const unchanged = await openOfflineGame(database, boundary);
  assert.equal(unchanged.kind, 'ready');
  if (unchanged.kind === 'ready' && started.kind === 'saved')
    assert.deepEqual(unchanged.game, started.game);
  await database.exec('DROP TRIGGER reject_outbox');
  const saved = await opened.record({ kind: 'pitch', result: 'called_strike' });
  assert.equal(saved.kind, 'saved');
  if (saved.kind === 'saved') {
    assert.deepEqual(saved.game.state.count, {
      balls: 0,
      strikes: 1,
      pitches: 1,
    });
    assert.equal(saved.game.waitingPlays, 2);
  }
  await database.close();
});

test('walks, strikeouts, and repeated undo use the saved engine history and stop at game setup', async () => {
  const database = connect(':memory:');
  const opened = await openOfflineGame(database, boundary);
  assert.equal(opened.kind, 'ready');
  if (opened.kind !== 'ready') return;
  assert.deepEqual(await opened.record({ kind: 'pitch', result: 'ball' }), {
    kind: 'rejected',
    code: 'game_not_started',
  });
  const started = await opened.record({ kind: 'start' });
  assert.equal(started.kind, 'saved');
  if (started.kind === 'saved') assert.equal(started.game.canUndo, false);
  assert.deepEqual(await opened.record({ kind: 'start' }), started);
  let result: RecordResult = started;
  for (let index = 0; index < 4; index += 1)
    result = await opened.record({ kind: 'pitch', result: 'ball' });
  assert.equal(result.kind, 'saved');
  if (result.kind === 'saved') {
    assert.equal(result.game.state.bases[1]?.player.id, 'away-1');
    assert.equal(result.game.state.nextBatter.away, 1);
    assert.equal(result.game.waitingPlays, 5);
  }
  const beforeUndo = await database.all<{ event_json: string }>(
    'SELECT event_json FROM local_events ORDER BY seq',
  );
  result = await opened.record({ kind: 'undo' });
  assert.equal(result.kind, 'saved');
  if (result.kind === 'saved') {
    assert.deepEqual(result.game.state.count, {
      balls: 3,
      strikes: 0,
      pitches: 3,
    });
    assert.deepEqual(result.game.state.bases, {});
    assert.equal(result.game.waitingPlays, 6);
  }
  const afterUndo = await database.all<{ event_json: string }>(
    'SELECT event_json FROM local_events ORDER BY seq',
  );
  assert.deepEqual(afterUndo.slice(0, beforeUndo.length), beforeUndo);
  for (let index = 0; index < 3; index += 1)
    result = await opened.record({ kind: 'undo' });
  assert.equal(result.kind, 'saved');
  if (result.kind === 'saved') {
    assert.equal(result.game.canUndo, false);
    assert.equal(result.game.state.status, 'in_progress');
    assert.deepEqual(result.game.state.count, {
      balls: 0,
      strikes: 0,
      pitches: 0,
    });
    assert.equal(result.game.waitingPlays, 9);
  }
  assert.deepEqual(await opened.record({ kind: 'undo' }), {
    kind: 'rejected',
    code: 'nothing_to_undo',
  });
  for (let index = 0; index < 3; index += 1)
    result = await opened.record({ kind: 'pitch', result: 'swinging_strike' });
  assert.equal(result.kind, 'saved');
  if (result.kind === 'saved') {
    assert.equal(result.game.state.outs, 1);
    assert.deepEqual(result.game.state.count, {
      balls: 0,
      strikes: 0,
      pitches: 0,
    });
  }
  const reopened = await openOfflineGame(database, boundary);
  assert.equal(reopened.kind, 'ready');
  if (reopened.kind === 'ready' && result.kind === 'saved')
    assert.deepEqual(reopened.game, result.game);
  await database.close();
});

test('rapid taps get an explicit busy result and never duplicate a pitch', async () => {
  const database = connect(':memory:');
  const opened = await openOfflineGame(database, boundary);
  assert.equal(opened.kind, 'ready');
  if (opened.kind !== 'ready') return;
  await opened.record({ kind: 'start' });
  const first = opened.record({ kind: 'pitch', result: 'ball' });
  assert.deepEqual(await opened.record({ kind: 'pitch', result: 'ball' }), {
    kind: 'busy',
  });
  const pitched = await first;
  assert.equal(pitched.kind, 'saved');
  if (pitched.kind === 'saved') assert.equal(pitched.game.state.count.balls, 1);
  const next = await opened.record({ kind: 'pitch', result: 'called_strike' });
  assert.equal(next.kind, 'saved');
  if (next.kind === 'saved') {
    assert.equal(next.game.waitingPlays, 3);
    assert.deepEqual(next.game.state.count, {
      balls: 1,
      strikes: 1,
      pitches: 2,
    });
  }
  await database.close();
});

for (const mutation of [
  {
    sql: "UPDATE local_games SET engine_version = 'future'",
    reason: 'version',
  },
  { sql: 'UPDATE local_games SET schema_version = 999', reason: 'version' },
  { sql: "UPDATE local_games SET setup_json = '{}'", reason: 'corrupt' },
  {
    sql: "UPDATE local_events SET event_json = 'not json' WHERE seq = 1",
    reason: 'corrupt',
  },
  { sql: 'DELETE FROM local_outbox', reason: 'corrupt' },
  { sql: "UPDATE local_outbox SET game_id = 'orphan'", reason: 'corrupt' },
  {
    sql: "UPDATE local_events SET game_id = 'orphan' WHERE seq = 2",
    reason: 'corrupt',
  },
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
    const before = await database.all(
      'SELECT * FROM local_events ORDER BY seq',
    );
    assert.deepEqual(await openOfflineGame(database, boundary), {
      kind: 'blocked',
      reason: mutation.reason,
    });
    assert.deepEqual(await opened.record({ kind: 'pitch', result: 'ball' }), {
      kind: 'blocked',
      reason: mutation.reason,
    });
    assert.deepEqual(
      await database.all('SELECT * FROM local_events ORDER BY seq'),
      before,
    );
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
      if (loseCompletion) {
        loseCompletion = false;
        throw new Error('Commit response lost');
      }
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
  if (reopened.kind === 'ready')
    assert.deepEqual(
      reopened.game,
      pitched.kind === 'saved' ? pitched.game : null,
    );
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
    assert.deepEqual(pitched.game.state.count, {
      balls: 1,
      strikes: 0,
      pitches: 1,
    });
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

async function scoringSession() {
  const database = connect(':memory:');
  const opened = await openOfflineGame(database, boundary);
  assert.equal(opened.kind, 'ready');
  if (opened.kind !== 'ready') throw new Error('Session must open');
  const started = await opened.record({ kind: 'start' });
  assert.equal(started.kind, 'saved');
  if (started.kind !== 'saved') throw new Error('Game must start');
  let game = started.game;
  return {
    database,
    session: opened,
    get game() { return game; },
    async save(action: Parameters<typeof opened.record>[0]) {
      const result = await opened.record(action);
      assert.equal(result.kind, 'saved', JSON.stringify(result));
      if (result.kind !== 'saved') throw new Error('Expected saved play');
      game = result.game;
      return game;
    },
  };
}

test('a selected double is one atomic play and whole-play undo survives reopening', async () => {
  const scorer = await scoringSession();
  await scorer.save({ kind: 'ball_in_play', at: boundary.now(), expectedRevision: scorer.game.revision,
    outcome: 'single', trajectory: null, fielders: ['CF'], advances: [] });
  const before = scorer.game;
  const runner = before.state.bases[1]!.player;
  await scorer.save({ kind: 'ball_in_play', at: boundary.now(), expectedRevision: before.revision,
    outcome: 'double', trajectory: null, fielders: ['RF'], advances: [{ runner, to: 'home' }] });
  assert.equal(scorer.game.state.score.away, 1);
  assert.equal(scorer.game.state.bases[2]?.player.id, 'away-2');
  assert.equal(scorer.game.state.pitchCounts['home-1'], 2);
  assert.equal(scorer.game.waitingPlays, before.waitingPlays + 1);
  const groups = await scorer.database.all<{event_count:number}>('SELECT event_count FROM local_outbox ORDER BY first_seq');
  assert.deepEqual(groups.map((group) => group.event_count), [3, 2, 2]);
  const reopened = await openOfflineGame(scorer.database, boundary);
  assert.equal(reopened.kind, 'ready');
  if (reopened.kind !== 'ready') return;
  assert.deepEqual(reopened.game, scorer.game);
  const undone = await reopened.record({ kind: 'undo' });
  assert.equal(undone.kind, 'saved');
  if (undone.kind === 'saved') assert.deepEqual(undone.game.state, before.state);
  const final = await openOfflineGame(scorer.database, boundary);
  assert.equal(final.kind, 'ready');
  if (final.kind === 'ready' && undone.kind === 'saved') assert.deepEqual(final.game, undone.game);
  await scorer.database.close();
});

test('an invalid second in-play command, collision, bunt and stale draft append nothing', async () => {
  const scorer = await scoringSession();
  await scorer.save({ kind: 'ball_in_play', at: boundary.now(), expectedRevision: scorer.game.revision,
    outcome: 'single', trajectory: null, fielders: [], advances: [] });
  const before = scorer.game;
  const action = { kind: 'ball_in_play' as const, at: boundary.now(), expectedRevision: before.revision,
    outcome: 'single' as const, trajectory: null, fielders: [], advances: [] };
  assert.deepEqual(await scorer.session.record(action), {kind:'rejected',code:'base_occupied'});
  assert.deepEqual(await scorer.session.record({...action, outcome:'sacrifice_bunt',trajectory:'bunt'}),
    {kind:'rejected',code:'bunting_not_allowed'});
  assert.deepEqual(await scorer.session.record({...action, outcome:'double_play'}),
    {kind:'rejected',code:'batter_destination_missing'});
  assert.deepEqual(await scorer.session.record({...action, expectedRevision: before.revision - 1}), {kind:'stale',game:before});
  const reopened = await openOfflineGame(scorer.database, boundary);
  assert.equal(reopened.kind, 'ready');
  if (reopened.kind === 'ready') assert.deepEqual(reopened.game, before);
  await scorer.database.close();
});

test('two aboard lets the scorer choose the runner and multiple runner moves remain one play', async () => {
  const scorer = await scoringSession();
  await scorer.save({kind:'ball_in_play',at:boundary.now(),expectedRevision:scorer.game.revision,
    outcome:'double',trajectory:null,fielders:[],advances:[]});
  await scorer.save({kind:'ball_in_play',at:boundary.now(),expectedRevision:scorer.game.revision,
    outcome:'single',trajectory:null,fielders:[],advances:[]});
  const before = scorer.game;
  const lead = before.state.bases[2]!.player;
  const trail = before.state.bases[1]!.player;
  await scorer.save({kind:'runner_play',at:boundary.now(),expectedRevision:before.revision,event:'passed_ball',
    moves:[{runner:trail,to:2},{runner:lead,to:'home'}]});
  assert.equal(scorer.game.state.score.away, 1);
  assert.equal(scorer.game.state.bases[2]?.player.id, trail.id);
  assert.equal(scorer.game.state.pitchCounts['home-1'], 2);
  assert.equal(scorer.game.waitingPlays, before.waitingPlays + 1);
  await scorer.save({kind:'undo'});
  assert.deepEqual(scorer.game.state, before.state);
  await scorer.save({kind:'runner_play',at:boundary.now(),expectedRevision:scorer.game.revision,event:'steal',moves:[{runner:trail,to:'out'}]});
  assert.equal(scorer.game.state.outs, 1);
  assert.equal(scorer.game.state.bases[2]?.player.id, lead.id);
  assert.equal(scorer.game.state.bases[1], undefined);
  await scorer.database.close();
});

for (const outType of ['force', 'non_force'] as const) {
  test(`an explicit ${outType} third out adjudicates the selected crossing from real saved history`, async () => {
    const scorer = await scoringSession();
    for (let count = 0; count < 6; count++) await scorer.save({kind:'pitch',result:'called_strike'});
    await scorer.save({kind:'ball_in_play',at:boundary.now(),expectedRevision:scorer.game.revision,
      outcome:'triple',trajectory:null,fielders:[],advances:[]});
    await scorer.save({kind:'ball_in_play',at:boundary.now(),expectedRevision:scorer.game.revision,
      outcome:'single',trajectory:null,fielders:[],advances:[]});
    const before = scorer.game;
    await scorer.save({kind:'ball_in_play',at:boundary.now(),expectedRevision:before.revision,
      outcome:'fielders_choice',trajectory:'ground',fielders:['SS'],advances:[
        {runner:before.state.bases[3]!.player,to:'home'},
        {runner:before.state.bases[1]!.player,to:'out',outType},
      ]});
    assert.equal(scorer.game.state.score.away, outType === 'force' ? 0 : 1);
    assert.equal(scorer.game.state.half, 'bottom');
    await scorer.save({kind:'undo'});
    assert.deepEqual(scorer.game.state, before.state);
    await scorer.database.close();
  });
}

test('real pitcher threshold alerts persist and whole-play undo restores the previous alerts', async () => {
  const scorer = await scoringSession();
  for (let count = 0; count < 64; count++) await scorer.save({kind:'pitch',result:'foul'});
  const before = scorer.game;
  await scorer.save({kind:'ball_in_play',at:boundary.now(),expectedRevision:before.revision,
    outcome:'single',trajectory:null,fielders:[],advances:[]});
  assert.ok(scorer.game.state.alerts.some((alert) => alert.kind === 'pitch_count_near_limit'));
  const reopened = await openOfflineGame(scorer.database,boundary);
  assert.equal(reopened.kind,'ready');
  if(reopened.kind === 'ready') assert.deepEqual(reopened.game,scorer.game);
  await scorer.save({kind:'undo'});
  assert.deepEqual(scorer.game.state,before.state);
  await scorer.database.close();
});

test('a runner play with a failing later move and an in-play outbox failure each roll back the whole play', async () => {
  const scorer = await scoringSession();
  await scorer.save({kind:'ball_in_play',at:boundary.now(),expectedRevision:scorer.game.revision,
    outcome:'double',trajectory:null,fielders:[],advances:[]});
  await scorer.save({kind:'ball_in_play',at:boundary.now(),expectedRevision:scorer.game.revision,
    outcome:'single',trajectory:null,fielders:[],advances:[]});
  const before = scorer.game;
  assert.deepEqual(await scorer.session.record({kind:'runner_play',at:boundary.now(),expectedRevision:before.revision,
    event:'wild_pitch',moves:[{runner:before.state.bases[2]!.player,to:3},{runner:before.state.bases[1]!.player,to:3}]}),
    {kind:'rejected',code:'base_occupied'});
  await scorer.database.exec("CREATE TRIGGER reject_play_outbox BEFORE INSERT ON local_outbox BEGIN SELECT RAISE(ABORT, 'disk refused play'); END");
  assert.deepEqual(await scorer.session.record({kind:'ball_in_play',at:boundary.now(),expectedRevision:before.revision,
    outcome:'home_run',trajectory:null,fielders:[],advances:[
      {runner:before.state.bases[1]!.player,to:'home'}, {runner:before.state.bases[2]!.player,to:'home'},
    ]}), {kind:'unsaved'});
  const reopened = await openOfflineGame(scorer.database,boundary);
  assert.equal(reopened.kind,'ready');
  if(reopened.kind === 'ready') assert.deepEqual(reopened.game,before);
  await scorer.database.close();
});

test('an earlier force followed by a non-force third out retains the eligible crossing', async () => {
  const scorer = await scoringSession();
  for(let count = 0;count < 3;count++) await scorer.save({kind:'pitch',result:'called_strike'});
  for(let count = 0;count < 12;count++) await scorer.save({kind:'pitch',result:'ball'});
  const before = scorer.game;
  await scorer.save({kind:'ball_in_play',at:boundary.now(),expectedRevision:before.revision,
    outcome:'fielders_choice',trajectory:'ground',fielders:['SS'],advances:[
      {runner:before.state.bases[3]!.player,to:'home'},
      {runner:before.state.bases[1]!.player,to:'out',outType:'force'},
      {runner:before.state.bases[2]!.player,to:'out',outType:'non_force'},
    ]});
  assert.equal(scorer.game.state.score.away,1);
  await scorer.save({kind:'undo'});
  assert.deepEqual(scorer.game.state,before.state);
  await scorer.database.close();
});

test('safe steals, pickoffs and the exact pitch limit use the existing engine commands', async () => {
  const scorer = await scoringSession();
  await scorer.save({kind:'ball_in_play',at:boundary.now(),expectedRevision:scorer.game.revision,
    outcome:'single',trajectory:null,fielders:[],advances:[]});
  const runner = scorer.game.state.bases[1]!.player;
  await scorer.save({kind:'runner_play',at:boundary.now(),expectedRevision:scorer.game.revision,event:'steal',moves:[{runner,to:2}]});
  assert.equal(scorer.game.state.bases[2]?.player.id,runner.id);
  await scorer.save({kind:'runner_play',at:boundary.now(),expectedRevision:scorer.game.revision,event:'pickoff',moves:[{runner,to:'out'}]});
  assert.equal(scorer.game.state.outs,1);
  assert.deepEqual(scorer.game.state.bases,{});
  for(let count = 1;count < 75;count++) await scorer.save({kind:'pitch',result:'foul'});
  assert.ok(scorer.game.state.alerts.some((alert) => alert.kind === 'pitch_count_at_limit'));
  await scorer.save({kind:'undo'});
  assert.ok(!scorer.game.state.alerts.some((alert) => alert.kind === 'pitch_count_at_limit'));
  await scorer.database.close();
});

test('a draft from another committed revision returns the fresh game without scoring a different batter', async () => {
  const scorer = await scoringSession();
  const revision = scorer.game.revision;
  await scorer.save({kind:'ball_in_play',at:boundary.now(),expectedRevision:revision,
    outcome:'single',trajectory:null,fielders:[],advances:[]});
  assert.deepEqual(await scorer.session.record({kind:'ball_in_play',at:boundary.now(),expectedRevision:revision,
    outcome:'double',trajectory:null,fielders:[],advances:[]}), {kind:'stale',game:scorer.game});
  const reopened = await openOfflineGame(scorer.database,boundary);
  assert.equal(reopened.kind,'ready');
  if(reopened.kind === 'ready') assert.deepEqual(reopened.game,scorer.game);
  await scorer.database.close();
});
