import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { openOfflineGame, type DemoAction, type SavedGame } from '../src/scoring/offline-game.ts';
import { barPhase, barView, type MicStatus } from '../src/voice/mic-status.ts';
import { SAMPLE_RATE } from '../src/voice/pcm.ts';
import { createVoiceController, type VoiceView } from '../src/voice/voice-controller.ts';
import { createWarmMic, type AudioSource, type Permission } from '../src/voice/warm-mic.ts';
import { connect } from './database.ts';
import type { Parsed, Result } from '../src/voice/voice-api.ts';
import { fakeApi, fakeSocket, tick, timeouts } from './voice-fakes.ts';

// The warm mic (ADR 0005) through the voice controller, with a fake mic, clock and socket. Each 100 ms chunk is
// filled with its own number, so a test can read which audio a press started with.

const chunkMs = 100;
const chunk = (fill: number) => new Uint8Array(SAMPLE_RATE * 2 * chunkMs / 1000).fill(fill);

/** The audio a fake socket was sent, as the fill number of each 100 ms chunk, in order. */
function audioSent(socket: ReturnType<typeof fakeSocket>): number[] {
  return socket.sent.filter((event) => event.type === 'input_audio_buffer.append')
    .flatMap((event) => [...Buffer.from(String(event.audio), 'base64')])
    .filter((_, index) => index % chunk(0).length === 0);
}

/** `answer` is what the scorer says when iOS asks, which only happens while the permission is undetermined. */
function fakeSource(permission: Permission = 'granted', answer: Permission = 'granted') {
  let push: ((bytes: Uint8Array, rate: number) => void) | null = null;
  const source: AudioSource & {
    permissionNow: Permission; opened: number; asked: number; closed: number; busy: boolean; gate: Promise<void> | null;
    hear(bytes: Uint8Array, rate?: number): void;
  } = {
    permissionNow: permission,
    busy: false,
    /** Holds `open` until it resolves, like iOS waiting on the scorer. */
    gate: null,
    opened: 0,
    asked: 0,
    closed: 0,
    async permission() { return source.permissionNow; },
    async open(onChunk) {
      source.opened += 1;
      await source.gate;
      if (source.busy) return 'failed';
      if (source.permissionNow === 'undetermined') {
        source.asked += 1;
        source.permissionNow = answer;
      }
      if (source.permissionNow === 'denied') return 'refused';
      push = onChunk;
      return 'started';
    },
    close() { source.closed += 1; push = null; },
    hear(bytes, rate = SAMPLE_RATE) { push?.(bytes, rate); },
  };
  return source;
}

/** A started offline game, a warm mic on a fake source and clock, and a controller whose presses use that mic. */
async function scorer({ permission = 'granted', wait = async () => {}, answer = 'granted', parse }: {
  permission?: Permission;
  wait?: (ms: number) => Promise<void>;
  answer?: Permission;
  /** What voice-parse answers when a press sends it the recording. */
  parse?: Result<Parsed>;
} = {}) {
  const session = await openOfflineGame(connect(':memory:'), { newId: randomUUID, now: () => '2026-10-26T17:00:00.000Z' });
  if (session.kind !== 'ready') throw new Error('Session must open');
  const started = await session.record({ kind: 'start' });
  if (started.kind !== 'saved') throw new Error('Game must start');
  let game: SavedGame = started.game;
  const record = async (action: DemoAction) => {
    const result = await session.record(action);
    if (result.kind === 'saved') game = result.game;
    return result.kind === 'saved';
  };
  let clock = 0;
  const source = fakeSource(permission, answer);
  const statuses: MicStatus[] = [];
  const warm = createWarmMic({ source, now: () => clock, wait, onStatus: (status) => statuses.push(status) });
  const api = fakeApi(undefined, parse);
  const sessions: string[][] = [];
  const openSession = api.session;
  api.session = (names) => { sessions.push(names); return openSession(names); };
  const sockets: ReturnType<typeof fakeSocket>[] = [];
  const views: VoiceView[] = [];
  const controller = createVoiceController({
    voice: { mic: warm.mic, api, openSocket: () => { const socket = fakeSocket(); sockets.push(socket); return socket; }, timeouts },
    game: () => game,
    record,
    now: () => Date.parse('2026-10-26T17:01:00.000Z'),
    onChange: (view) => views.push(view),
  });
  /** The phone's mic delivers `count` chunks of audio, one every 100 ms, numbered from `first`. */
  const hearFor = (first: number, count: number) => {
    for (let index = 0; index < count; index += 1) {
      clock += chunkMs;
      source.hear(chunk(first + index));
    }
  };
  const plays = () => game.events.slice(started.game.events.length);
  return { warm, source, statuses, api, sessions, sockets, views, controller, record, hearFor, plays, advance: (ms: number) => { clock += ms; } };
}

