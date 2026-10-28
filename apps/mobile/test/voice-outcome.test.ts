import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { route } from '@sandlot/voice';
import { openOfflineGame, type SavedGame } from '../src/scoring/offline-game.ts';
import { choiceLabels, failureMessage, liveCard, outcome, pressGame, pressInput } from '../src/voice/outcome.ts';
import { connect } from './database.ts';

async function started() {
  const session = await openOfflineGame(connect(':memory:'), { newId: randomUUID, now: () => '2026-10-26T17:00:00.000Z' });
  if (session.kind !== 'ready') throw new Error('Session must open');
  const result = await session.record({ kind: 'start' });
  if (result.kind !== 'saved') throw new Error('Game must start');
  return { session, game: result.game };
}

const said = (game: SavedGame, transcript: string) => route({ ...pressGame(game), transcript, at: 0 });
const heard = (transcript: string) => ({ transcript, calls: [transcript] });

test('"strike swinging" saves through the engine as a voice play', async () => {
  const { session, game } = await started();
  const result = outcome(said(game, 'strike swinging'), heard('strike swinging'));
  assert.equal(result.kind, 'save');
  if (result.kind !== 'save') return;
  const saved = await session.record({ kind: 'voice', at: '2026-10-26T17:01:00.000Z', expectedRevision: game.revision, commands: result.commands });
  assert.equal(saved.kind, 'saved');
  if (saved.kind !== 'saved') return;
  assert.deepEqual(saved.game.state.count, { balls: 0, strikes: 1, pitches: 1 });
  const play = saved.game.events.slice(game.events.length);
  assert.deepEqual(play.map((event) => [event.source, event.at, event.command]), [['voice', '2026-10-26T17:01:00.000Z', { kind: 'pitch', result: 'swinging_strike' }]]);
  assert.equal(JSON.stringify(play).includes('Darcy') || JSON.stringify(play).includes('Soto'), false, 'events carry IDs, never names (rule 5)');
});

test('while held, words that would save show Got it with the read-back; words that need a choice keep listening', async () => {
  const { game } = await started();
  assert.deepEqual(liveCard(said(game, 'strike swinging'), 'strike swinging'),
    { kind: 'got_it', words: 'strike swinging', result: 'Strike swinging → count 0–1', tone: 'strike' });
  assert.deepEqual(liveCard(said(game, 'ball'), 'ball'), { kind: 'got_it', words: 'ball', result: 'Ball → count 1–0', tone: 'ball' });
  assert.deepEqual(liveCard(said(game, 'strike'), 'strike'), { kind: 'listening', words: 'strike' });
});

test('C3: "strike" asks which one, and nothing saves until a choice', async () => {
  const { game } = await started();
  const result = outcome(said(game, 'strike'), heard('strike'));
  assert.equal(result.kind, 'choose');
  if (result.kind !== 'choose') return;
  assert.equal(result.heading, 'Not sure — which one?');
  assert.deepEqual(choiceLabels(result.choices), ['Strike looking', 'Strike swinging']);
  assert.equal(result.note, 'Looking or swinging? Tap one, or use the buttons below. Nothing is saved yet.');
});

test('the other decisions fall back to one line, or to undo', async () => {
  const { game } = await started();
  assert.deepEqual(outcome(said(game, ''), heard('')), { kind: 'message', message: "Didn't catch that. Hold and try again, or tap to score." });
  assert.deepEqual(outcome(said(game, 'zorp the flibber'), heard('zorp the flibber')), { kind: 'message', message: 'Didn\'t understand "zorp the flibber". Tap to score.' });
  assert.deepEqual(outcome(said(game, 'scratch that'), heard('scratch that')), { kind: 'undo' });
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

test('a press sends the lineup\'s display names, split by side, with the runners on base', async () => {
  const { session, game } = await started();
  const input = pressInput(game);
  assert.equal(input.names.length, 18);
  assert.equal(input.context.batting[0], 'J. Soto', 'the away team bats first');
  assert.equal(input.context.fielding[0], 'T. Nguyen');
  assert.deepEqual(input.context.runners, []);
  let current = game;
  for (let ball = 0; ball < 4; ball += 1) {
    const saved = await session.record({ kind: 'pitch', result: 'ball' });
    if (saved.kind === 'saved') current = saved.game;
  }
  assert.deepEqual(pressInput(current).context.runners, ['J. Soto']);
});

test('a choice keeps every clause, and shows the whole read-back when two short labels would match', () => {
  const reading = (readBack: string) => ({ commands: [], readBack });
  assert.deepEqual(choiceLabels([reading('Ball → count 1–0 · Ball → count 2–0')]), ['Ball · Ball'], 'a two-pitch part names both pitches');
  assert.deepEqual(choiceLabels([reading('Hit by pitch → J. Soto to 1st')]), ['Hit by pitch → J. Soto to 1st'], 'only the count is dropped');
  assert.deepEqual(choiceLabels([reading('Ball → count 3–0'), reading('Ball → count 2–0')]), ['Ball → count 3–0', 'Ball → count 2–0']);
});

test('a voice fix previews the change in one tap: "Change single to double?"', async () => {
  const { session, game } = await started();
  const saved = await session.record({ kind: 'ball_in_play', at: '2026-10-26T17:01:00.000Z', expectedRevision: game.revision, outcome: 'single', trajectory: null, fielders: [], advances: [] });
  if (saved.kind !== 'saved') throw new Error('The single must save');
  const result = outcome(said(saved.game, 'No, that was a double'), heard('No, that was a double'));
  assert.equal(result.kind, 'choose');
  if (result.kind !== 'choose') return;
  assert.equal(result.heading, 'Change single to double?');
  assert.deepEqual(choiceLabels(result.choices), ['J. Soto doubles']);
  assert.equal(result.note, 'Was: J. Soto singles. Tap to fix it, or use the buttons below. Nothing is changed yet.');
  assert.equal(result.dropped, 'Fix not saved: a double');
});
