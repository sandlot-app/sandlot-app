process.env.TZ = 'America/Los_Angeles'; // shortDate and seasonOf read the phone's time zone.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import type { PlayerId, PlayerRef } from '@sandlot/engine';
import { openOfflineGame, type DemoAction, type SavedGame } from '../src/scoring/offline-game.ts';
import { bestPlay, gameLine, gameShare, seasonOf, shortDate, statCells } from '../src/share/game-share.ts';
import { connect } from './database.ts';

const at = '2026-10-24T18:01:00.000Z';

async function scorer() {
  const session = await openOfflineGame(connect(':memory:'), { newId: randomUUID, now: () => '2026-10-24T18:00:00.000Z' });
  if (session.kind !== 'ready') throw new Error('Session must open');
  let game: SavedGame | null = null;
  const save = async (action: DemoAction | ((game: SavedGame) => DemoAction)) => {
    const result = await session.record(typeof action === 'function' ? action(game!) : action);
    if (result.kind !== 'saved') throw new Error(`The play must save: ${JSON.stringify(result)}`);
    game = result.game;
    return game;
  };
  await save({ kind: 'start' });
  const strikeouts = async (batters: number) => {
    for (let pitch = 0; pitch < batters * 3; pitch += 1) await save({ kind: 'pitch', result: 'called_strike' });
  };
  const hit = (outcome: 'single' | 'double' | 'home_run', fielder: 'CF' | 'LF' | 'RF') =>
    save((game) => ({ kind: 'ball_in_play', at, expectedRevision: game.revision, outcome, trajectory: null, fielders: [fielder], advances: [] }));
  return { save, strikeouts, hit, game: () => game! };
}

const player = (id: string): PlayerRef => ({ kind: 'player', id: id as PlayerId });
const javier = player('home-6');
const names = { first: 'Javier', last: 'Ruiz', number: '6' };
const context = { team: 'Hawks', division: 'Mustang' };

test('the stat line shows AB and H, then up to two of 2B, 3B, HR and BB above zero, and never K', () => {
  const line = { plateAppearances: 4, atBats: 3, hits: 2, doubles: 1, triples: 0, homeRuns: 1, walks: 1, hitByPitch: 0, strikeouts: 1, runs: 0, runsBattedIn: 0 };
  assert.deepEqual(statCells(line), [{ label: 'AB', value: 3 }, { label: 'H', value: 2 }, { label: '2B', value: 1 }, { label: 'HR', value: 1 }]);
  const quiet = { plateAppearances: 3, atBats: 3, hits: 0, doubles: 0, triples: 0, homeRuns: 0, walks: 0, hitByPitch: 0, strikeouts: 3, runs: 0, runsBattedIn: 0 };
  assert.deepEqual(statCells(quiet), [{ label: 'AB', value: 3 }, { label: 'H', value: 0 }]);
  assert.equal(gameLine(quiet), '0 FOR 3');
  assert.equal(gameLine({ ...quiet, hits: 2, doubles: 1, walks: 2 }), '2 FOR 3 · DOUBLE · 2 WALKS');
  assert.equal(gameLine({ ...quiet, atBats: 0, walks: 3, strikeouts: 0 }), '3 WALKS', 'all walks drops the 0 FOR 0');
});

test('the best play is the biggest hit, in past tense, with the fielder and inning, in 60 characters or less', () => {
  assert.equal(bestPlay([{ result: 'single', fielder: 'LF', inning: 1 }, { result: 'double', fielder: 'CF', inning: 3 }]), 'Doubled to center in the 3rd.');
  assert.equal(bestPlay([{ result: 'walk', fielder: null, inning: 2 }, { result: 'out', fielder: 'SS', inning: 4 }]), 'Walked in the 2nd.');
  assert.equal(bestPlay([{ result: 'strikeout', fielder: null, inning: 1 }, { result: 'out', fielder: 'SS', inning: 4 }]), null);
  assert.equal(bestPlay([{ result: 'home_run', fielder: 'LF', inning: 11 }]), 'Homered to left in the 11th.');
  for (const result of ['single', 'double', 'ground_rule_double', 'triple', 'home_run', 'walk', 'hit_by_pitch'] as const) {
    assert.ok((bestPlay([{ result, fielder: 'RF', inning: 12 }]) ?? '').length <= 60);
  }
});

