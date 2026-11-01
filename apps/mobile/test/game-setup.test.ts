import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { presets } from '@sandlot/engine';
import type { LineupSlot, PlayerRef, Position } from '@sandlot/engine';
import { openOfflineGame } from '../src/scoring/offline-game.ts';
import {
  addFromRoster,
  benchPlayers,
  canStart,
  lineupSummary,
  movePlayer,
  newSetupDraft,
  positionLabel,
  saveLineup,
  seasonHalfNote,
  seasonHalfOn,
  setPosition,
  setStartingPitcher,
  startAction,
  startingPitcher,
} from '../src/scoring/game-setup.ts';
import { connect } from './database.ts';

const boundary = { newId: randomUUID, now: () => '2026-10-24T18:30:00.000Z' };
const player = (id: string): PlayerRef => ({ kind: 'player', id } as PlayerRef);
const opponent = (id: string): PlayerRef => ({ kind: 'opponent', id } as PlayerRef);
const ids = (slots: LineupSlot[]) => slots.map((slot) => [slot.player.id, slot.position]);
const awayLineup: LineupSlot[] = (['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'] as Position[])
  .map((position, index) => ({ player: opponent(`away-${index + 1}`), position }));

async function open(database = connect(':memory:')) {
  const session = await openOfflineGame(database, boundary);
  if (session.kind !== 'ready') throw new Error('Session must open');
  return { database, session };
}

test('starting a game saves its season half and both lineups once, and reopening rebuilds the same game', async () => {
  const { database, session } = await open();
  const home: LineupSlot[] = [
    { player: player('home-8'), position: 'CF' },
    { player: player('home-1'), position: 'P' },
    { player: player('home-10'), position: null },
  ];
  const started = await session.record({ kind: 'start', half: 'first', lineups: { home, away: awayLineup } });
  assert.equal(started.kind, 'saved');
  if (started.kind !== 'saved') return;
  assert.deepEqual(started.game.setup.rules, presets['moraga-mustang-first-half']);
  assert.deepEqual(ids(started.game.state.lineups.home), [['home-8', 'CF'], ['home-1', 'P'], ['home-10', null]]);
  assert.deepEqual(started.game.state.pitchers.home, player('home-1'));
  assert.equal(started.game.canUndo, false);

  const stored = await database.all<{ event_json: string }>('SELECT event_json FROM local_events ORDER BY seq');
  assert.deepEqual(stored.map((row) => JSON.parse(row.event_json).command.control.kind), ['lineup_set', 'lineup_set', 'start']);
  const saved = JSON.stringify(await database.all('SELECT * FROM local_games')) + JSON.stringify(stored);
  for (const name of ['Nguyen', 'Moss', 'Lane', 'Hawks', 'Marlins']) assert.ok(!saved.includes(name), `${name} must not be saved`);

  const again = await session.record({ kind: 'start', half: 'second', lineups: { home: awayLineup, away: awayLineup } });
  assert.deepEqual(again, started, 'a second start keeps the saved game');

  const reopened = await open(database);
  assert.deepEqual(reopened.session.kind === 'ready' && reopened.session.game, started.game);
  await database.close();
});

test('a start without a chosen setup uses the second-half sample game', async () => {
  const { database, session } = await open();
  const started = await session.record({ kind: 'start' });
  assert.equal(started.kind, 'saved');
  if (started.kind !== 'saved') return;
  assert.deepEqual(started.game.setup.rules, presets['moraga-mustang-second-half']);
  assert.equal(started.game.state.lineups.home.length, 10);
  await database.close();
});

test('an illegal or incomplete setup is refused with the engine reason and saves nothing', async () => {
  const { database, session } = await open();
  const noPitcher = awayLineup.map((slot) => ({ ...slot, position: slot.position === 'P' ? null : slot.position }));
  assert.deepEqual(await session.record({ kind: 'start', lineups: { home: [{ player: player('home-1'), position: 'P' }], away: noPitcher } }),
    { kind: 'rejected', code: 'no_pitcher' });
  assert.deepEqual(await session.record({ kind: 'start', lineups: { home: [{ player: player('nobody'), position: 'P' }], away: awayLineup } }),
    { kind: 'rejected', code: 'unknown_player' });
  assert.deepEqual(await database.all('SELECT * FROM local_events'), []);
  assert.deepEqual(await database.all('SELECT * FROM local_games'), []);
  await database.close();
});

