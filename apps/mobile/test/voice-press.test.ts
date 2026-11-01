import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Answer } from '@sandlot/voice';
import { Clip, MAX_CLIP_BYTES, SAMPLE_RATE, toBase64 } from '../src/voice/pcm.ts';
import { startPress, type Mic, type PressUpdate } from '../src/voice/press.ts';
import type { Socket } from '../src/voice/realtime.ts';
import { createVoiceApi, type VoiceApi } from '../src/voice/voice-api.ts';
import { fakeApi, fakeMic, fakeSocket, session, tick, timeouts } from './voice-fakes.ts';

const nobody = { name: null, number: null };
const double: Answer = { result: 'play', fix_last: false, readings: [{ batter: { name: 'Darcy', number: null }, pitcher: nobody, pitches: [], runner_events: [], forced_runners: [],
  ball_in_play: { outcome: 'double', trajectory: null, fielders: [], batter_to: '2', runners: [] } }] };

import { context } from './voice-fakes.ts';

const input = { names: ['L. Darcy', 'A. Kindle'], context };

function run(mic: Mic, api: VoiceApi, socket: Socket) {
  const updates: PressUpdate[] = [];
  let settle: (update: PressUpdate) => void = () => {};
  const done = new Promise<PressUpdate>((resolve) => { settle = resolve; });
  const press = startPress({ mic, api, openSocket: () => socket, timeouts }, input, (update) => {
    updates.push(update);
    if (update.kind !== 'words') settle(update);
  });
  return { press, updates, done };
}

test('a press streams the audio from before the socket opened first, shows live words, and reads the final words on the phone', async () => {
  const mic = fakeMic();
  const socket = fakeSocket();
  const api = fakeApi();
  const { press, updates, done } = run(mic, api, socket);
  await tick();
  mic.push([1, 0, 2, 0]);
  socket.open();
  mic.push([3, 0]);
  assert.deepEqual(socket.sent.map((event) => event.audio), [toBase64(Uint8Array.from([1, 0, 2, 0])), toBase64(Uint8Array.from([3, 0]))]);
  socket.server({ type: 'conversation.item.input_audio_transcription.delta', item_id: 'item_1', delta: 'strike' });
  socket.server({ type: 'conversation.item.input_audio_transcription.delta', item_id: 'item_1', delta: ' swing' });
  assert.deepEqual(updates, [{ kind: 'words', words: 'strike' }, { kind: 'words', words: 'strike swing' }]);
  press.release();
  await tick();
  assert.equal(socket.sent.at(-1)!.type, 'input_audio_buffer.commit');
  socket.server({ type: 'conversation.item.input_audio_transcription.completed', item_id: 'item_1', transcript: 'strike swinging' });
  const result = await done;
  assert.equal(result.kind, 'heard');
  assert.equal(result.kind === 'heard' && result.transcript, 'strike swinging');
  assert.equal(result.kind === 'heard' && result.heard.kind, 'answer', 'the phone reads a pitch call as an answer of its own');
  assert.equal(api.parsed.length, 0, 'the phone reads a simple pitch without voice-parse');
  assert.equal(mic.stopped, 1);
  assert.equal(socket.closed, true, 'the socket closes on release, so the session stops costing money');
});

test('anything but pitch calls or a lone undo goes to voice-parse with the game, and its answer is what the press heard', async () => {
  const mic = fakeMic();
  const socket = fakeSocket();
  const api = fakeApi(undefined, { ok: true, value: { transcript: 'Darcy rips one to the gap', answer: double } });
  const { press, done } = run(mic, api, socket);
  await tick();
  socket.open();
  mic.push([1, 0]);
  press.release();
  await tick();
  socket.server({ type: 'conversation.item.input_audio_transcription.completed', transcript: 'Darcy rips one to the gap' });
  const result = await done;
  assert.deepEqual(api.parsed, [{ transcript: 'Darcy rips one to the gap', context }]);
  assert.deepEqual(result, { kind: 'heard', transcript: 'Darcy rips one to the gap', heard: { kind: 'answer', answer: double } });
});

test('an answer voice-parse could not use is heard as unusable, so nothing saves', async () => {
  const mic = fakeMic();
  const socket = fakeSocket();
  const api = fakeApi(undefined, { ok: true, value: { transcript: 'zorp the flibber', answer: null } });
  const { press, done } = run(mic, api, socket);
  await tick();
  socket.open();
  mic.push([1, 0]);
  press.release();
  await tick();
  socket.server({ type: 'conversation.item.input_audio_transcription.completed', transcript: 'zorp the flibber' });
  assert.deepEqual(await done, { kind: 'heard', transcript: 'zorp the flibber', heard: { kind: 'unusable' } });
});

