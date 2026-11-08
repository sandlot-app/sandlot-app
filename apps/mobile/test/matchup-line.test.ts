import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import type { BattingLine } from '@sandlot/engine';
import { batterStat, marksFit, pitchLine, ticketLines } from '../src/scoring/matchup-line.ts';
import { openOfflineGame } from '../src/scoring/offline-game.ts';
import { connect } from './database.ts';

const line = (partial: Partial<BattingLine>): BattingLine => ({
  plateAppearances: 0, atBats: 0, hits: 0, doubles: 0, triples: 0, homeRuns: 0, walks: 0, hitByPitch: 0, strikeouts: 0, runs: 0, runsBattedIn: 0, ...partial,
});

test('a batter who has not batted yet is first up', () => {
  assert.equal(batterStat(undefined), 'First up');
  assert.equal(batterStat(line({})), 'First up');
});

test('the stat is hits for at-bats, then extra-base hits and walks', () => {
  assert.equal(batterStat(line({ plateAppearances: 1, atBats: 1 })), '0 for 1');
  assert.equal(batterStat(line({ plateAppearances: 4, atBats: 4, hits: 3, doubles: 1, homeRuns: 1 })), '3 for 4, 2B, HR');
  assert.equal(batterStat(line({ plateAppearances: 4, atBats: 3, hits: 2, doubles: 2, triples: 1, walks: 1 })), '2 for 3, 2 2B, 3B, BB');
  assert.equal(batterStat(line({ plateAppearances: 2, atBats: 0, walks: 1, hitByPitch: 1 })), '0 for 0, BB');
});

test('the pitch count turns amber at the warning and red at the limit', () => {
  const limits = { warnAt: 65, limit: 75 };
  assert.deepEqual(pitchLine(24, limits), { count: '24/75', tone: 'normal', spoken: '24 of 75 pitches' });
  assert.deepEqual(pitchLine(65, limits), { count: '65/75', tone: 'warning', spoken: '65 of 75 pitches' });
  assert.deepEqual(pitchLine(74, limits), { count: '74/75', tone: 'warning', spoken: '74 of 75 pitches' });
  assert.deepEqual(pitchLine(75, limits), { count: '75/75', tone: 'danger', spoken: '75 of 75 pitches' });
  assert.deepEqual(pitchLine(82, limits), { count: '82/75', tone: 'danger', spoken: '82 of 75 pitches' });
  assert.deepEqual(pitchLine(1, null), { count: '1', tone: 'normal', spoken: '1 pitch' });
});

test('the ticket reads the batter line from the saved plays, and an undo takes it back', async () => {
  const session = await openOfflineGame(connect(':memory:'), { newId: randomUUID, now: () => '2026-10-26T17:00:00.000Z' });
  if (session.kind !== 'ready') throw new Error('Session must open');
  let result = await session.record({ kind: 'start' });
  if (result.kind !== 'saved') throw new Error('Game must start');
  const first = ticketLines(result.game);
  assert.equal(first.batter?.stat, 'First up');
  assert.equal(first.pitcher?.count.count, '0/75');
  result = await session.record({ kind: 'ball_in_play', at: '2026-10-26T17:01:00.000Z', expectedRevision: result.game.revision,
    outcome: 'double', trajectory: 'line', fielders: ['CF'], advances: [] });
  if (result.kind !== 'saved') throw new Error('The double must save');
  const leadoff = result.game.state.lineups.away[0]!.player;
  assert.deepEqual(ticketLines(result.game).lines[leadoff.id], line({ plateAppearances: 1, atBats: 1, hits: 1, doubles: 1 }));
  assert.equal(ticketLines(result.game).pitcher?.count.count, '1/75');
  result = await session.record({ kind: 'undo' });
  if (result.kind !== 'saved') throw new Error('The undo must save');
  assert.equal(ticketLines(result.game).lines[leadoff.id], undefined);
  assert.equal(ticketLines(result.game).batter?.stat, 'First up');
});

test('the icon marks show only when both stat lines fit beside them on one line', () => {
  // A half 150 wide leaves 110 for text beside a 32-point mark and its 8-point gap.
  assert.equal(marksFit(150, [110, 96]), true);
  assert.equal(marksFit(150, [110.4, 96]), true, 'sub-point rounding does not hide the marks');
  assert.equal(marksFit(150, [96, 111]), false, 'either line too long hides both marks');
  assert.equal(marksFit(0, [96, 96]), true, 'marks show until the ticket is measured');
});

test('the marks depend only on the widths, so each pitch gives the same answer whether they were showing or not', () => {
  const widths = [118, 119, 119, 121, 121];
  const shown = widths.map((width) => marksFit(160, [100, width]));
  assert.deepEqual(shown, [true, true, true, false, false], 'once the count outgrows the room the marks stay hidden pitch after pitch');
});