test('a press begins with the second before the touch, then goes on with the live audio', async () => {
  const { warm, controller, sockets, hearFor } = await scorer();
  warm.warm(true);
  await tick();
  hearFor(1, 20);
  controller.tap();
  await tick();
  sockets[0]!.open();
  hearFor(21, 2);
  assert.deepEqual(audioSent(sockets[0]!), [11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22]);
});

test('live audio that arrives while a press is still starting waits behind the second before the touch', async () => {
  const { warm, hearFor } = await scorer();
  warm.warm(true);
  await tick();
  hearFor(1, 2);
  const received: number[] = [];
  const started = warm.mic.start((bytes) => received.push(bytes[0]!));
  hearFor(3, 1);
  await started;
  hearFor(4, 1);
  assert.deepEqual(received, [1, 2, 3, 4]);
});

test('live audio that arrives while a press opens the mic itself is kept for that press, in order', async () => {
  const { source, warm, hearFor } = await scorer();
  let answer: () => void = () => {};
  source.gate = new Promise((resolve) => { answer = resolve; });
  const received: number[] = [];
  const started = warm.mic.start((bytes) => received.push(bytes[0]!));
  await tick();
  answer();
  await started;
  hearFor(1, 2);
  assert.deepEqual(received, [1, 2]);
});

test('nothing is sent while the mic is only warm: no session, no socket, no parse', async () => {
  const { warm, api, sessions, sockets, hearFor } = await scorer();
  warm.warm(true);
  await tick();
  hearFor(1, 50);
  await tick();
  assert.deepEqual([sessions.length, sockets.length, api.parsed.length], [0, 0, 0]);
});

test('leaving the screen stops the mic and throws its audio away, so the next press starts cold', async () => {
  const { warm, source, controller, sockets, hearFor } = await scorer();
  warm.warm(true);
  await tick();
  hearFor(1, 10);
  warm.warm(false);
  assert.equal(source.closed, 1);
  controller.tap();
  await tick();
  sockets[0]!.open();
  hearFor(11, 2);
  assert.equal(source.opened, 2, 'the press opened the mic itself');
  assert.deepEqual(audioSent(sockets[0]!), [11, 12], 'nothing from before the screen was left');
});

test('a refused mic: the bar says to turn it on in Settings, a press says why it can\'t listen, and tap scoring still works', async () => {
  const { warm, statuses, controller, views, record, plays } = await scorer({ permission: 'denied' });
  warm.warm(true);
  await tick();
  assert.deepEqual(statuses, ['refused']);
  controller.tap();
  await tick();
  assert.equal(views.at(-1)?.message, 'Sandlot can’t use the microphone. Allow it in Settings, or tap to score.');
  assert.equal(views.at(-1)?.listening, false);
  assert.equal(await record({ kind: 'pitch', result: 'ball' }), true);
  assert.deepEqual(plays().map((event) => [event.source, event.command]), [['tap', { kind: 'pitch', result: 'ball' }]]);
});

test('the first time on the screen the line is up before iOS asks, and the mic comes on after; later visits skip the line', async () => {
  let pass: () => void = () => {};
  const { warm, source, statuses } = await scorer({ permission: 'undetermined', wait: () => new Promise((resolve) => { pass = resolve; }) });
  warm.warm(true);
  await tick();
  assert.deepEqual(statuses, ['explain']);
  assert.equal(source.asked, 0, 'iOS has not been asked yet');
  pass();
  await tick();
  assert.deepEqual(statuses, ['explain', 'ready']);
  assert.equal(source.asked, 1);
  warm.warm(false);
  warm.warm(true);
  await tick();
  assert.deepEqual(statuses, ['explain', 'ready', 'off', 'ready'], 'an answered question is not explained again');
  assert.equal(source.asked, 1);
});

test('saying no when iOS asks leaves the bar pointing to Settings', async () => {
  const { warm, statuses } = await scorer({ permission: 'undetermined', answer: 'denied' });
  warm.warm(true);
  await tick();
  assert.deepEqual(statuses, ['explain', 'refused']);
});