test('when voice-parse is down or slow, the press fails with the reason and points to taps', async () => {
  for (const failure of ['voice_unavailable', 'timeout'] as const) {
    const mic = fakeMic();
    const socket = fakeSocket();
    const { press, done } = run(mic, fakeApi(undefined, { ok: false, failure }), socket);
    await tick();
    socket.open();
    mic.push([1, 0]);
    press.release();
    await tick();
    socket.server({ type: 'conversation.item.input_audio_transcription.completed', transcript: 'zorp the flibber' });
    assert.deepEqual(await done, { kind: 'failed', failure });
  }
});

for (const [name, setup] of [
  ['voice-session fails', (socket: ReturnType<typeof fakeSocket>) => { void socket; }],
  ['the socket errors', (socket: ReturnType<typeof fakeSocket>) => { socket.open(); socket.onerror!(); }],
  ['the final words never arrive', (socket: ReturnType<typeof fakeSocket>) => { socket.open(); }],
] as const) {
  test(`A4/A5: when ${name}, the whole recorded clip goes to voice-parse`, async () => {
    const mic = fakeMic();
    const socket = fakeSocket();
    const api = fakeApi(name === 'voice-session fails' ? { ok: false, failure: 'voice_unavailable' } : undefined,
      { ok: true, value: { transcript: 'Darcy doubles', answer: double } });
    const { press, done } = run(mic, api, socket);
    await tick();
    mic.push([1, 0, 2, 0]);
    setup(socket);
    mic.push([3, 0]);
    press.release();
    const result = await done;
    assert.deepEqual(api.parsed, [{ audio: toBase64(Uint8Array.from([1, 0, 2, 0, 3, 0])), context }]);
    assert.deepEqual(result, { kind: 'heard', transcript: 'Darcy doubles', heard: { kind: 'answer', answer: double } });
  });
}

test('A10: a clip voice-parse refuses falls back to taps with the reason', async () => {
  for (const failure of ['slow_down', 'too_long', 'voice_unavailable', 'timeout', 'offline'] as const) {
    const mic = fakeMic();
    const { press, done } = run(mic, fakeApi({ ok: false, failure: 'voice_unavailable' }, { ok: false, failure }), fakeSocket());
    await tick();
    mic.push([1, 0]);
    press.release();
    assert.deepEqual(await done, { kind: 'failed', failure });
  }
});

test('a clip with nothing said is an empty press, so the phone says it didn\'t catch that', async () => {
  const mic = fakeMic();
  const { press, done } = run(mic, fakeApi({ ok: false, failure: 'voice_unavailable' }), fakeSocket());
  await tick();
  mic.push([0, 0]);
  press.release();
  const result = await done;
  assert.equal(result.kind === 'heard' && result.transcript, '');
  assert.equal(result.kind === 'heard' && result.heard.kind, 'empty');
});

test('a press with no audio at all is empty and calls nothing', async () => {
  const api = fakeApi();
  const { press, done } = run(fakeMic(), api, fakeSocket());
  await tick();
  press.release();
  const result = await done;
  assert.equal(result.kind === 'heard' && result.transcript, '');
  assert.equal(api.parsed.length, 0);
});

test('A2: a press stops itself at 15 seconds and keeps exactly 15 seconds of audio', async () => {
  const mic = fakeMic();
  const api = fakeApi({ ok: false, failure: 'voice_unavailable' }, { ok: true, value: { transcript: 'ball', answer: null } });
  const { done } = run(mic, api, fakeSocket());
  await tick();
  const second = new Array<number>(SAMPLE_RATE * 2).fill(1);
  for (let index = 0; index < 16; index += 1) mic.push(second);
  await done;
  assert.equal(mic.stopped, 1);
  const body = api.parsed[0];
  assert.ok(body && 'audio' in body);
  assert.equal(body.audio.length, Math.ceil(MAX_CLIP_BYTES / 3) * 4);
});

test('sliding off cancels the press: nothing is heard, sent or parsed', async () => {
  const mic = fakeMic();
  const socket = fakeSocket();
  const api = fakeApi();
  const { press, updates } = run(mic, api, socket);
  await tick();
  socket.open();
  mic.push([1, 0]);
  press.cancel();
  press.release();
  await new Promise((resolve) => setTimeout(resolve, timeouts.openMs + timeouts.finalMs + 20));
  assert.deepEqual(updates, []);
  assert.equal(socket.closed, true);
  assert.equal(mic.stopped, 1);
  assert.equal(api.parsed.length, 0);
  assert.equal(socket.sent.some((event) => event.type === 'input_audio_buffer.commit'), false);
});

test('a denied microphone fails the press at touch-down', async () => {
  const { done } = run(fakeMic(false), fakeApi(), fakeSocket());
  assert.deepEqual(await done, { kind: 'failed', failure: 'microphone' });
});

test('a phone that can\'t deliver 24 kHz falls back to taps', async () => {
  const mic = fakeMic();
  const { press, done } = run(mic, fakeApi(), fakeSocket());
  await tick();
  mic.push([1, 0], 48000);
  press.release();
  assert.deepEqual(await done, { kind: 'failed', failure: 'voice_unavailable' });
});

