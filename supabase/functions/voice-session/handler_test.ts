import { deepStrictEqual, strictEqual } from 'node:assert/strict';
import { lastNames, names, signedIn, voiceEndpoint, type Access, type OpenAi } from '../_shared/voice.ts';
import { REALTIME_URL, SCORING_WORDS, startSession } from './handler.ts';

type Call = { path: string; body: unknown };

function fakeOpenAi(status: number, answer: unknown) {
  const calls: Call[] = [];
  const openai: OpenAi = (path, init) => {
    calls.push({ path, body: typeof init.body === 'string' ? JSON.parse(init.body) : init.body });
    return Promise.resolve(new Response(JSON.stringify(answer), { status }));
  };
  return { openai, calls };
}

Deno.test('voice-session asks OpenAI for a one-minute transcription-only secret with the lineup as keywords', async () => {
  const { openai, calls } = fakeOpenAi(200, { value: 'ek_test', expires_at: 1_800_000_060, session: {} });
  const result = await startSession({ names: ['J. Soto', 'L. Darcy'] }, openai, 'gpt-live-transcribe');
  deepStrictEqual(result, { status: 200, body: { url: REALTIME_URL, secret: 'ek_test', expiresAt: 1_800_000_060, sampleRate: 24000 } });
  strictEqual(calls[0]!.path, '/v1/realtime/client_secrets');
  deepStrictEqual(calls[0]!.body, {
    expires_after: { anchor: 'created_at', seconds: 60 },
    session: {
      type: 'transcription',
      audio: {
        input: {
          format: { type: 'audio/pcm', rate: 24000 },
          transcription: { model: 'gpt-live-transcribe', languages: ['en'], keywords: [...SCORING_WORDS, 'Soto', 'Darcy'] },
          turn_detection: null,
        },
      },
    },
  });
});

Deno.test('voice-session refuses a lineup that is not a short list of text, and skips names it cannot use', async () => {
  const { openai, calls } = fakeOpenAi(200, {});
  strictEqual((await startSession({ names: 'J. Soto' }, openai, 'm')).status, 400);
  strictEqual((await startSession({ names: Array(41).fill('A') }, openai, 'm')).status, 400);
  strictEqual((await startSession({ names: ['J. Soto', 7] }, openai, 'm')).status, 400);
  strictEqual(calls.length, 0);
  deepStrictEqual(names(['J. Soto', '<script>', '', 'A & B', "D. O'Neil-Ruiz"]), ['J. Soto', "D. O'Neil-Ruiz"]);
  strictEqual(names([1, 2]), null);
  deepStrictEqual(lastNames(['J. Soto', 'R. Soto', "D. O'Neil-Ruiz", 'Lin']), ['Soto', "O'Neil-Ruiz", 'Lin']);
  deepStrictEqual(lastNames(['J. Soto Jr.', 'K. Moss III', 'L. Darcy sr', 'Jr', 'M. Ii', 'T. Iv', 'R. Hale JR', 'S. Bell SR.']), ['Soto', 'Moss', 'Darcy', 'Jr', 'Ii', 'Iv', 'Hale', 'Bell']);
});

Deno.test('sign-in answers: a rejected token is 401, but a busy or down sign-in service is 503', () => {
  deepStrictEqual(signedIn({ id: 'user-1' }, null), { userId: 'user-1', unavailable: false });
  deepStrictEqual(signedIn(null, { status: 403 }), { userId: null, unavailable: false });
  deepStrictEqual(signedIn(null, { status: 401 }), { userId: null, unavailable: false });
  deepStrictEqual(signedIn(null, { status: 429 }), { userId: null, unavailable: true });
  deepStrictEqual(signedIn(null, { status: 500 }), { userId: null, unavailable: true });
  deepStrictEqual(signedIn(null, {}), { userId: null, unavailable: true });
});

Deno.test('A10: an OpenAI failure or a bad answer is "voice unavailable", so the phone falls back to taps', async () => {
  deepStrictEqual(await startSession({}, fakeOpenAi(500, {}).openai, 'm'), { status: 502, body: { error: 'voice_unavailable' } });
  deepStrictEqual(await startSession({}, fakeOpenAi(200, { nope: true }).openai, 'm'), { status: 502, body: { error: 'voice_unavailable' } });
  const throwing: OpenAi = () => Promise.reject(new Error('network'));
  deepStrictEqual(await startSession({}, throwing, 'm'), { status: 502, body: { error: 'voice_unavailable' } });
});

const handled = async () => ({ status: 200, body: { ok: true } });
const endpoint = (userId: string | null, unavailable = false, allow = () => true) =>
  voiceEndpoint({ getUser: () => Promise.resolve({ userId, unavailable }), access: () => Promise.resolve(allow() ? 'allowed' : 'limited') }, handled);
const post = (body = '{}', headers: Record<string, string> = { authorization: 'Bearer token' }) =>
  new Request('http://localhost/voice', { method: 'POST', body, headers });

Deno.test('voice endpoints need a signed-in phone, and say so when sign-in is down', async () => {
  strictEqual((await endpoint('user-1')(post())).status, 200);
  strictEqual((await endpoint(null)(post())).status, 401);
  strictEqual((await endpoint('user-1')(post('{}', {}))).status, 401);
  strictEqual((await endpoint(null, true)(post())).status, 503);
  strictEqual((await endpoint('user-1')(new Request('http://localhost/voice'))).status, 405);
});

Deno.test('voice endpoints refuse bodies that are not JSON or are too long', async () => {
  strictEqual((await endpoint('user-1')(post('not json'))).status, 400);
  strictEqual((await endpoint('user-1')(post(JSON.stringify({ audio: 'a'.repeat(1_600_000) })))).status, 413);
});

Deno.test('only a current scorer reaches billable voice work', async () => {
  let calls = 0;
  const create = (access: () => Promise<Access>) => voiceEndpoint({
    getUser: () => Promise.resolve({ userId: 'user-1', unavailable: false }),
    access,
  }, async () => { calls++; return handled(); });
  strictEqual((await create(() => Promise.resolve('forbidden'))(post())).status, 403);
  strictEqual(calls, 0);
  strictEqual((await create(() => Promise.resolve('allowed'))(post())).status, 200);
  strictEqual(calls, 1);
});

Deno.test('voice quota and admission outages fail closed before the handler', async () => {
  let calls = 0;
  const create = (access: () => Promise<Access>) => voiceEndpoint({
    getUser: () => Promise.resolve({ userId: 'user-1', unavailable: false }),
    access,
  }, async () => { calls++; return handled(); });
  strictEqual((await create(() => Promise.resolve('limited'))(post())).status, 429);
  strictEqual((await create(() => Promise.reject(new Error('database down')))(post())).status, 503);
  strictEqual(calls, 0);
});

Deno.test('voice cancels an oversized chunked body before reading it all', async () => {
  let pulls = 0;
  let canceled = false;
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      pulls++;
      if (pulls <= 4) controller.enqueue(new Uint8Array(800_000).fill(97));
      else controller.close();
    },
    cancel() { canceled = true; },
  });
  const request = new Request('http://localhost/voice', { method: 'POST', body: stream,
    headers: { authorization: 'Bearer token' } });
  strictEqual((await endpoint('user-1')(request)).status, 413);
  strictEqual(canceled, true);
  strictEqual(pulls < 4, true);
});