test('the date and season come from the first saved event', () => {
  assert.equal(shortDate('2026-10-24T18:00:00.000Z'), 'SAT, OCT 24');
  assert.equal(seasonOf('2026-10-24T18:00:00.000Z'), 'FALL 2026');
  assert.equal(seasonOf('2027-04-10T18:00:00.000Z'), 'SPRING 2027');
});

test('a game share reads the child’s line, position and best play from the saved events', async () => {
  const s = await scorer();
  await s.strikeouts(3); // top 1
  await s.strikeouts(3); // bottom 1: home-1 to home-3
  await s.strikeouts(3); // top 2
  await s.strikeouts(2); // home-4, home-5
  await s.hit('double', 'CF');
  await s.strikeouts(1); // home-7
  const game = s.game();
  const share = gameShare({ events: game.events, state: game.state, player: javier, side: 'home', names, ...context });
  assert.ok(share);
  assert.equal(share.position, 'SHORTSTOP');
  assert.deepEqual(share.stats, [{ label: 'AB', value: 1 }, { label: 'H', value: 1 }, { label: '2B', value: 1 }]);
  assert.equal(share.gameLine, '1 FOR 1 · DOUBLE');
  assert.equal(share.bestPlay, 'Doubled to center in the 2nd.');
  assert.equal(share.date, 'SAT, OCT 24');
  assert.equal(share.season, 'FALL 2026');
  assert.equal(JSON.stringify(game.events).includes('Javier'), false, 'names stay out of the events');
});

test('an undone hit doesn’t count, and a child with no plate appearance gets no share', async () => {
  const s = await scorer();
  await s.strikeouts(3);
  await s.strikeouts(3);
  await s.strikeouts(3);
  await s.strikeouts(2);
  await s.hit('home_run', 'LF');
  await s.save({ kind: 'undo' });
  await s.strikeouts(1); // Javier strikes out instead
  const game = s.game();
  const share = gameShare({ events: game.events, state: game.state, player: javier, side: 'home', names, ...context });
  assert.ok(share);
  assert.deepEqual(share.stats, [{ label: 'AB', value: 1 }, { label: 'H', value: 0 }]);
  assert.equal(share.bestPlay, null);
  const nobody = gameShare({ events: game.events, state: game.state, player: player('home-9'), side: 'home', names, ...context });
  assert.equal(nobody, null);
});

test('appearances read walks, hit by pitches and strikeouts, and agree with battingLines for the same events', async () => {
  const { appearances } = await import('../src/scoring/play-log.ts');
  const { battingLines } = await import('@sandlot/engine');
  const { demoSetup } = await import('../src/scoring/demo-game.ts');
  const s = await scorer();
  const balls = async (count: number) => { for (let pitch = 0; pitch < count; pitch += 1) await s.save({ kind: 'pitch', result: 'ball' }); };
  await s.strikeouts(3); // top 1
  await s.strikeouts(3); // bottom 1: home-1 to home-3
  await s.strikeouts(3); // top 2
  await s.strikeouts(2); // home-4, home-5
  await balls(4); // Javier walks
  await s.strikeouts(1); // home-7, the half's third out
  await s.strikeouts(3); // top 3
  await s.strikeouts(3); // bottom 3: home-8, home-9, home-1
  await s.strikeouts(3); // top 4
  await s.strikeouts(2); // home-2, home-3
  await balls(4); // home-4 walks
  await balls(4); // home-5 walks
  await s.save({ kind: 'pitch', result: 'hit_by_pitch' }); // Javier, bases loaded
  await s.strikeouts(1); // home-7
  const game = s.game();
  const found = appearances(game.events, javier);
  assert.deepEqual(found.map((item) => [item.result, item.inning]), [['walk', 2], ['hit_by_pitch', 4]]);
  const line = battingLines(demoSetup, game.events)[javier.id]!;
  assert.equal(line.walks, found.filter((item) => item.result === 'walk').length);
  assert.equal(line.hitByPitch, found.filter((item) => item.result === 'hit_by_pitch').length);
  assert.equal(line.plateAppearances, found.length);
  assert.equal(bestPlay(found), 'Walked in the 2nd.');
});

