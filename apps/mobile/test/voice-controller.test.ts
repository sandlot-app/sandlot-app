import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { openOfflineGame, type DemoAction, type SavedGame } from '../src/scoring/offline-game.ts';
import { SAMPLE_RATE } from '../src/voice/pcm.ts';
import { createVoiceController, type VoiceView } from '../src/voice/voice-controller.ts';
import { connect } from './database.ts';
import type { Answer, AnswerReading, PressContext } from '@sandlot/voice';
import type { ParseBody, Parsed, Result } from '../src/voice/voice-api.ts';
import { fakeApi, fakeMic, fakeSocket, tick, timeouts } from './voice-fakes.ts';

const settle = () => new Promise((resolve) => setTimeout(resolve, timeouts.openMs + timeouts.finalMs + 30));
const idle: VoiceView = { listening: false, reading: 0, saved: false, card: null, message: null, banner: null };

/** A started offline game, a controller on it, and a fake mic and socket for each press. */
async function scorer(voiceOn = true, gate?: Promise<boolean>, wait = timeouts, flaky = false, parse?: Result<Parsed>) {
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
    // A save that throws once, so a test can check one bad press doesn't stall the ones behind it.
    if (flaky && action.kind === 'voice' && recorded.filter((made) => made.kind === 'voice').length === 1) throw new Error('storage failed');
    const result = await session.record(action);
    if (result.kind === 'saved') game = result.game;
    return result.kind === 'saved';
  };
  const mic = fakeMic();
  let socket = fakeSocket();
  const views: VoiceView[] = [];
  const api = fakeApi(undefined, parse);
  const controller = createVoiceController({
    voice: voiceOn ? { mic, api, openSocket: () => (socket = fakeSocket()), timeouts: wait } : null,
    game: () => game,
    record,
    now: () => Date.parse('2026-10-26T17:01:00.000Z'),
    savedMs: 60,
    readLimitMs: 150,
    onChange: (view) => views.push(view),
  });
  /** One tap opens the mic and a second tap ends it; the final words arrive when `hear` is called. */
  async function say() {
    controller.tap();
    await tick();
    socket.open();
    mic.push([1, 0, 2, 0]);
    controller.tap();
    await tick();
    const heldSocket = socket;
    return (transcript: string) => heldSocket.server({ type: 'conversation.item.input_audio_transcription.completed', transcript });
  }
  const plays = () => game.events.slice(started.game.events.length);
  const commands = () => plays().map((event) => event.command);
  return { controller, record, recorded, views, say, plays, commands, mic, socket: () => socket, game: () => game, sent: () => api.parsed as Extract<ParseBody, { transcript: string }>[] };
}

const lost = "That voice play didn't save. Say it again or tap to score.";

