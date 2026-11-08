import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { presets } from '@sandlot/engine';
import type { LineupSlot, PlayerRef, Position } from '@sandlot/engine';
import { childSideOf, teamsOf } from '../src/scoring/demo-roster.ts';
import { openOfflineGame } from '../src/scoring/offline-game.ts';
import { playLog } from '../src/scoring/play-log.ts';
import {
  addChoices,
  addFromRoster,
  benchPlayers,
  canStart,
  lineupSummary,
  movePlayer,
  newSetupDraft,
  pitcherChoices,
  positionChoices,
  positionLabel,
  removeFromLineup,
  saveLineup,
  seasonHalfNote,
  seasonHalfOn,
  setPosition,
  setStartingPitcher,
  setupRejection,
  startRejection,
  startAction,
  startingPitcher,
} from '../src/scoring/game-setup.ts';
import { connect } from './database.ts';

const boundary = { newId: randomUUID, now: () => '2026-10-24T18:30:00.000Z' };
const player = (id: string): PlayerRef => ({ kind: 'player', id } as PlayerRef);
const opponent = (id: string): PlayerRef => ({ kind: 'opponent', id } as PlayerRef);
const ids = (slots: LineupSlot[]) => slots.map((slot) => [slot.player.id, slot.position]);
const marlinsLineup: LineupSlot[] = (['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'] as Position[])
  .map((position, index) => ({ player: opponent(`away-${index + 1}`), position }));

async function open(database = connect(':memory:')) {
  const session = await openOfflineGame(database, boundary);
  if (session.kind !== 'ready') throw new Error('Session must open');
  return { database, session };
}

test('starting a game saves its season half and both lineups once, and reopening rebuilds the same game', async () => {
  const { database, session } = await open();
  const hawksLineup: LineupSlot[] = [
    { player: player('home-8'), position: 'CF' },
    { player: player('home-1'), position: 'P' },
    { player: player('home-10'), position: null },
  ];
  const started = await session.record({ kind: 'start', half: 'first', lineups: { away: hawksLineup, home: marlinsLineup } });
  assert.equal(started.kind, 'saved');
  if (started.kind !== 'saved') return;
  assert.deepEqual(started.game.setup.rules, presets['moraga-mustang-first-half']);
  assert.deepEqual(ids(started.game.state.lineups.away), [['home-8', 'CF'], ['home-1', 'P'], ['home-10', null]]);
  assert.deepEqual(started.game.state.pitchers.away, player('home-1'));
  assert.equal(started.game.canUndo, false);

  const stored = await database.all<{ event_json: string }>('SELECT event_json FROM local_events ORDER BY seq');
  assert.deepEqual(stored.map((row) => JSON.parse(row.event_json).command.control.kind), ['lineup_set', 'lineup_set', 'start']);
  const saved = JSON.stringify(await database.all('SELECT * FROM local_games')) + JSON.stringify(stored);
  for (const name of ['Nguyen', 'Moss', 'Lane', 'Hawks', 'Marlins']) assert.ok(!saved.includes(name), `${name} must not be saved`);

  const again = await session.record({ kind: 'start', half: 'second', lineups: { away: marlinsLineup, home: marlinsLineup } });
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
  assert.equal(started.game.state.lineups.away.length, 10);
  await database.close();
});