test('the season half is filled in from the date the league switches, with the note the scorer reads', () => {
  assert.equal(seasonHalfOn('2026-09-30'), 'first');
  assert.equal(seasonHalfOn('2026-10-01'), 'second');
  assert.equal(seasonHalfNote('2026-10-24'),
    'Second half since Oct 1, so pitchers can get 9 outs a day. Change it if your league switched on another date.');
  assert.equal(seasonHalfNote('2026-09-12'),
    'First half until Oct 1, so pitchers can get 6 outs a day. Change it if your league switched on another date.');
  assert.equal(newSetupDraft('2026-10-24').half, 'second');
});

test('Start stays off until the scorer saves both lineups, and the rows say what each team has', () => {
  let draft = newSetupDraft('2026-10-24');
  assert.equal(canStart(draft), false);
  assert.equal(lineupSummary(draft, 'home'), 'Not set yet');
  assert.equal(lineupSummary(draft, 'away'), 'Not set yet');

  const hawks = saveLineup(draft, 'home', draft.lineups.home.slots);
  assert.equal(hawks.kind, 'saved');
  if (hawks.kind !== 'saved') return;
  draft = hawks.draft;
  assert.equal(lineupSummary(draft, 'home'), '10 players · T. Nguyen pitching');
  assert.equal(canStart(draft), false);

  const marlins = saveLineup(draft, 'away', draft.lineups.away.slots);
  assert.equal(marlins.kind, 'saved');
  if (marlins.kind !== 'saved') return;
  draft = { ...marlins.draft, half: 'first' };
  assert.equal(canStart(draft), true);
  assert.deepEqual(startAction(draft), { kind: 'start', half: 'first',
    lineups: { home: draft.lineups.home.slots, away: draft.lineups.away.slots } });
});

test('saving a lineup with a player who is not on the roster is refused with the engine reason', () => {
  const draft = newSetupDraft('2026-10-24');
  assert.deepEqual(saveLineup(draft, 'home', [...draft.lineups.home.slots, { player: player('away-1'), position: null }]),
    { kind: 'rejected', code: 'unknown_player' });
});

test('the Hawks sample lineup bats everyone present, and a player with no position bats only', () => {
  const { slots } = newSetupDraft('2026-10-24').lineups.home;
  assert.deepEqual(ids(slots), [
    ['home-8', 'CF'], ['home-6', 'SS'], ['home-4', '2B'], ['home-3', '1B'], ['home-7', 'LF'],
    ['home-5', '3B'], ['home-1', 'P'], ['home-2', 'C'], ['home-9', 'RF'], ['home-10', null],
  ]);
  assert.equal(positionLabel(slots[9]!.position), 'Bats only');
  assert.equal(positionLabel('SS'), 'SS');
  assert.deepEqual(startingPitcher(slots), player('home-1'));
});

test('the scorer reorders, changes positions, picks the starting pitcher and adds from the roster', () => {
  const start: LineupSlot[] = [
    { player: player('home-1'), position: 'P' },
    { player: player('home-2'), position: 'C' },
    { player: player('home-3'), position: null },
  ];
  assert.deepEqual(ids(movePlayer(start, 2, 0)), [['home-3', null], ['home-1', 'P'], ['home-2', 'C']]);
  assert.deepEqual(ids(setPosition(start, 1, 'P')), [['home-1', 'C'], ['home-2', 'P'], ['home-3', null]], 'a taken position swaps');
  assert.deepEqual(ids(setPosition(start, 1, null)), [['home-1', 'P'], ['home-2', null], ['home-3', null]]);
  assert.deepEqual(ids(setPosition(start, 2, 'SS')), [['home-1', 'P'], ['home-2', 'C'], ['home-3', 'SS']]);
  assert.deepEqual(ids(setStartingPitcher(start, player('home-3'))), [['home-1', null], ['home-2', 'C'], ['home-3', 'P']]);
  assert.deepEqual(benchPlayers('home', start).map((ref) => ref.id),
    ['home-4', 'home-5', 'home-6', 'home-7', 'home-8', 'home-9', 'home-10']);
  assert.deepEqual(ids(addFromRoster(start, player('home-7'))).at(-1), ['home-7', null]);
  assert.deepEqual(start.map((slot) => slot.position), ['P', 'C', null], 'edits never change the lineup they start from');
});
