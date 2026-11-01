import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { openOfflineGame, type DemoAction, type SavedGame } from '../src/scoring/offline-game.ts';
import { createVoiceController, type VoiceView } from '../src/voice/voice-controller.ts';
import { connect } from './database.ts';
import type { Answer, AnswerReading, PressContext } from '@sandlot/voice';
import type { ParseBody, Parsed, Result } from '../src/voice/voice-api.ts';
import { fakeApi, fakeMic, fakeSocket, tick, timeouts } from './voice-fakes.ts';

const settle = () => new Promise((resolve) => setTimeout(resolve, timeouts.openMs + timeouts.finalMs + 30));

/** A started offline game, a controller on it, and a fake mic and socket for each press. */
async function scorer(voiceOn = true, gate?: Promise<boolean>, parse?: Result<Parsed>) {
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
  const api = fakeApi(undefined, parse);
  const controller = createVoiceController({
    voice: voiceOn ? { mic, api, openSocket: () => (socket = fakeSocket()), timeouts } : null,
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
  return { controller, record, recorded, views, hold, plays, game: () => game, sent: () => api.parsed as Extract<ParseBody, { transcript: string }>[] };
}

test('a voice play saves once, against the game the press started on', async () => {
  const { hold, plays, recorded } = await scorer();
  (await hold())('strike swinging');
  await settle();
  assert.deepEqual(plays().map((event) => [event.source, event.command]), [['voice', { kind: 'pitch', result: 'swinging_strike' }]]);
  assert.equal(recorded.length, 1);
});

const nobody = { name: null, number: null };
const said = (name: string) => ({ name, number: null });
const double = (batter: string, runners: NonNullable<AnswerReading['ball_in_play']>['runners']): AnswerReading => ({
  batter: said(batter), earlier_batters: [], pitcher: nobody, pitches: [], runner_events: [], runner_events_after: [], forced_runners: [], taken_back: [],
  ball_in_play: { outcome: 'double', trajectory: null, fielders: [], batter_to: '2', runners, batter_out_first: false },
});
const answering = (transcript: string, answer: Answer | null): Result<Parsed> => ({ ok: true, value: { transcript, answer } });
const play = (reading: AnswerReading): Answer => ({ result: 'play', fix_last: false, readings: [reading] });
const sorted = (commands: unknown[]) => commands.map((command) => (command as { kind: string }).kind);

/** A walk to K. Moss, so J. Ruiz is up with Moss on first. */
async function walked(scorerOf: Awaited<ReturnType<typeof scorer>>) {
  for (let ball = 0; ball < 4; ball += 1) await scorerOf.record({ kind: 'pitch', result: 'ball' });
}

test('#103: a whole play said in one press goes to the AI with the game, saves once, and the banner names each runner', async () => {
  const words = 'Ruiz rips one to the gap and Moss comes around to score';
  const scoring = await scorer(true, undefined, answering(words, play(double('Ruiz', [{ from: '1', to: 'home', ...said('Moss') }]))));
  await walked(scoring);
  (await scoring.hold())(words);
  await settle();
  const context: PressContext = scoring.sent()[0]!.context;
  assert.equal(scoring.sent()[0]!.transcript, words);
  assert.deepEqual([context.batter.name, context.runners['1']?.name], ['J. Ruiz', 'K. Moss']);
  assert.deepEqual(sorted(scoring.plays().filter((event) => event.source === 'voice').map((event) => event.command)), ['pitch', 'ball_in_play']);
  assert.deepEqual(scoring.views.at(-1), { listening: false, card: null, message: null, banner: 'J. Ruiz doubles, K. Moss scores' });
  assert.equal(scoring.game().state.score.away, 1);
});

test('#103: a question shows both readings, each checked by the engine, and the one tapped saves', async () => {
  const words = 'Ruiz doubles and the runner scores';
  const question: Answer = { result: 'question', fix_last: false, readings: [
    double('Ruiz', [{ from: '1', to: '3', ...nobody }]), double('Ruiz', [{ from: '1', to: 'home', ...nobody }])] };
  const scoring = await scorer(true, undefined, answering(words, question));
  await walked(scoring);
  (await scoring.hold())(words);
  await settle();
  const card = scoring.views.at(-1)?.card;
  assert.equal(card?.kind, 'choose');
  assert.deepEqual(card?.kind === 'choose' && card.choices, ['J. Ruiz doubles, K. Moss to 3rd', 'J. Ruiz doubles, K. Moss scores']);
  assert.equal(scoring.plays().filter((event) => event.source === 'voice').length, 0, 'nothing saves before a tap');
  scoring.controller.choose(1);
  await settle();
  assert.equal(scoring.game().state.score.away, 1);
});

test('#103: a name in the wrong role saves nothing, and the line says who is up', async () => {
  const scoring = await scorer(true, undefined, answering('Bell doubles', play(double('Bell', []))));
  await walked(scoring);
  (await scoring.hold())('Bell doubles');
  await settle();
  assert.equal(scoring.plays().filter((event) => event.source === 'voice').length, 0);
  assert.equal(scoring.views.at(-1)?.message, 'J. Ruiz is up, not S. Bell.');
});

test('#103: a fix, an answer voice-parse could not use, and a timeout each save nothing and point to taps', async () => {
  const fix: Answer = { result: 'play', fix_last: true, readings: [double('Soto', [])] };
  for (const [parse, line] of [
    [answering('no, that was a double', fix), "Fixing a play by voice isn't ready yet. Tap Undo, then say the play again."],
    [answering('Soto rips one', null), "Couldn't read that. Tap to score."],
    [{ ok: false, failure: 'timeout' }, 'Voice is unavailable right now. Tap to score.'],
  ] as const) {
    const scoring = await scorer(true, undefined, parse);
    (await scoring.hold())('Soto rips one');
    await settle();
    assert.deepEqual(scoring.plays(), []);
    assert.equal(scoring.views.at(-1)?.message, line);
  }
});

test('a tap after letting go takes over: the voice result that arrives later saves nothing', async () => {
  const { controller, hold, plays, record, views } = await scorer();
  const hear = await hold();
  controller.dismiss();
  await record({ kind: 'pitch', result: 'called_strike' });
  hear('strike swinging');
  await settle();
  assert.deepEqual(plays().map((event) => [event.source, event.command]), [['tap', { kind: 'pitch', result: 'called_strike' }]], 'one strike, not two');
  assert.deepEqual(views.at(-1), { listening: false, card: null, message: null, banner: null });
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
  assert.deepEqual(views.at(-1), { listening: false, card: null, message: 'Voice is unavailable right now. Tap to score.', banner: null });
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
  assert.equal(views.at(-1)?.banner, 'Ball → count 1–0', 'the new press\'s banner');

  const again = await scorer();
  const lostFirst = await again.hold();
  const hearReplacement = await again.hold();
  assert.equal(again.views.at(-1)?.message, lost);
  lostFirst('strike swinging');
  hearReplacement('ball');
  await settle();
  assert.deepEqual(again.plays().map((event) => event.command), [{ kind: 'pitch', result: 'ball' }]);
  assert.equal(again.views.at(-1)?.message, null, 'the lost line gives way to the replacement press\'s banner');
  assert.equal(again.views.at(-1)?.banner, 'Ball → count 1–0');
});

test('#65: a refusal that lands after the scorer moved on stays quiet', async () => {
  let answer: (saved: boolean) => void = () => {};
  const { controller, hold, views } = await scorer(true, new Promise((resolve) => { answer = resolve; }));
  (await hold())('ball');
  await settle();
  controller.dismiss();
  answer(false);
  await settle();
  assert.deepEqual(views.at(-1), { listening: false, card: null, message: null, banner: null });
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
  assert.deepEqual(views.at(-1), { listening: false, card: null, message: null, banner: null });
});