test('an illegal or incomplete setup is rejected with the engine reason and saves nothing', async () => {
  const { database, session } = await open();
  const noPitcher = marlinsLineup.map((slot) => ({ ...slot, position: slot.position === 'P' ? null : slot.position }));
  assert.deepEqual(await session.record({ kind: 'start', lineups: { away: [{ player: player('home-1'), position: 'P' }], home: noPitcher } }),
    { kind: 'rejected', code: 'no_pitcher' });
  assert.deepEqual(await session.record({ kind: 'start', lineups: { away: [{ player: player('nobody'), position: 'P' }], home: marlinsLineup } }),
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
  assert.equal(lineupSummary(draft, 'away'), 'Not set yet');
  assert.equal(lineupSummary(draft, 'home'), 'Not set yet');

  const hawks = saveLineup(draft, 'away', draft.lineups.away.slots);
  assert.equal(hawks.kind, 'saved');
  if (hawks.kind !== 'saved') return;
  draft = hawks.draft;
  assert.equal(lineupSummary(draft, 'away'), '10 players · T. Nguyen pitching');
  assert.equal(canStart(draft), false);

  const marlins = saveLineup(draft, 'home', draft.lineups.home.slots);
  assert.equal(marlins.kind, 'saved');
  if (marlins.kind !== 'saved') return;
  draft = { ...marlins.draft, half: 'first' };
  assert.equal(canStart(draft), true);
  assert.deepEqual(startAction(draft), { kind: 'start', half: 'first',
    lineups: { away: draft.lineups.away.slots, home: draft.lineups.home.slots } });
});

test('saving a lineup with a player who is not on the roster is rejected with the engine reason', () => {
  const draft = newSetupDraft('2026-10-24');
  assert.deepEqual(saveLineup(draft, 'away', [...draft.lineups.away.slots, { player: player('away-1'), position: null }]),
    { kind: 'rejected', code: 'unknown_player' });
});

test('the Hawks sample lineup bats everyone present, and a player with no position bats only', () => {
  const { slots } = newSetupDraft('2026-10-24').lineups.away;
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
  assert.deepEqual(benchPlayers('away', start).map((ref) => ref.id),
    ['home-4', 'home-5', 'home-6', 'home-7', 'home-8', 'home-9', 'home-10']);
  assert.deepEqual(ids(addFromRoster(start, player('home-7'))).at(-1), ['home-7', null]);
  assert.deepEqual(start.map((slot) => slot.position), ['P', 'C', null], 'edits never change the lineup they start from');
});

const scorer: LineupSlot[] = [
  { player: player('home-1'), position: 'P' },
  { player: player('home-2'), position: 'C' },
  { player: player('home-3'), position: null },
];

test('tapping a position lists every position and Bats only, marks the batter’s own, and says who a taken one swaps with', () => {
  const choices = positionChoices(scorer, 1);
  assert.deepEqual(choices.map((choice) => [choice.label, choice.note, choice.selected]), [
    ['P', 'Swaps with T. Nguyen', false],
    ['C', 'Catcher', true],
    ['1B', 'First base', false],
    ['2B', 'Second base', false],
    ['3B', 'Third base', false],
    ['SS', 'Shortstop', false],
    ['LF', 'Left field', false],
    ['CF', 'Center field', false],
    ['RF', 'Right field', false],
    ['Bats only', 'No fielding position', false],
  ]);
  assert.deepEqual(choices.map((choice) => choice.position),
    ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', null]);
});

test('the starting pitcher choices are the lineup’s players, with the pitcher marked and what the league lets them throw', () => {
  assert.deepEqual(pitcherChoices('second', scorer).map((choice) => [choice.number, choice.name, choice.note, choice.selected]), [
    ['15', 'T. Nguyen', 'Fully rested · 75 pitches available today', true],
    ['12', 'M. Ortiz', 'Fully rested · 75 pitches available today', false],
    ['24', 'D. Park', 'Fully rested · 75 pitches available today', false],
  ]);
});

test('adding from the roster offers the players not yet in the lineup, by jersey number and name', () => {
  assert.deepEqual(addChoices('away', scorer).map((choice) => [choice.number, choice.name, choice.note]), [
    ['7', 'S. Bell', 'Not in the lineup yet'],
    ['3', 'A. Kindle', 'Not in the lineup yet'],
    ['6', 'J. Ruiz', 'Not in the lineup yet'],
    ['9', 'R. Hale', 'Not in the lineup yet'],
    ['1', 'K. Moss', 'Not in the lineup yet'],
    ['22', 'E. Brooks', 'Not in the lineup yet'],
    ['18', 'B. Lane', 'Not in the lineup yet'],
  ]);
  assert.deepEqual(addChoices('away', newSetupDraft('2026-10-24').lineups.away.slots), [], 'the sample lineup already has everyone');
});

test('a rejected lineup or Start says why in words a scorer can act on', () => {
  assert.equal(setupRejection('no_pitcher'), 'A team needs a starting pitcher. Choose one for the team that has none.');
  assert.equal(setupRejection('unknown_player'), 'That player isn’t on this game’s roster, so the lineup wasn’t saved.');
  assert.equal(setupRejection('game_already_started'), 'This game has already started, so its lineups can’t change.');
  assert.equal(setupRejection('too_many_outs'), 'That lineup can’t be used. Check the batting order and positions.');
});

test('a division with ten fielders also offers the Rover position', () => {
  assert.deepEqual(positionChoices(scorer, 1, 10).map((choice) => choice.label),
    ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'ROVER', 'Bats only']);
  assert.equal(positionChoices(scorer, 1, 9).length, 10);
});

test('a lineup saved with nobody pitching says so on its row, and Start names the team that needs a pitcher', () => {
  let draft = newSetupDraft('2026-10-24');
  const hawks = draft.lineups.away.slots;
  const marlins = draft.lineups.home.slots.map((slot) => ({ ...slot, position: slot.position === 'P' ? null : slot.position }));
  const savedHawks = saveLineup(draft, 'away', hawks);
  assert.equal(savedHawks.kind, 'saved');
  if (savedHawks.kind !== 'saved') return;
  const savedMarlins = saveLineup(savedHawks.draft, 'home', marlins);
  assert.equal(savedMarlins.kind, 'saved');
  if (savedMarlins.kind !== 'saved') return;
  draft = savedMarlins.draft;
  assert.equal(lineupSummary(draft, 'home'), '9 players · no starting pitcher yet');
  assert.equal(startRejection(draft, 'no_pitcher'), 'The Marlins need a starting pitcher.');
  const neither = saveLineup(draft, 'away', hawks.map((slot) => ({ ...slot, position: slot.position === 'P' ? null : slot.position })));
  assert.equal(neither.kind === 'saved' && startRejection(neither.draft, 'no_pitcher'), 'Both teams need a starting pitcher.');
  assert.equal(startRejection(draft, 'game_already_started'), setupRejection('game_already_started'));
});

test('a game saved before the sample moved to the second half and the Hawks to the away side still reopens', async () => {
  const { database, session } = await open();
  const started = await session.record({ kind: 'start', half: 'first', lineups: { away: [
    { player: player('home-1'), position: 'P' }, { player: player('home-2'), position: 'C' }], home: marlinsLineup } });
  assert.equal(started.kind, 'saved');
  // Rewrite what was saved the way the earlier app saved it: the Hawks on the home side, nine of them, first-half rules.
  const nine = (side: 'home' | 'away') => Array.from({ length: 9 }, (_, index) => ({ kind: side === 'home' ? 'player' : 'opponent', id: `${side}-${index + 1}` }));
  await database.run('UPDATE local_games SET setup_json = ?',
    [JSON.stringify({ rules: presets['moraga-mustang-first-half'], roster: { home: nine('home'), away: nine('away') }, pitcherOutsEarlierToday: {} })]);
  for (const row of await database.all<{ seq: number; event_json: string }>('SELECT seq, event_json FROM local_events')) {
    const event = JSON.parse(row.event_json);
    if (event.command.control?.kind === 'lineup_set') {
      event.command.control.side = event.command.control.side === 'away' ? 'home' : 'away';
      await database.run('UPDATE local_events SET event_json = ? WHERE seq = ?', [JSON.stringify(event), row.seq]);
    }
  }
  const reopened = await open(database);
  assert.equal(reopened.session.kind, 'ready');
  const game = reopened.session.kind === 'ready' ? reopened.session.game : null;
  assert.deepEqual(game?.setup.rules, presets['moraga-mustang-first-half']);
  assert.deepEqual(ids(game!.state.lineups.home), [['home-1', 'P'], ['home-2', 'C']], 'the Hawks are on the home side, as that game saved them');
  // The screens name a team by who is on its side, so that game still calls its home side the Hawks.
  assert.deepEqual([teamsOf(game!.state.lineups).home.name, teamsOf(game!.state.lineups).away.name], ['Hawks', 'Marlins']);
  assert.equal(teamsOf(game!.state.lineups).home.short, 'HAW');
  assert.equal(childSideOf(game!.state.lineups), 'home', 'Javier is on the Hawks, wherever they sit');
  assert.equal(playLog(game!)[0]!.batting, 'Marlins', 'the Marlins are the away team in that game and bat first');
  await database.close();
});

test('a player who is not playing today comes out of the batting order, can be added back, and the lineup they left is untouched', () => {
  const lineup: LineupSlot[] = [
    { player: player('home-1'), position: 'P' },
    { player: player('home-2'), position: 'C' },
    { player: player('home-3'), position: null },
  ];
  const without = removeFromLineup(lineup, 1);
  assert.deepEqual(ids(without), [['home-1', 'P'], ['home-3', null]], 'everyone else keeps their place and position');
  assert.deepEqual(ids(lineup), [['home-1', 'P'], ['home-2', 'C'], ['home-3', null]], 'the lineup it started from is unchanged');
  assert.deepEqual(addChoices('away', without).map((choice) => choice.name).slice(0, 2), ['M. Ortiz', 'S. Bell'], 'they are back on the roster list, in roster order');
  assert.deepEqual(ids(addFromRoster(without, player('home-2'))).at(-1), ['home-2', null], 'added back, they bat last with no position');
  assert.equal(startingPitcher(removeFromLineup(lineup, 0)), null, 'taking out the pitcher leaves nobody pitching');
  assert.deepEqual(ids(removeFromLineup(lineup, 5)), ids(lineup), 'an index that is not in the lineup changes nothing');
});

test('in a new game the Hawks are the away side, and the screens name the sides that way', async () => {
  const { database, session } = await open();
  const started = await session.record({ kind: 'start' });
  assert.equal(started.kind, 'saved');
  if (started.kind !== 'saved') return;
  assert.deepEqual([teamsOf(started.game.state.lineups).away.name, teamsOf(started.game.state.lineups).home.name], ['Hawks', 'Marlins']);
  assert.equal(childSideOf(started.game.state.lineups), 'away');
  assert.equal(playLog(started.game)[0]!.batting, 'Hawks', 'the Hawks bat in the top of the first');
  assert.deepEqual([teamsOf({ away: [], home: [] }).away.name, childSideOf({ away: [], home: [] })], ['Hawks', 'away'], 'before the lineups exist, the sample sides');
  await database.close();
});
