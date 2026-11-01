import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { decide, readLocally } from '@sandlot/voice';
import { openOfflineGame, type SavedGame } from '../src/scoring/offline-game.ts';
import { choiceLabels, failureMessage, pressGame, pressInput } from '../src/voice/outcome.ts';
import { connect } from './database.ts';

async function started() {
  const session = await openOfflineGame(connect(':memory:'), { newId: randomUUID, now: () => '2026-10-26T17:00:00.000Z' });
  if (session.kind !== 'ready') throw new Error('Session must open');
  const result = await session.record({ kind: 'start' });
  if (result.kind !== 'saved') throw new Error('Game must start');
  return { session, game: result.game };
}

const said = (game: SavedGame, transcript: string) => decide({ game: pressGame(game), transcript, at: 0 }, readLocally(transcript)!);

test('"strike swinging" saves through the engine as a voice play', async () => {
  const { session, game } = await started();
  const result = said(game, 'strike swinging');
  assert.equal(result.kind, 'save');
  if (result.kind !== 'save') return;
  const saved = await session.record({ kind: 'voice', at: '2026-10-26T17:01:00.000Z', expectedRevision: game.revision, commands: result.reading.commands });
  assert.equal(saved.kind, 'saved');
  if (saved.kind !== 'saved') return;
  assert.deepEqual(saved.game.state.count, { balls: 0, strikes: 1, pitches: 1 });
  const play = saved.game.events.slice(game.events.length);
  assert.deepEqual(play.map((event) => [event.source, event.at, event.command]), [['voice', '2026-10-26T17:01:00.000Z', { kind: 'pitch', result: 'swinging_strike' }]]);
  assert.equal(JSON.stringify(play).includes('Darcy') || JSON.stringify(play).includes('Soto'), false, 'events carry IDs, never names (rule 5)');
});

test('"strike" asks which one, and nothing saves until a choice', async () => {
  const { game } = await started();
  const result = said(game, 'strike');
  assert.equal(result.kind, 'choose');
  if (result.kind !== 'choose') return;
  assert.deepEqual(choiceLabels(result.readings), ['Strike looking', 'Strike swinging']);
  assert.equal(failureMessage('voice_unavailable'), 'Voice is unavailable right now. Tap to score.', 'the contract\'s A10 wording');
});

test('a voice action can\'t carry lineups, the start or an undo, and stale presses don\'t save', async () => {
  const { session, game } = await started();
  for (const commands of [[], [{ kind: 'undo', target: 'x' }], [{ kind: 'game', control: { kind: 'start', umpireStart: 'x' } }]] as const) {
    const result = await session.record({ kind: 'voice', at: '2026-10-26T17:01:00.000Z', expectedRevision: game.revision, commands: commands as never });
    assert.equal(result.kind, 'rejected');
  }
  await session.record({ kind: 'pitch', result: 'ball' });
  const stale = await session.record({ kind: 'voice', at: '2026-10-26T17:01:00.000Z', expectedRevision: game.revision, commands: [{ kind: 'pitch', result: 'ball' }] });
  assert.equal(stale.kind, 'stale');
});

test('a press sends the display names, and the game by role with jersey numbers, and no player IDs', async () => {
  const { session, game } = await started();
  const input = pressInput(pressGame(game));
  assert.equal(input.names.length, 19, 'nine Marlins and ten Hawks');
  assert.equal(input.context.batter.name, 'K. Moss', 'the away team, the Hawks, bats first');
  assert.equal(input.context.pitcher?.name, 'J. Soto', 'the Marlins pitcher');
  assert.deepEqual(input.context.runners, {});
  assert.equal(JSON.stringify(input).includes('"id"'), false);
  let current = game;
  for (let ball = 0; ball < 4; ball += 1) {
    const saved = await session.record({ kind: 'pitch', result: 'ball' });
    if (saved.kind === 'saved') current = saved.game;
  }
  const after = pressInput(pressGame(current)).context;
  assert.equal(after.runners['1']?.name, 'K. Moss');
  assert.equal(after.lastPlay, 'K. Moss walks');
});

test('a choice keeps every clause, and shows the whole read-back when two short labels would match', () => {
  const reading = (banner: string) => ({ commands: [], banner });
  assert.deepEqual(choiceLabels([reading('Ball → count 1–0 · Ball → count 2–0')]), ['Ball · Ball'], 'a two-pitch part names both pitches');
  assert.deepEqual(choiceLabels([reading('Hit by pitch → J. Soto to 1st')]), ['Hit by pitch → J. Soto to 1st'], 'only the count is dropped');
  assert.deepEqual(choiceLabels([reading('Ball → count 3–0'), reading('Ball → count 2–0')]), ['Ball → count 3–0', 'Ball → count 2–0']);
});
