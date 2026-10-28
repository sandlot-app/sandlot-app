import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { openOfflineGame, type DemoAction, type SavedGame } from '../src/scoring/offline-game.ts';
import { playLabel } from '../src/scoring/play-label.ts';
import { createVoiceController, type VoiceView } from '../src/voice/voice-controller.ts';
import { connect } from './database.ts';
import { fakeApi, fakeMic, fakeSocket, tick, timeouts } from './voice-fakes.ts';

const settle = () => new Promise((resolve) => setTimeout(resolve, timeouts.openMs + timeouts.finalMs + 30));

/** A started offline game, a controller on it, and a fake mic and socket for each press. */
async function scorer(voiceOn = true, gate?: Promise<boolean>) {
  const session = await openOfflineGame(connect(':memory:'), { newId: randomUUID, now: () => '2026-10-26T17:00:00.000Z' });
  if (session.kind !== 'ready') throw new Error('Session must open');
  const started = await session.record({ kind: 'start' });
  if (started.kind !== 'saved') throw new Error('Game must start');
  let game: SavedGame = started.game;
  const recorded: DemoAction[] = [];
  const record = async (action: DemoAction) => {
    recorded.push(action);
    // A gate holds a voice save open, then answers it, so a test can act while record() is in flight.
    if (gate && action.kind === 'voice') return gate;
    const result = await session.record(action);
    if (result.kind === 'saved') game = result.game;
    return result.kind === 'saved';
  };
  const mic = fakeMic();
  let socket = fakeSocket();
  const views: VoiceView[] = [];
  const controller = createVoiceController({
    voice: voiceOn ? { mic, api: fakeApi(), openSocket: () => (socket = fakeSocket()), timeouts } : null,
    game: () => game,
    record,
    now: () => Date.parse('2026-10-26T17:01:00.000Z'),
    onChange: (view) => views.push(view),
  });
  /** Holds the bar and lets go; the final words arrive when `hear` is called. */
  async function hold() {
    controller.start();
    await tick();
    socket.open();
    mic.push([1, 0, 2, 0]);
    controller.release();
    await tick();
    const heldSocket = socket;
    return (transcript: string) => heldSocket.server({ type: 'conversation.item.input_audio_transcription.completed', transcript });
  }
  const plays = () => game.events.slice(started.game.events.length);
  /** Each saved Play's commands, in order. */
  const groups = () => [...new Set(plays().map((event) => event.group))].map((group) => plays().filter((event) => event.group === group).map((event) => event.command));
  return { controller, record, recorded, views, hold, plays, groups, game: () => game };
}

test('a voice play saves once, against the game the press started on', async () => {
  const { hold, plays, recorded } = await scorer();
  (await hold())('strike swinging');
  await settle();
  assert.deepEqual(plays().map((event) => [event.source, event.command]), [['voice', { kind: 'pitch', result: 'swinging_strike' }]]);
  assert.equal(recorded.length, 1);
});

test('a tap after letting go takes over: the voice result that arrives later saves nothing', async () => {
  const { controller, hold, plays, record, views } = await scorer();
  const hear = await hold();
  controller.dismiss();
  await record({ kind: 'pitch', result: 'called_strike' });
  hear('strike swinging');
  await settle();
  assert.deepEqual(plays().map((event) => [event.source, event.command]), [['tap', { kind: 'pitch', result: 'called_strike' }]], 'one strike, not two');
  assert.deepEqual(views.at(-1), { listening: false, card: null, message: null });
});

test('a save from anywhere else while a press is read makes the press stale, so it never writes on top', async () => {
  const { hold, plays, record, recorded } = await scorer();
  const hear = await hold();
  await record({ kind: 'pitch', result: 'ball' });
  hear('strike swinging');
  await settle();
  assert.deepEqual(plays().map((event) => event.source), ['tap']);
  assert.equal(recorded.at(-1)?.kind, 'voice', 'the press tried, and the engine refused the stale revision');
});

test('a Not sure choice saves the reading tapped, and a tap instead clears the card', async () => {
  const first = await scorer();
  (await first.hold())('strike');
  await settle();
  assert.equal(first.views.at(-1)?.card?.kind, 'choose');
  first.controller.choose(1);
  await settle();
  assert.deepEqual(first.plays().map((event) => event.command), [{ kind: 'pitch', result: 'swinging_strike' }]);

  const second = await scorer();
  (await second.hold())('strike');
  await settle();
  second.controller.dismiss();
  second.controller.choose(0);
  await settle();
  assert.deepEqual(second.plays(), [], 'the choice is gone once the scorer taps a button');
});