test('a press during the first-open line asks iOS itself, and the line\'s timer then does nothing', async () => {
  let pass: () => void = () => {};
  const { warm, source, statuses, controller, views } = await scorer({
    permission: 'undetermined', answer: 'denied', wait: () => new Promise((resolve) => { pass = resolve; }),
  });
  warm.warm(true);
  await tick();
  controller.tap();
  await tick();
  assert.equal(source.asked, 1, 'the touch asked iOS');
  assert.equal(views.at(-1)?.message, 'Sandlot can’t use the microphone. Allow it in Settings, or tap to score.');
  pass();
  await tick();
  assert.equal(source.opened, 1, 'the timer did not open the stream a second time');
  assert.deepEqual(statuses, ['explain', 'refused']);
});

test('a press during the first-open line that the scorer allows leaves the mic ready, opened once', async () => {
  let pass: () => void = () => {};
  const { warm, source, statuses, controller, views } = await scorer({
    permission: 'undetermined', wait: () => new Promise((resolve) => { pass = resolve; }),
  });
  warm.warm(true);
  await tick();
  controller.tap();
  await tick();
  assert.equal(views.at(-1)?.listening, true);
  pass();
  await tick();
  assert.equal(source.opened, 1);
  assert.deepEqual(statuses, ['explain', 'ready']);
});

test('coming back from Settings with the mic turned on makes it ready again', async () => {
  const { warm, source, statuses } = await scorer({ permission: 'denied' });
  warm.warm(true);
  await tick();
  warm.warm(false);
  source.permissionNow = 'granted';
  warm.warm(true);
  await tick();
  assert.deepEqual(statuses, ['refused', 'off', 'ready']);
});

const cantUseMic = 'Sandlot can’t use the microphone. Allow it in Settings, or tap to score.';

test('allowing the mic in Settings clears the "can\'t use the microphone" line once the mic is ready', async () => {
  const { warm, source, controller, views } = await scorer({ permission: 'denied' });
  warm.warm(true);
  await tick();
  controller.tap();
  await tick();
  assert.equal(views.at(-1)?.message, cantUseMic);
  warm.warm(false);
  source.permissionNow = 'granted';
  warm.warm(true);
  await tick();
  controller.micReady();
  assert.deepEqual(views.at(-1), { listening: false, reading: 0, saved: false, card: null, message: null });
});

test('the mic being ready clears only that line, and leaves a press that is listening alone', async () => {
  const other = await pressHearingNothing({ parse: { ok: true, value: { transcript: '', parsed: null } } });
  assert.equal(other.views.at(-1)?.message, didntCatch);
  other.controller.micReady();
  assert.equal(other.views.at(-1)?.message, didntCatch, 'a different line stays');

  const listening = await scorer();
  listening.warm.warm(true);
  await tick();
  listening.controller.tap();
  await tick();
  const before = listening.views.at(-1);
  listening.controller.micReady();
  assert.deepEqual(listening.views.at(-1), before);
  assert.equal(before?.listening, true);
});

test('without the warm mic (Android until its device check passes) a press opens the mic on touch-down and closes it on release', async () => {
  const { source, controller, sockets, hearFor } = await scorer();
  controller.tap();
  await tick();
  assert.equal(source.opened, 1);
  sockets[0]!.open();
  hearFor(1, 2);
  controller.tap();
  assert.equal(source.closed, 1, 'no mic indicator once the press is over');
  assert.deepEqual(audioSent(sockets[0]!), [1, 2], 'there was nothing before the touch to start with');
});