test('a strikeout that ends the half is still a finished plate appearance', async () => {
  const { appearances } = await import('../src/scoring/play-log.ts');
  const { battingLines } = await import('@sandlot/engine');
  const { demoSetup } = await import('../src/scoring/demo-game.ts');
  const s = await scorer();
  await s.strikeouts(3); // top 1
  await s.strikeouts(3); // bottom 1: home-1 to home-3
  await s.strikeouts(3); // top 2
  await s.strikeouts(2); // home-4, home-5
  await s.save((game) => ({ kind: 'ball_in_play', at, expectedRevision: game.revision, outcome: 'single', trajectory: null, fielders: ['LF'], advances: [] }));
  await s.strikeouts(1); // home-7 ends bottom 2
  await s.strikeouts(3); // top 3
  await s.strikeouts(3); // home-8, home-9, home-1
  await s.strikeouts(3); // top 4
  await s.strikeouts(3); // home-2 to home-4
  await s.strikeouts(3); // top 5
  await s.strikeouts(1); // home-5
  await s.strikeouts(1); // Javier
  const game = s.game();
  const found = appearances(game.events, javier);
  assert.deepEqual(found.map((item) => item.result), ['single', 'strikeout']);
  const line = battingLines(demoSetup, game.events)[javier.id]!;
  assert.equal(line.strikeouts, 1);
  assert.equal(line.plateAppearances, found.length);
  const share = gameShare({ events: game.events, state: game.state, player: javier, side: 'home', names, ...context });
  assert.deepEqual(share?.stats, [{ label: 'AB', value: 2 }, { label: 'H', value: 1 }]);
  assert.equal(share?.gameLine, '1 FOR 2');
});

test('a long last name breaks after its hyphen and sizes to its column, and a short one stays at 60', async () => {
  const { fitLastName, heavyWidth } = await import('../src/share/fit.ts');
  const ruiz = fitLastName('Ruiz', 240, 26);
  assert.deepEqual(ruiz, { text: 'RUIZ', style: { fontSize: 60, lineHeight: 60, paddingTop: 12 } });
  const long = fitLastName('Oberhauser-Wettstein', 240, 26);
  assert.equal(long.text, 'OBERHAUSER-\nWETTSTEIN');
  assert.ok(heavyWidth('OBERHAUSER-') * long.style.fontSize <= 240, 'the longest line fits the column');
  assert.ok(long.style.fontSize >= 26);
  const card = fitLastName('Oberhauser-Wettstein', 160, 18);
  assert.ok(heavyWidth('OBERHAUSER-') * card.style.fontSize <= 160 || card.style.fontSize === 18);
  assert.equal(fitLastName('Lamorinda Thunderbolts', 160, 18).text, 'LAMORINDA\nTHUNDERBOLTS');
  assert.equal(fitLastName('Nguyễn', 240, 26).text, 'NGUYỄN');
});

test('display names keep Figma\'s line and pad above it for stacked accents, and one long word shrinks instead of breaking', async () => {
  const { fitLastName, heavyWidth } = await import('../src/share/fit.ts');
  for (const [name, column, floor] of [['Nguyễn', 240, 26], ['Oberhauser-Wettstein', 160, 18], ['Ruiz', 240, 26]] as const) {
    const { style } = fitLastName(name, column, floor);
    assert.equal(style.lineHeight, style.fontSize, `${name}: the line matches Figma`);
    assert.ok(style.paddingTop >= style.fontSize * 0.19, `${name}: ${style.paddingTop} pt above ${style.fontSize} pt leaves no room for ễ`);
  }
  const word = fitLastName('Wolfeschlegelsteinhausen', 240, 26);
  assert.equal(word.text, 'WOLFESCHLEGELSTEINHAUSEN', 'no hyphen or space, so no break');
  assert.ok(heavyWidth(word.text) * word.style.fontSize <= 240, 'it shrinks below the floor rather than break mid-word');
  assert.equal(fitLastName('Wolfeschlegelsteinhausenbergerdorff', 160, 18).style.fontSize, 12, 'but never below 12 pt');
});