test('a voice play saves once, against the game the press started on', async () => {
  const { say, plays, recorded } = await scorer();
  (await say())('strike swinging');
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

/** A walk to J. Soto, so L. Darcy is up with Soto on first. */
async function walked(scorerOf: Awaited<ReturnType<typeof scorer>>) {
  for (let ball = 0; ball < 4; ball += 1) await scorerOf.record({ kind: 'pitch', result: 'ball' });
}

test('#103: a whole play said in one press goes to the AI with the game, saves once, and the banner names each runner', async () => {
  const words = 'Darcy rips one to the gap and Soto comes around to score';
  const scoring = await scorer(true, undefined, timeouts, false, answering(words, play(double('Darcy', [{ from: '1', to: 'home', ...said('Soto') }]))));
  await walked(scoring);
  (await scoring.say())(words);
  await settle();
  const context: PressContext = scoring.sent()[0]!.context;
  assert.equal(scoring.sent()[0]!.transcript, words);
  assert.deepEqual([context.batter.name, context.runners['1']?.name], ['L. Darcy', 'J. Soto']);
  assert.deepEqual(sorted(scoring.plays().filter((event) => event.source === 'voice').map((event) => event.command)), ['pitch', 'ball_in_play']);
  assert.equal(scoring.views.at(-1)?.banner, 'L. Darcy doubles, J. Soto scores');
  assert.equal(scoring.views.at(-1)?.message, null);
  assert.equal(scoring.game().state.score.away, 1);
});

test('#103: a question shows both readings, each checked by the engine, and the one tapped saves', async () => {
  const words = 'Darcy doubles and the runner scores';
  const question: Answer = { result: 'question', fix_last: false, readings: [
    double('Darcy', [{ from: '1', to: '3', ...nobody }]), double('Darcy', [{ from: '1', to: 'home', ...nobody }])] };
  const scoring = await scorer(true, undefined, timeouts, false, answering(words, question));
  await walked(scoring);
  (await scoring.say())(words);
  await settle();
  const card = scoring.views.at(-1)?.card;
  assert.equal(card?.kind, 'choose');
  assert.deepEqual(card?.kind === 'choose' && card.choices, ['L. Darcy doubles, J. Soto to 3rd', 'L. Darcy doubles, J. Soto scores']);
  assert.equal(scoring.plays().filter((event) => event.source === 'voice').length, 0, 'nothing saves before a tap');
  scoring.controller.choose(1);
  await settle();
  assert.equal(scoring.game().state.score.away, 1);
});

test('#103: a name in the wrong role saves nothing, and the line says who is up', async () => {
  const scoring = await scorer(true, undefined, timeouts, false, answering('Vance doubles', play(double('Vance', []))));
  await walked(scoring);
  (await scoring.say())('Vance doubles');
  await settle();
  assert.equal(scoring.plays().filter((event) => event.source === 'voice').length, 0);
  assert.equal(scoring.views.at(-1)?.message, 'L. Darcy is up, not C. Vance.');
});

test('#103: a fix, an answer voice-parse could not use, and a timeout each save nothing and point to taps', async () => {
  const fix: Answer = { result: 'play', fix_last: true, readings: [double('Soto', [])] };
  for (const [parse, line] of [
    [answering('no, that was a double', fix), "Fixing a play by voice isn't ready yet. Tap Undo, then say the play again."],
    [answering('Soto rips one', null), "Couldn't read that. Tap to score."],
    [{ ok: false, failure: 'timeout' }, "That took too long and didn't save. Say it again or tap to score."],
  ] as const) {
    const scoring = await scorer(true, undefined, timeouts, false, parse);
    (await scoring.say())('Soto rips one');
    await settle();
    assert.deepEqual(scoring.plays(), []);
    assert.equal(scoring.views.at(-1)?.message, line);
  }
});

test('#88: a queued press the AI read does not save on a game the AI never saw, and says so', async () => {
  const words = 'Soto doubles';
  const { controller, mic, plays, views, socket } = await scorer(true, undefined, { openMs: 30, finalMs: 2000 }, false, answering(words, play(double('Soto', []))));
  const sockets: ReturnType<typeof socket>[] = [];
  for (let press = 0; press < 2; press += 1) {
    controller.tap();
    await tick();
    socket().open();
    mic.push([1, 0, 2, 0]);
    sockets.push(socket());
    controller.tap();
  }
  const said = (index: number, transcript: string) => sockets[index]!.server({ type: 'conversation.item.input_audio_transcription.completed', transcript });
  said(1, words);
  said(0, 'ball');
  await settle();
  assert.deepEqual(plays().map((event) => event.command), [{ kind: 'pitch', result: 'ball' }], 'only the press the phone read saves');
  assert.equal(views.at(-1)?.message, lost);
});

test('#88: a press the AI read after an earlier voice play has saved still saves, because the AI saw that game', async () => {
  const words = 'Soto doubles';
  const { say, plays } = await scorer(true, undefined, timeouts, false, answering(words, play(double('Soto', []))));
  (await say())('ball');
  await settle();
  (await say())(words);
  await settle();
  assert.deepEqual(plays().map((event) => event.command.kind), ['pitch', 'pitch', 'ball_in_play']);
});

test('#88: a touch of any length opens the mic and nothing but a second tap or 30 s closes it', async () => {
  const { controller, mic, recorded, views, plays, socket } = await scorer();
  controller.tap();
  await tick();
  assert.equal(views.at(-1)?.listening, true, 'a touch of any length opens the mic');
  socket().open();
  mic.push([1, 0, 2, 0]);
  // 20 s of a quiet mic, with no new words, is not a reason to close: there is no pause ending.
  const quiet = new Array<number>(SAMPLE_RATE * 2).fill(0);
  for (let second = 0; second < 20; second += 1) mic.push(quiet);
  await tick();
  assert.equal(views.at(-1)?.listening, true);
  assert.equal(views.at(-1)?.reading, 0);
  assert.equal(mic.stopped, 0, 'the mic is still open');
  assert.deepEqual(recorded, []);
  assert.deepEqual(plays(), []);
});

test('#88: a second tap ends the press and its words save', async () => {
  const { controller, mic, plays, views, socket } = await scorer();
  controller.tap();
  await tick();
  socket().open();
  mic.push([1, 0, 2, 0]);
  socket().server({ type: 'conversation.item.input_audio_transcription.delta', delta: 'strike swinging' });
  assert.deepEqual(views.at(-1)?.card, { kind: 'listening', words: 'strike swinging' }, 'live words show while the mic is open');
  assert.deepEqual(plays(), [], 'no play saves while the mic is open');
  controller.tap();
  assert.equal(views.at(-1)?.listening, false);
  assert.equal(views.at(-1)?.reading, 1, 'the bar says the play is being read');
  socket().server({ type: 'conversation.item.input_audio_transcription.completed', transcript: 'strike swinging' });
  await settle();
  assert.deepEqual(plays().map((event) => event.command), [{ kind: 'pitch', result: 'swinging_strike' }]);
  const lastReading = views.map((view) => view.reading).lastIndexOf(1);
  assert.deepEqual([views[lastReading + 1]?.reading, views[lastReading + 1]?.saved], [0, true], '"Saved" comes up in the same update the reading ends, so the bar never flashes the button between them');
  await new Promise((resolve) => setTimeout(resolve, 200));
  assert.equal(views.at(-1)?.saved, false, 'and goes after a moment, so the button comes back');
});

test('#88: 30 s of audio ends the press by itself and the play saves', async () => {
  const { controller, mic, plays, views, socket } = await scorer();
  controller.tap();
  await tick();
  socket().open();
  const second = new Array<number>(SAMPLE_RATE * 2).fill(1);
  for (let index = 0; index < 29; index += 1) mic.push(second);
  assert.equal(views.at(-1)?.listening, true, 'still open at 29 s');
  mic.push(second);
  mic.push(second);
  assert.equal(views.at(-1)?.listening, false, 'closed at 30 s with no tap');
  assert.equal(views.at(-1)?.reading, 1);
  socket().server({ type: 'conversation.item.input_audio_transcription.completed', transcript: 'ball' });
  await settle();
  assert.deepEqual(plays().map((event) => event.command), [{ kind: 'pitch', result: 'ball' }]);
});

test('#88: two queued presses both save, in the order they ended, each against the game after the one before', async () => {
  // A long wait for the first press's words, so a slow machine never makes it give up before the second is read.
  const { controller, mic, plays, recorded, views, socket } = await scorer(true, undefined, { openMs: 30, finalMs: 2000 });
  const sockets: ReturnType<typeof socket>[] = [];
  const press = async () => {
    controller.tap();
    await tick();
    socket().open();
    mic.push([1, 0, 2, 0]);
    sockets.push(socket());
    controller.tap();
  };
  await press();
  await press();
  assert.equal(views.at(-1)?.reading, 2, 'a new press does not cancel the one being read');
  const said = (index: number, transcript: string) => sockets[index]!.server({ type: 'conversation.item.input_audio_transcription.completed', transcript });
  // The second press is read first, but it still saves second.
  said(1, 'ball');
  // Less than the socket's own timeout, so the first press is still waiting for its words.
  await tick();
  await tick();
  assert.deepEqual(plays(), [], 'the second press waits for the first');
  said(0, 'strike swinging');
  await settle();
  assert.deepEqual(plays().map((event) => event.command), [{ kind: 'pitch', result: 'swinging_strike' }, { kind: 'pitch', result: 'ball' }]);
  assert.equal(recorded.length, 2);
  assert.equal(views.at(-1)?.reading, 0);
  assert.equal(views.at(-1)?.message, null, 'neither press was refused as stale');
});

test('#88: a scoring-button tap drops the open press, and a press that already ended still saves', async () => {
  // A long wait for the first press's words, so a slow machine never makes it give up before the words arrive.
  const { controller, mic, say, plays, views, socket } = await scorer(true, undefined, { openMs: 30, finalMs: 2000 });
  const hearFirst = await say();
  controller.tap();
  await tick();
  socket().open();
  mic.push([1, 0, 2, 0]);
  controller.dismiss();
  assert.equal(views.at(-1)?.listening, false, 'the open press is dropped');
  assert.equal(views.at(-1)?.reading, 1, 'the press that ended is still being read');
  hearFirst('ball');
  await settle();
  assert.deepEqual(plays().map((event) => event.command), [{ kind: 'pitch', result: 'ball' }]);
  assert.equal(mic.stopped, 2, 'both presses closed their mic');
});

test('#88: a dropped press saves nothing, even if its words were already read', async () => {
  const { controller, mic, plays, recorded, socket } = await scorer();
  controller.tap();
  await tick();
  socket().open();
  mic.push([1, 0, 2, 0]);
  socket().server({ type: 'conversation.item.input_audio_transcription.completed', transcript: 'ball' });
  controller.dismiss();
  await settle();
  assert.deepEqual(plays(), []);
  assert.deepEqual(recorded, []);
});

test('#88: a press that can\'t be read saves nothing and tells the scorer what happened', async () => {
  const { say, plays, views } = await scorer();
  (await say())('um the weather is nice');
  await settle();
  assert.deepEqual(plays(), []);
  assert.ok(views.at(-1)?.message, 'the scorer hears why nothing saved');
  assert.equal(views.at(-1)?.reading, 0);
  assert.equal(views.at(-1)?.saved, false);
});

test('#88: tearing down while presses are queued saves none of them, even one whose answer already arrived', async () => {
  const { controller, mic, plays, recorded, socket } = await scorer(true, undefined, { openMs: 30, finalMs: 2000 });
  const sockets: ReturnType<typeof socket>[] = [];
  for (let press = 0; press < 2; press += 1) {
    controller.tap();
    await tick();
    socket().open();
    mic.push([1, 0, 2, 0]);
    sockets.push(socket());
    controller.tap();
  }
  const said = (index: number, transcript: string) => sockets[index]!.server({ type: 'conversation.item.input_audio_transcription.completed', transcript });
  said(1, 'ball');
  await tick();
  controller.dispose();
  said(0, 'strike swinging');
  await settle();
  assert.deepEqual(plays(), [], 'leaving the screen drops every press, so nothing saves after it');
  assert.deepEqual(recorded, []);
});

test('#88: a press that throws while it settles frees the bar, and the press behind it still saves', async () => {
  const { controller, mic, plays, views, socket } = await scorer(true, undefined, { openMs: 30, finalMs: 2000 }, true);
  const sockets: ReturnType<typeof socket>[] = [];
  for (let press = 0; press < 2; press += 1) {
    controller.tap();
    await tick();
    socket().open();
    mic.push([1, 0, 2, 0]);
    sockets.push(socket());
    controller.tap();
  }
  const said = (index: number, transcript: string) => sockets[index]!.server({ type: 'conversation.item.input_audio_transcription.completed', transcript });
  said(0, 'strike swinging');
  said(1, 'ball');
  await settle();
  assert.deepEqual(plays().map((event) => event.command), [{ kind: 'pitch', result: 'ball' }], 'the second press saved');
  assert.equal(views.at(-1)?.reading, 0, 'nothing is left reading');
});

test('#88: a press whose answer never arrives frees the bar and says so, and its late words save nothing', async () => {
  const { say, plays, views } = await scorer(true, undefined, { openMs: 30, finalMs: 5000 });
  const hear = await say();
  assert.equal(views.at(-1)?.reading, 1);
  await new Promise((resolve) => setTimeout(resolve, 250));
  assert.equal(views.at(-1)?.reading, 0, 'the scoring buttons are back');
  assert.equal(views.at(-1)?.message, "That took too long and didn't save. Say it again or tap to score.");
  hear('ball');
  await settle();
  assert.deepEqual(plays(), [], 'the late answer is ignored');
});

test('#88: a mic that never answers frees the bar too', async () => {
  const { controller, mic, views } = await scorer();
  mic.start = () => new Promise(() => {});
  controller.tap();
  await tick();
  controller.tap();
  assert.equal(views.at(-1)?.reading, 1);
  await new Promise((resolve) => setTimeout(resolve, 250));
  assert.equal(views.at(-1)?.reading, 0);
});

test('#88: the press behind one that timed out still saves', async () => {
  const { controller, mic, plays, socket } = await scorer(true, undefined, { openMs: 30, finalMs: 5000 });
  const sockets: ReturnType<typeof socket>[] = [];
  for (let press = 0; press < 2; press += 1) {
    controller.tap();
    await tick();
    socket().open();
    mic.push([1, 0, 2, 0]);
    sockets.push(socket());
    controller.tap();
    // The first press has nearly used its time when the second ends, so only the first runs out.
    if (press === 0) await new Promise((resolve) => setTimeout(resolve, 100));
  }
  sockets[1]!.server({ type: 'conversation.item.input_audio_transcription.completed', transcript: 'ball' });
  await new Promise((resolve) => setTimeout(resolve, 120));
  assert.deepEqual(plays().map((event) => event.command), [{ kind: 'pitch', result: 'ball' }]);
});

test('#88: a forgotten second tap: a play followed by stray talk does not save a play the phone cannot read', async () => {
  // With no pause ending, a scorer who says "ball" and forgets to tap sends everything heard until 30 s. The phone's
  // reader doesn't guess: this goes to the AI reader, and when that can't help, nothing saves and the scorer is told.
  // What the AI reader itself does with stray talk is for the real-speech test (#101) and the reader (#103).
  const { say, plays, views } = await scorer();
  (await say())('ball nice swing two outs come on Marco');
  await settle();
  assert.deepEqual(plays(), []);
  assert.ok(views.at(-1)?.message, 'the scorer hears that nothing saved');
  assert.equal(views.at(-1)?.saved, false);
});

test('#88: a Not sure choice whose save throws tells the scorer instead of failing silently', async () => {
  const { controller, say, views, plays } = await scorer(true, undefined, timeouts, true);
  (await say())('strike');
  await settle();
  assert.equal(views.at(-1)?.card?.kind, 'choose');
  controller.choose(0);
  await settle();
  assert.deepEqual(plays(), []);
  assert.equal(views.at(-1)?.message, lost);
});

test('#88: a press that is mid-save when the screen is torn down shows nothing afterwards', async () => {
  let answer: (saved: boolean) => void = () => {};
  const { controller, say, views } = await scorer(true, new Promise((resolve) => { answer = resolve; }));
  (await say())('ball');
  await new Promise((resolve) => setTimeout(resolve, 60));
  controller.dispose();
  const shown = views.length;
  answer(true);
  await new Promise((resolve) => setTimeout(resolve, 200));
  assert.equal(views.length, shown, 'no update reaches the screen after teardown');
  assert.deepEqual(views.at(-1), idle);
});

test('a tap saved while a press is read makes the press stale, so it never writes on top', async () => {
  const { say, plays, record, recorded, views } = await scorer();
  const hear = await say();
  await record({ kind: 'pitch', result: 'ball' });
  hear('strike swinging');
  await settle();
  assert.deepEqual(plays().map((event) => event.source), ['tap']);
  assert.equal(recorded.at(-1)?.kind, 'voice', 'the press tried, and the engine refused the stale revision');
  assert.equal(views.at(-1)?.message, lost);
});

test('a Not sure choice saves the reading tapped, and a tap instead clears the card', async () => {
  const first = await scorer();
  (await first.say())('strike');
  await settle();
  assert.equal(first.views.at(-1)?.card?.kind, 'choose');
  first.controller.choose(1);
  await settle();
  assert.deepEqual(first.commands(), [{ kind: 'pitch', result: 'swinging_strike' }]);

  const second = await scorer();
  (await second.say())('strike');
  await settle();
  second.controller.dismiss();
  second.controller.choose(0);
  await settle();
  assert.deepEqual(second.plays(), [], 'the choice is gone once the scorer taps a button');
});

test('D4: the same play said again right after an undo saves, because the undo cleared the duplicate guard', async () => {
  const { controller, say, plays, record, views } = await scorer();
  (await say())('ball');
  await settle();
  controller.dismiss();
  await record({ kind: 'undo' });
  (await say())('ball');
  await settle();
  assert.equal(views.at(-1)?.card, null, 'no "check this play" card');
  assert.deepEqual(plays().filter((event) => event.source === 'voice').map((event) => event.command), [{ kind: 'pitch', result: 'ball' }, { kind: 'pitch', result: 'ball' }]);
});

test('with voice off, a touch shows the unavailable line and no Listening card', async () => {
  const { controller, views } = await scorer(false);
  controller.tap();
  assert.deepEqual(views.at(-1), { ...idle, message: 'Voice is unavailable right now. Tap to score.' });
});

test('#65: a refusal that lands after the scorer moved on stays quiet', async () => {
  let answer: (saved: boolean) => void = () => {};
  const { controller, say, views } = await scorer(true, new Promise((resolve) => { answer = resolve; }));
  (await say())('ball');
  await settle();
  controller.dismiss();
  answer(false);
  await settle();
  assert.deepEqual(views.at(-1), idle);
});

test('#65: a voice play the engine refuses as stale says it didn\'t save', async () => {
  const { say, record, views } = await scorer();
  const hear = await say();
  await record({ kind: 'pitch', result: 'ball' });
  hear('strike swinging');
  await settle();
  assert.equal(views.at(-1)?.message, lost);
});

test('#65: a spoken undo is pinned to its press, so after another save it undoes nothing', async () => {
  const { say, plays, record, recorded, views } = await scorer();
  (await say())('ball');
  await settle();
  const hear = await say();
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
  assert.equal(views.at(-1)?.message, lost);
});

test('#65: a spoken undo on the game it started on still undoes the last play', async () => {
  const { say, plays } = await scorer();
  (await say())('ball');
  await settle();
  (await say())('scratch that');
  await settle();
  assert.deepEqual(plays().map((event) => event.command.kind), ['pitch', 'undo']);
});

test('#65: tearing the controller down mid-press puts the bar back to idle', async () => {
  const { controller, say, views } = await scorer();
  await say();
  controller.tap();
  controller.dispose();
  assert.deepEqual(views.at(-1), idle);
});
