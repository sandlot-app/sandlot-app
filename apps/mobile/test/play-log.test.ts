import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { demoLineups } from '../src/scoring/demo-game.ts';
import { openOfflineGame, type DemoAction, type SavedGame } from '../src/scoring/offline-game.ts';
import { playLog } from '../src/scoring/play-log.ts';
import { connect } from './database.ts';

const at = '2026-10-26T17:01:00.000Z';

async function scorer() {
  const session = await openOfflineGame(connect(':memory:'), { newId: randomUUID, now: () => '2026-10-26T17:00:00.000Z' });
  if (session.kind !== 'ready') throw new Error('Session must open');
  let game: SavedGame | null = null;
  const save = async (action: DemoAction | ((game: SavedGame) => DemoAction)) => {
    const result = await session.record(typeof action === 'function' ? action(game!) : action);
    if (result.kind !== 'saved') throw new Error(`The play must save: ${JSON.stringify(result)}`);
    game = result.game;
    return game;
  };
  await save({ kind: 'start' });
  return { save, game: () => game! };
}

const inPlay = (outcome: 'single' | 'double' | 'out', fielder: 'CF' | 'RF' | 'LF', extra: Partial<Extract<DemoAction, { kind: 'ball_in_play' }>> = {}) =>
  (game: SavedGame): DemoAction => ({ kind: 'ball_in_play', at, expectedRevision: game.revision, outcome,
    trajectory: outcome === 'out' ? 'fly' : null, fielders: [fielder], advances: [], ...extra });

test('a walk, a strikeout and a hit by pitch read as finished plate appearances, not batters still up', async () => {
  const { save } = await scorer();
  for (let pitch = 0; pitch < 4; pitch += 1) await save({ kind: 'pitch', result: 'ball' });
  for (let pitch = 0; pitch < 3; pitch += 1) await save({ kind: 'pitch', result: 'called_strike' });
  const game = await save({ kind: 'pitch', result: 'hit_by_pitch' });
  const [top] = playLog(game);
  assert.equal(top?.label, 'Top 1');
  assert.deepEqual(top.atBats.map((atBat) => [atBat.title, atBat.inProgress, atBat.count, atBat.kind]), [
    ['S. Bell is hit by a pitch. K. Moss to 2nd.', false, '0–0', 'in_play'],
    ['J. Ruiz strikes out looking.', false, '0–3', 'out'],
    ['K. Moss walks.', false, '4–0', 'in_play'],
  ]);
  assert.equal(top.atBats[0]!.detail, '1 out · runners on 1st and 2nd');
  assert.deepEqual(top.atBats[2]!.rows.map((row) => [row.number, row.mark, row.label, row.count]), [
    [1, 'ball', 'Ball', '1–0'], [2, 'ball', 'Ball', '2–0'], [3, 'ball', 'Ball', '3–0'], [4, 'ball', 'Ball', '4–0'],
  ]);
});

test('undoing the third out keeps the restored half current, and the half it left does not show', async () => {
  const { save } = await scorer();
  for (let pitch = 0; pitch < 9; pitch += 1) await save({ kind: 'pitch', result: 'called_strike' });
  assert.deepEqual(playLog((await save({ kind: 'pitch', result: 'ball' }))).map((half) => [half.label, half.current]),
    [['Bottom 1', true], ['Top 1', false]]);
  await save({ kind: 'undo' });
  const game = await save({ kind: 'undo' });
  assert.equal(game.state.half, 'top');
  assert.equal(game.state.outs, 2);
  const log = playLog(game);
  assert.deepEqual(log.map((half) => [half.label, half.current]), [['Top 1', true]]);
  const [up] = log[0]!.atBats;
  assert.equal(up?.title, 'S. Bell at bat');
  assert.equal(up.inProgress, true);
  assert.equal(up.count, '0–2');
  assert.deepEqual(up.rows.map((row) => [row.number, row.label, row.count, row.undone]), [
    [1, 'Strike looking', '0–1', false], [2, 'Strike looking', '0–2', false], [null, 'Strike looking', '0–3', true],
  ]);
});

test('a hit names the batter, the fielder and the runners it moved, and a run shows the new score', async () => {
  const { save } = await scorer();
  await save({ kind: 'pitch', result: 'ball' });
  await save(inPlay('single', 'CF'));
  await save({ kind: 'pitch', result: 'called_strike' });
  const game = await save((current) => inPlay('double', 'RF', { advances: [{ runner: current.state.bases[1]!.player, to: 'home' }] })(current));
  const [top] = playLog(game);
  const [double, single] = top!.atBats;
  assert.equal(double?.title, 'J. Ruiz doubles to right. K. Moss scores.');
  assert.equal(double.kind, 'run');
  assert.equal(double.score, '1 – 0');
  assert.equal(double.count, '0–1');
  assert.equal(double.detail, '0 outs · runner on 2nd');
  assert.deepEqual(double.rows.map((row) => [row.number, row.mark, row.label, row.count]),
    [[1, 'strike', 'Strike looking', '0–1'], [2, 'in_play', 'In play', null]]);
  assert.equal(single?.title, 'K. Moss singles to center.');
  assert.equal(single.count, '1–0');
  assert.equal(top!.totals, '1 R · 2 H');
});