test('D4: the same play said again right after an undo saves, because the undo cleared the duplicate guard', async () => {
  const { controller, hold, plays, record, views } = await scorer();
  (await hold())('ball');
  await settle();
  controller.dismiss();
  await record({ kind: 'undo' });
  (await hold())('ball');
  await settle();
  assert.equal(views.at(-1)?.card, null, 'no "check this play" card');
  assert.deepEqual(plays().filter((event) => event.source === 'voice').map((event) => event.command), [{ kind: 'pitch', result: 'ball' }, { kind: 'pitch', result: 'ball' }]);
});

test('with voice off, a touch shows the unavailable line and no Listening card', async () => {
  const { controller, views } = await scorer(false);
  controller.start();
  assert.deepEqual(views.at(-1), { listening: false, card: null, message: 'Voice is unavailable right now. Tap to score.' });
});

const lost = 'The last voice play didn\'t save. Say it again or tap to score.';
const unsaved = 'That voice play didn\'t save. Say it again or tap to score.';

test('#65: holding the bar again before the last result arrives says the last play was lost, until the new one saves', async () => {
  const { controller, hold, plays, views } = await scorer();
  const hearFirst = await hold();
  controller.start();
  assert.equal(views.at(-1)?.message, lost);
  assert.equal(views.at(-1)?.listening, true, 'the new press still listens');
  controller.cancel();
  const hearSecond = await hold();
  assert.equal(views.at(-1)?.message, null, 'a press that began after the line is new work, so the line goes');
  hearFirst('strike swinging');
  hearSecond('ball');
  await settle();
  assert.deepEqual(plays().map((event) => event.command), [{ kind: 'pitch', result: 'ball' }], 'only the new press saves');
  assert.equal(views.at(-1)?.message, null);

  const again = await scorer();
  const lostFirst = await again.hold();
  const hearReplacement = await again.hold();
  assert.equal(again.views.at(-1)?.message, lost);
  lostFirst('strike swinging');
  hearReplacement('ball');
  await settle();
  assert.deepEqual(again.plays().map((event) => event.command), [{ kind: 'pitch', result: 'ball' }]);
  assert.equal(again.views.at(-1)?.message, null, 'the line clears once the replacement press saves');
});

test('#65: a refusal that lands after the scorer moved on stays quiet', async () => {
  let answer: (saved: boolean) => void = () => {};
  const { controller, hold, views } = await scorer(true, new Promise((resolve) => { answer = resolve; }));
  (await hold())('ball');
  await settle();
  controller.dismiss();
  answer(false);
  await settle();
  assert.deepEqual(views.at(-1), { listening: false, card: null, message: null });
});

test('#65: a voice play the engine refuses as stale says it didn\'t save', async () => {
  const { hold, record, views } = await scorer();
  const hear = await hold();
  await record({ kind: 'pitch', result: 'ball' });
  hear('strike swinging');
  await settle();
  assert.equal(views.at(-1)?.message, unsaved);
});

test('#65: a spoken undo is pinned to its press, so after another save it undoes nothing', async () => {
  const { hold, plays, record, recorded, views } = await scorer();
  (await hold())('ball');
  await settle();
  const hear = await hold();
  await record({ kind: 'pitch', result: 'foul' });
  hear('scratch that');
  await settle();
  assert.deepEqual(plays().map((event) => [event.source, event.command]), [
    ['voice', { kind: 'pitch', result: 'ball' }],
    ['tap', { kind: 'pitch', result: 'foul' }],
  ], 'the foul saved after the press began stays');
  const undo = recorded.at(-1);
  assert.equal(undo?.kind, 'undo');
  assert.equal(undo && 'expectedRevision' in undo ? typeof undo.expectedRevision : null, 'number');
  assert.equal(views.at(-1)?.message, unsaved);
});

test('#65: a spoken undo on the game it started on still undoes the last play', async () => {
  const { hold, plays } = await scorer();
  (await hold())('ball');
  await settle();
  (await hold())('scratch that');
  await settle();
  assert.deepEqual(plays().map((event) => event.command.kind), ['pitch', 'undo']);
});

test('#65: tearing the controller down mid-press puts the bar back to idle', async () => {
  const { controller, hold, views } = await scorer();
  await hold();
  controller.start();
  controller.dispose();
  assert.deepEqual(views.at(-1), { listening: false, card: null, message: null });
});

