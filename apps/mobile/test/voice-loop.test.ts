import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { test } from 'node:test';
import type { OpenAi } from '../../../supabase/functions/_shared/voice.ts';
import { REALTIME_URL, startSession } from '../../../supabase/functions/voice-session/handler.ts';
import { classify } from '../scripts/voice-loop/classify.ts';
import { directSession, withSetting, type Setting } from '../scripts/voice-loop/settings.ts';
import { cut } from '../scripts/voice-loop/stream.ts';
import { buildTable, type Run } from '../scripts/voice-loop/table.ts';

// Seam 1: what a transcript counts as, next to the words the clip really says.

const nguyen = { phrase: 'Nguyen walks.', names: ['Nguyen'] };

test('a transcript with nothing in it, or only filler, is blank: the phone says "Didn\'t catch that"', () => {
  assert.equal(classify(nguyen, ''), 'blank');
  assert.equal(classify(nguyen, '  .  '), 'blank');
  assert.equal(classify(nguyen, 'Um.'), 'blank');
});

const darcy = { phrase: 'Darcy singles, Soto to third.', names: ['Darcy', 'Soto'] };

test('the other words without a player\'s name are name-dropped, whether one name or both are missing', () => {
  assert.equal(classify(nguyen, 'Walks.'), 'name-dropped');
  assert.equal(classify(nguyen, 'Come on, walks.'), 'name-dropped');
  assert.equal(classify(darcy, 'Singles, to third.'), 'name-dropped');
  assert.equal(classify(darcy, 'Darcy singles, to third.'), 'name-dropped');
});

test('words that miss the play are wrong, and a name alone is not the play', () => {
  assert.equal(classify(nguyen, 'Come on blue, that was outside.'), 'wrong');
  assert.equal(classify(nguyen, 'Nguyen.'), 'wrong');
  assert.equal(classify(darcy, 'Darcy singles, Soto to second.'), 'wrong');
  assert.equal(classify({ phrase: 'Ball.', names: [] }, 'Call.'), 'wrong');
});

test('the words said, with crowd chatter around them, are right', () => {
  assert.equal(classify(nguyen, 'Nguyen walks.'), 'right');
  assert.equal(classify(nguyen, 'Come on, Nguyen walks!'), 'right');
  assert.equal(classify({ phrase: 'Ball.', names: [] }, 'Ball'), 'right');
});

// Seam 3: the session each setting asks OpenAI for. voice-session's own startSession builds it, so the loop can't drift
// from what the phone gets, and the setting only adds its flags.

type Sent = { path: string; body: { session: { audio: { input: Record<string, unknown> & { transcription: Record<string, unknown> } } } } };

async function sentFor(setting: Setting): Promise<Sent> {
  let sent: Sent | undefined;
  const send: OpenAi = (path, init) => {
    sent = { path, body: JSON.parse(String(init.body)) };
    return Promise.resolve(new Response(JSON.stringify({ value: 'ek_test', expires_at: 1_800_000_060 })));
  };
  const reply = await startSession({ names: ['J. Soto'] }, withSetting(setting, send), 'gpt-live-transcribe');
  assert.equal(reply.status, 200);
  return sent!;
}

test('the setting for today asks for exactly the session voice-session asks for', async () => {
  const today = await sentFor({ name: 'today' });
  assert.equal(today.path, '/v1/realtime/client_secrets');
  assert.deepEqual(Object.keys(today.body.session.audio.input).sort(), ['format', 'transcription', 'turn_detection']);
  assert.deepEqual(Object.keys(today.body.session.audio.input.transcription).sort(), ['keywords', 'languages', 'model']);
});

test('noise reduction goes beside the transcription settings, and delay and prompt go inside them', async () => {
  const today = await sentFor({ name: 'today' });
  const far = await sentFor({ name: 'far_field', noiseReduction: 'far_field' });
  assert.deepEqual(far.body.session.audio.input.noise_reduction, { type: 'far_field' });
  delete far.body.session.audio.input.noise_reduction;
  assert.deepEqual(far.body, today.body);

  const slow = await sentFor({ name: 'slow', delay: 'high', prompt: 'A noisy ball field.' });
  assert.equal(slow.body.session.audio.input.transcription.delay, 'high');
  assert.equal(slow.body.session.audio.input.transcription.prompt, 'A noisy ball field.');
  assert.equal(slow.body.session.audio.input.noise_reduction, undefined);
  assert.deepEqual(slow.body.session.audio.input.transcription.keywords, today.body.session.audio.input.transcription.keywords);
});

// Seam 4: the call to OpenAI itself, with a fake fetch.

function fakeFetch(status: number, answer: unknown) {
  const calls: { url: string; init: RequestInit }[] = [];
  const send = ((url: string, init: RequestInit) => {
    calls.push({ url, init });
    return Promise.resolve(new Response(JSON.stringify(answer), { status }));
  }) as typeof fetch;
  return { send, calls };
}