test('the batter still up shows the pitcher’s pitch number, the count and the runners', async () => {
  const { save } = await scorer();
  await save(inPlay('single', 'LF'));
  const game = await save({ kind: 'pitch', result: 'foul' });
  const [up] = playLog(game)[0]!.atBats;
  assert.equal(up?.title, 'J. Ruiz at bat');
  assert.equal(up.detail, 'Pitch 2 · runner on 1st');
  assert.equal(up.count, '0–1');
  assert.deepEqual(up.rows.map((row) => row.mark), ['foul']);
});

test('a new half with no plays yet is current and empty, and the finished half shows its errors too', async () => {
  const { save } = await scorer();
  for (let out = 0; out < 3; out += 1) await save(inPlay('out', 'RF'));
  await save({ kind: 'undo' });
  const log = playLog(await save(inPlay('out', 'RF')));
  assert.deepEqual(log.map((half) => [half.label, half.batting, half.current, half.atBats.length]),
    [['Bottom 1', 'Marlins', true, 0], ['Top 1', 'Hawks', false, 3]]);
  assert.equal(log[1]!.totals, '0 R · 0 H · 0 E');
  assert.equal(log[1]!.atBats[0]!.title, 'S. Bell flies out to right.');
  assert.equal(log[1]!.atBats[0]!.detail, '3 outs');
  assert.deepEqual(log[1]!.atBats[0]!.rows.map((row) => [row.number, row.label, row.undone]),
    [[null, 'In play · Fly out', true], [1, 'In play', false]]);
});

test('undoing back past a whole at-bat resumes the earlier batter’s at-bat and drops the one that never happened', async () => {
  const { save } = await scorer();
  await save(inPlay('single', 'CF'));
  await save({ kind: 'pitch', result: 'ball' });
  await save({ kind: 'undo' });
  await save({ kind: 'undo' });
  const game = await save({ kind: 'pitch', result: 'ball' });
  const [top] = playLog(game);
  assert.deepEqual(top!.atBats.map((atBat) => atBat.title), ['K. Moss at bat']);
  assert.deepEqual(top!.atBats[0]!.rows.map((row) => [row.number, row.label, row.undone]),
    [[null, 'In play · Single', true], [1, 'Ball', false]]);
});

test('a runner play during an at-bat is a row in that at-bat', async () => {
  const { save } = await scorer();
  await save(inPlay('single', 'CF'));
  await save({ kind: 'pitch', result: 'ball' });
  const game = await save((current) => ({ kind: 'runner_play', at, expectedRevision: current.revision, event: 'steal',
    moves: [{ runner: current.state.bases[1]!.player, to: 2 }] }));
  const [up] = playLog(game)[0]!.atBats;
  assert.equal(up?.title, 'J. Ruiz at bat');
  assert.deepEqual(up.rows.map((row) => [row.number, row.mark, row.label, row.count]),
    [[1, 'ball', 'Ball', '1–0'], [null, null, 'K. Moss steals 2nd', null]]);
  assert.equal(up.detail, 'Pitch 2 · runner on 2nd');
});

test('a game started from chosen lineups reads its own batting order, and an undo leaves the saved history and a reopened log the same', async () => {
  const database = connect(':memory:');
  const opened = await openOfflineGame(database, { newId: randomUUID, now: () => '2026-10-26T17:00:00.000Z' });
  if (opened.kind !== 'ready') throw new Error('Session must open');
  const hawks = [...demoLineups.away].reverse();
  const started = await opened.record({ kind: 'start', half: 'first', lineups: { away: hawks, home: demoLineups.home } });
  if (started.kind !== 'saved') throw new Error('The game must start');
  for (let pitch = 0; pitch < 3; pitch += 1) await opened.record({ kind: 'pitch', result: 'called_strike' });
  await opened.record({ kind: 'pitch', result: 'ball' });
  const before = await database.all('SELECT * FROM local_events ORDER BY seq');
  const undone = await opened.record({ kind: 'undo' });
  if (undone.kind !== 'saved') throw new Error('The undo must save');

  const [top] = playLog(undone.game);
  assert.deepEqual(top!.atBats.map((atBat) => [atBat.title, atBat.inProgress]),
    [['E. Brooks at bat', true], ['B. Lane strikes out looking.', false]], 'B. Lane leads off this lineup');
  assert.deepEqual(top!.atBats[0]!.rows.map((row) => [row.label, row.undone]), [['Ball', true]]);
  assert.deepEqual((await database.all('SELECT * FROM local_events ORDER BY seq')).slice(0, before.length), before);

  const reopened = await openOfflineGame(database, { newId: randomUUID, now: () => '2026-10-26T17:05:00.000Z' });
  if (reopened.kind !== 'ready' || !reopened.game) throw new Error('The game must reopen');
  assert.deepEqual(playLog(reopened.game), playLog(undone.game));
  await database.close();
});