const ball = { kind: 'pitch', result: 'ball' } as const;

test('ADR 0006: the clear calls save at once as one Play, and only the rest waits on the card', async () => {
  const { controller, game, groups, hold, record, views } = await scorer();
  (await hold())('ball, ball, strike');
  await settle();
  assert.deepEqual(groups(), [[ball, ball]], 'the two balls saved together, before any answer');
  const card = views.at(-1)?.card;
  assert.equal(card?.kind, 'choose');
  if (card?.kind !== 'choose') return;
  assert.equal(card.words, 'strike', 'the card holds only the call it asks about');
  assert.deepEqual(card.choices, ['Strike looking', 'Strike swinging']);
  assert.equal(card.note, 'Looking or swinging? Ball · Ball saved, and Undo takes back just that. Tap one, or use the buttons below.');
  assert.equal(playLabel(game().lastPlay!), 'Ball · Ball', 'the Undo button names the Play it takes back');

  controller.choose(1);
  await settle();
  assert.deepEqual(groups(), [[ball, ball], [{ kind: 'pitch', result: 'swinging_strike' }]], 'the answer is its own Play');
  assert.equal(playLabel(game().lastPlay!), 'Strike');
  await record({ kind: 'undo' });
  assert.deepEqual(game().state.count, { balls: 2, strikes: 0, pitches: 2 }, 'Undo after the answer takes back only the answer');
});

test('ADR 0006: the card never blocks: a tap or the next press drops it, with a line saying what wasn\'t saved', async () => {
  const tapped = await scorer();
  (await tapped.hold())('ball, ball, strike');
  await settle();
  tapped.controller.dismiss();
  assert.deepEqual(tapped.views.at(-1), { listening: false, card: null, message: '1 call not saved: Strike' });
  tapped.controller.choose(0);
  await settle();
  assert.deepEqual(tapped.groups(), [[ball, ball]], 'a dropped card can\'t be answered');

  const spoken = await scorer();
  (await spoken.hold())('Ball, Ramirez singles, steals second');
  await settle();
  const hear = await spoken.hold();
  assert.equal(spoken.views.at(-1)?.message, '2 calls not saved: Ramirez singles, steals second');
  assert.equal(spoken.views.at(-1)?.card?.kind, 'listening', 'the new press listens at once');
  hear('foul');
  await settle();
  assert.deepEqual(spoken.groups(), [[ball], [{ kind: 'pitch', result: 'foul' }]]);
  assert.equal(spoken.views.at(-1)?.message, '2 calls not saved: Ramirez singles, steals second', 'the line stays until the scorer moves on');

  const whole = await scorer();
  (await whole.hold())('strike');
  await settle();
  whole.controller.dismiss();
  assert.equal(whole.views.at(-1)?.message, '1 call not saved: Strike', 'a whole-press card says so too');
});

test('ADR 0006: when the rest can\'t be recorded, the clear calls still save and a line says why', async () => {
  const { groups, hold, views } = await scorer();
  (await hold())('ball, walk');
  await settle();
  assert.deepEqual(groups(), [[ball]]);
  assert.deepEqual(views.at(-1), { listening: false, card: null, message: 'Ball saved. Couldn\'t record "walk": that would be ball 2, not ball four.' });
});

test('a voice fix of the last Play shows a preview, and sends the Fix only after the tap', async () => {
  const { controller, game, groups, hold, recorded, views } = await scorer();
  (await hold())('ball');
  await settle();
  const revision = game().revision;
  (await hold())('no, strike looking');
  await settle();
  const card = views.at(-1)?.card;
  assert.equal(card?.kind, 'choose');
  if (card?.kind !== 'choose') return;
  assert.equal(card.heading, 'Change ball to strike?');
  assert.deepEqual(card.choices, ['Strike looking']);
  assert.deepEqual(groups(), [[ball]], 'nothing changes before the tap');
  assert.equal(recorded.length, 1);

  controller.choose(0);
  await settle();
  assert.deepEqual(recorded.at(-1), { kind: 'fix', at: '2026-10-26T17:01:00.000Z', expectedRevision: revision, commands: [{ kind: 'pitch', result: 'called_strike' }] });
});

test('a dropped voice fix says the fix wasn\'t saved', async () => {
  const { controller, hold, views } = await scorer();
  (await hold())('ball');
  await settle();
  (await hold())('no, strike looking');
  await settle();
  controller.dismiss();
  assert.equal(views.at(-1)?.message, 'Fix not saved: strike looking');
});