test('with the warm mic a press ends without stopping the mic, and the next press never starts with audio the last one already used', async () => {
  const { warm, source, controller, sockets, hearFor } = await scorer();
  warm.warm(true);
  await tick();
  hearFor(1, 3);
  controller.tap();
  await tick();
  sockets[0]!.open();
  hearFor(4, 3);
  controller.tap();
  assert.equal(source.closed, 0, 'the screen is still open');
  hearFor(7, 3);
  controller.tap();
  await tick();
  sockets[1]!.open();
  assert.deepEqual(audioSent(sockets[0]!), [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(audioSent(sockets[1]!), [7, 8, 9], 'only what was heard since the last press ended');
});

test('another app holding the mic: the bar points to tap scoring, and the next press tries the mic again', async () => {
  const { warm, source, statuses, controller, views, sockets, hearFor } = await scorer();
  source.busy = true;
  warm.warm(true);
  await tick();
  assert.deepEqual(statuses, ['busy']);
  controller.tap();
  await tick();
  assert.equal(views.at(-1)?.listening, false, 'the press says the mic can\'t be used');
  source.busy = false;
  controller.tap();
  await tick();
  assert.equal(views.at(-1)?.listening, true);
  assert.deepEqual(statuses, ['busy', 'ready']);
  sockets.at(-1)!.open();
  hearFor(1, 2);
  assert.deepEqual(audioSent(sockets.at(-1)!), [1, 2]);
});

test('a stream that went quiet (a phone call, say) is opened again by the next press, and its old audio is never used', async () => {
  const { warm, source, controller, sockets, hearFor, advance } = await scorer();
  warm.warm(true);
  await tick();
  hearFor(1, 10);
  advance(5000);
  controller.tap();
  await tick();
  sockets[0]!.open();
  hearFor(11, 2);
  assert.deepEqual([source.closed, source.opened], [1, 2]);
  assert.deepEqual(audioSent(sockets[0]!), [11, 12]);
});

test('a release while iOS is still asking stops the stream that press began', async () => {
  const { source, controller } = await scorer();
  let answer: () => void = () => {};
  source.gate = new Promise((resolve) => { answer = resolve; });
  controller.tap();
  await tick();
  controller.tap();
  answer();
  await tick();
  assert.equal(source.closed, 1, 'no mic left running with nobody to hear it');
});

const didntCatch = "Didn't catch that. Tap the bar and say it again, or use the buttons.";

/** A press that streams, lets go, and gets a blank final transcript. */
async function pressHearingNothing(setup: Parameters<typeof scorer>[0]) {
  const scored = await scorer(setup);
  scored.warm.warm(true);
  await tick();
  scored.controller.tap();
  await tick();
  scored.sockets[0]!.open();
  scored.hearFor(1, 3);
  scored.controller.tap();
  await tick();
  scored.sockets[0]!.server({ type: 'conversation.item.input_audio_transcription.completed', transcript: '' });
  await new Promise((resolve) => setTimeout(resolve, timeouts.openMs + timeouts.finalMs + 30));
  return scored;
}

test('a blank live transcript sends the recording once, and a play it hears there still saves', async () => {
  const { api, plays, views } = await pressHearingNothing({
    parse: { ok: true, value: { transcript: 'ball', parsed: { kind: 'plays', plays: [{ kind: 'pitch', result: 'ball' }], parts: ['ball'] } } },
  });
  assert.equal(api.parsed.length, 1);
  assert.equal(views.at(-1)?.message, null);
  assert.deepEqual(plays().map((event) => [event.source, event.command]), [['voice', { kind: 'pitch', result: 'ball' }]]);
});

test('"Didn\'t catch that" shows only when the recording is blank too', async () => {
  const blank = await pressHearingNothing({ parse: { ok: true, value: { transcript: '', parsed: null } } });
  assert.equal(blank.api.parsed.length, 1);
  assert.equal(blank.views.at(-1)?.message, didntCatch);
  assert.deepEqual(blank.plays(), []);
  const failed = await pressHearingNothing({ parse: { ok: false, failure: 'offline' } });
  assert.equal(failed.views.at(-1)?.message, 'Voice is unavailable right now. Tap to score.');
});

test('#88: the bar says one clear thing for each moment: ready, listening, reading, saved', () => {
  const idle = (['off', 'explain', 'ready', 'refused', 'busy'] as const).map((mic) => barView(mic, 'idle'));
  assert.deepEqual(idle.map((view) => view.label), [
    'Tap to score by voice',
    'Tap to score by voice',
    'Tap to score by voice',
    'Turn on the mic in Settings',
    'Mic busy · tap to score',
  ]);
  assert.deepEqual(idle.map((view) => view.lines), [1, 1, 1, 2, 2], 'the two long lines get room on a narrow phone');
  assert.equal(idle[2]!.accessibilityLabel, 'Mic ready. Tap to score by voice', 'a screen reader still hears the mic is ready');
  for (const mic of ['off', 'ready', 'refused', 'busy'] as const) {
    assert.equal(barView(mic, 'listening').label, 'Listening… tap to finish', 'a press in progress wins over what the mic was doing before');
    assert.equal(barView(mic, 'reading').label, 'Reading your play…');
    assert.equal(barView(mic, 'saved').label, 'Saved');
  }
  assert.deepEqual(['idle', 'listening', 'reading', 'saved'].map((phase) => barView('ready', phase as 'idle').button), [true, true, false, false],
    'while a play is read or saved the bar is not a button, it is only a line');
});

test('#88: the bar is in one phase at a time: reading wins over Saved, Saved over Listening', () => {
  assert.equal(barPhase({ listening: false, reading: 0, saved: false }), 'idle');
  assert.equal(barPhase({ listening: true, reading: 0, saved: false }), 'listening');
  assert.equal(barPhase({ listening: false, reading: 0, saved: true }), 'saved');
  assert.equal(barPhase({ listening: false, reading: 2, saved: true }), 'reading', 'a play still being read shows the spinner, not Saved');
  assert.equal(barPhase({ listening: true, reading: 1, saved: false }), 'reading');
});