test('the clip keeps whole samples when it trims at the cap', () => {
  const clip = new Clip();
  clip.append(new Uint8Array(MAX_CLIP_BYTES - 3));
  assert.equal(clip.append(new Uint8Array(10)).length, 2);
  assert.equal(clip.bytes, MAX_CLIP_BYTES - 1);
  assert.equal(clip.append(new Uint8Array(10)).length, 0);
});

test('base64 matches Node for every padding length', () => {
  for (const length of [0, 1, 2, 3, 4, 5, 255]) {
    const bytes = Uint8Array.from({ length }, (_, index) => (index * 37) % 256);
    assert.equal(toBase64(bytes), Buffer.from(bytes).toString('base64'));
  }
});

test('voice-api maps each status in the contract to one failure and signs in again after a 401', async () => {
  const calls: { url: string; headers: Record<string, string>; body: string }[] = [];
  let statuses: number[] = [];
  const fresh: boolean[] = [];
  const api = createVoiceApi({
    url: 'https://project.supabase.co',
    key: 'sb_publishable_test',
    token: async (renew) => { fresh.push(renew); return renew ? 'new-token' : 'old-token'; },
    fetch: async (url, init) => {
      calls.push({ url, headers: init.headers, body: init.body });
      const status = statuses.shift()!;
      return { status, json: async () => (status === 200 ? session : { error: 'x' }) };
    },
  });
  for (const [status, failure] of [[400, 'invalid'], [413, 'too_long'], [429, 'slow_down'], [502, 'voice_unavailable'], [503, 'auth_unavailable'], [500, 'voice_unavailable']] as const) {
    statuses = [status];
    assert.deepEqual(await api.session([]), { ok: false, failure });
  }
  calls.length = 0;
  fresh.length = 0;
  statuses = [401, 200];
  assert.deepEqual(await api.session(['L. Darcy']), { ok: true, value: session });
  assert.deepEqual(fresh, [false, true]);
  assert.equal(calls[0]!.url, 'https://project.supabase.co/functions/v1/voice-session');
  assert.equal(calls[1]!.headers.authorization, 'Bearer new-token');
  assert.equal(calls[1]!.headers.apikey, 'sb_publishable_test');
  assert.equal(calls[1]!.body, JSON.stringify({ names: ['L. Darcy'] }));
  statuses = [401, 401];
  assert.deepEqual(await api.session([]), { ok: false, failure: 'unauthenticated' });
});

test('voice-api reports no network, a timeout, no sign-in and a broken answer', async () => {
  const base = { url: 'https://p.supabase.co', key: 'k', token: async () => 't' };
  assert.deepEqual(await createVoiceApi({ ...base, fetch: async () => { throw new Error('offline'); } }).session([]), { ok: false, failure: 'offline' });
  const slow = createVoiceApi({ ...base, timeoutMs: 5, fetch: (_, init) => new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(new Error('aborted')))) });
  assert.deepEqual(await slow.parse({ transcript: 'ball', context }), { ok: false, failure: 'timeout' });
  assert.deepEqual(await createVoiceApi({ ...base, token: async () => null, fetch: async () => ({ status: 200, json: async () => session }) }).session([]), { ok: false, failure: 'auth_unavailable' });
  const broken = createVoiceApi({ ...base, fetch: async () => ({ status: 200, json: async () => ({ transcript: 'Darcy doubles', answer: { result: 'save_everything' } }) }) });
  assert.deepEqual(await broken.parse({ transcript: 'Darcy doubles', context }), { ok: false, failure: 'voice_unavailable' }, 'an answer outside the schema never reaches decide()');
  const old = createVoiceApi({ ...base, fetch: async () => ({ status: 200, json: async () => ({ transcript: 'ball', parsed: { kind: 'unclear' } }) }) });
  assert.deepEqual(await old.parse({ transcript: 'ball', context }), { ok: false, failure: 'voice_unavailable' }, 'the old reply shape is refused');
  const noted = createVoiceApi({ ...base, fetch: async () => ({ status: 200, json: async () => ({ transcript: 'Darcy doubles', answer: { ...double, unsure: ['NOTE-MARKER'] } }) }) });
  const read = await noted.parse({ transcript: 'Darcy doubles', context });
  assert.deepEqual(read, { ok: true, value: { transcript: 'Darcy doubles', answer: double } });
  assert.equal(JSON.stringify(read).includes('NOTE-MARKER'), false, 'the phone reads the answer strictly too, so a note never reaches the screen');
  const insecure = createVoiceApi({ ...base, fetch: async () => ({ status: 200, json: async () => ({ ...session, url: 'ws://evil.example' }) }) });
  assert.deepEqual(await insecure.session([]), { ok: false, failure: 'voice_unavailable' });
});