test('asking OpenAI directly sends the key as a header only, and hands back the socket address and secret', async () => {
  const { send, calls } = fakeFetch(200, { value: 'ek_test', expires_at: 1_800_000_060 });
  const result = await directSession({ name: 'today' }, ['J. Soto'], 'sk-test-key', 'gpt-live-transcribe', send);
  assert.deepEqual(result, { ok: true, url: REALTIME_URL, secret: 'ek_test' });
  assert.equal(calls[0]!.url, 'https://api.openai.com/v1/realtime/client_secrets');
  assert.equal((calls[0]!.init.headers as Record<string, string>).authorization, 'Bearer sk-test-key');
  assert.ok(!String(calls[0]!.init.body).includes('sk-test-key'));
});

test('a setting OpenAI turns down is reported by status, code and field, never by its message or the key', async () => {
  const { send } = fakeFetch(400, { error: { code: 'unknown_parameter', param: 'session.audio.input.transcription.delay', message: 'Bad value, key sk-test-key, for "J. Soto"' } });
  const result = await directSession({ name: 'slow', delay: 'high' }, ['J. Soto'], 'sk-test-key', 'gpt-live-transcribe', send);
  assert.deepEqual(result, { ok: false, why: 'HTTP 400 unknown_parameter (session.audio.input.transcription.delay)' });
  const broken = await directSession({ name: 'today' }, [], 'sk-test-key', 'gpt-live-transcribe', (() => Promise.reject(new Error('offline sk-test-key'))) as typeof fetch);
  assert.deepEqual(broken, { ok: false, why: 'no answer from OpenAI' });
});

// Seam 5: the loop and the batch stop with a clear message when there is no key.

test('without OPENAI_API_KEY the batch and the direct loop say so and stop before touching any clip', () => {
  const script = (name: string) => join(import.meta.dirname, '..', 'scripts', 'voice-loop', name);
  for (const key of [undefined, '  ']) {
    const env = { ...process.env, OPENAI_API_KEY: key };
    for (const args of [[script('batch.ts')], [script('loop.ts'), 'nguyen-walks.noisy.pcm', '--direct']]) {
      const result = spawnSync(process.execPath, ['--experimental-strip-types', '--no-warnings', ...args], { env, encoding: 'utf8' });
      assert.equal(result.status, 2, args.join(' '));
      assert.match(result.stderr, /OPENAI_API_KEY is not set/);
      assert.equal(result.stdout, '');
    }
  }
});

// Seam 6: the audio a press never hands over. 24 kHz 16-bit mono is 48 bytes a millisecond.

test('cutting the start and end of a clip drops that much audio, and never more than the clip has', () => {
  const second = Uint8Array.from({ length: 48_000 }, (_, at) => at % 251);
  assert.equal(cut(second, 0, 0).length, 48_000);
  assert.equal(cut(second, 300, 0).length, 48_000 - 14_400);
  assert.deepEqual(cut(second, 300, 0).subarray(0, 4), second.subarray(14_400, 14_404));
  assert.equal(cut(second, 600, 100).length, 48_000 - 28_800 - 4_800);
  assert.equal(cut(second, 900, 900).length, 0);
  assert.equal(cut(second, 5_000, 0).length, 0);
});

// Seam 2: the markdown table that goes into the research note.

const run = (setting: string, noise: Run['noise'], cutMs: number, outcome: Run['outcome'], finalMs: number | null): Run => ({ setting, noise, cutMs, outcome, finalMs });
const runs: Run[] = [
  run('today', 'clean', 0, 'right', 800),
  run('today', 'clean', 0, 'right', 1000),
  run('today', 'noisy', 600, 'name-dropped', 1200),
  run('today', 'noisy', 600, 'blank', 600),
  run('far_field', 'clean', 0, 'right', 700),
  run('far_field', 'noisy', 600, 'failed', null),
  run('far_field', 'noisy', 600, 'wrong', 1500),
];

test('the table counts each kind of result apart, and gives the middle and slowest time to the final transcript', () => {
  assert.equal(buildTable(runs, ['setting']), [
    '| setting | runs | right | name-dropped | wrong | blank | failed | median final (ms) | slowest final (ms) |',
    '|---|---:|---:|---:|---:|---:|---:|---:|---:|',
    '| today | 4 | 2 | 1 | 0 | 1 | 0 | 900 | 1200 |',
    '| far_field | 3 | 1 | 0 | 1 | 0 | 1 | 1100 | 1500 |',
  ].join('\n'));
});

test('the table can split by crowd noise and by the audio cut off the start, keeping the order the runs happened in', () => {
  assert.equal(buildTable(runs, ['setting', 'noise', 'cut']), [
    '| setting | crowd noise | first cut (ms) | runs | right | name-dropped | wrong | blank | failed | median final (ms) | slowest final (ms) |',
    '|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|',
    '| today | clean | 0 | 2 | 2 | 0 | 0 | 0 | 0 | 900 | 1000 |',
    '| today | crowd | 600 | 2 | 0 | 1 | 0 | 1 | 0 | 900 | 1200 |',
    '| far_field | clean | 0 | 1 | 1 | 0 | 0 | 0 | 0 | 700 | 700 |',
    '| far_field | crowd | 600 | 2 | 0 | 0 | 1 | 0 | 1 | 1500 | 1500 |',
  ].join('\n'));
});

test('a group where nothing finished has no time to show', () => {
  assert.equal(buildTable([run('prompt', 'clean', 0, 'failed', null)], ['setting']).split('\n')[2], '| prompt | 1 | 0 | 0 | 0 | 0 | 1 | - | - |');
});
