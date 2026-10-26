import { deepStrictEqual, strictEqual } from 'node:assert/strict';
import { lastNames, names, rateLimit, signedIn, voiceEndpoint, type OpenAi } from '../_shared/voice.ts';
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

Deno.test('voice-session refuses a lineup that is not a short list, and skips names it cannot use', async () => {
  const { openai, calls } = fakeOpenAi(200, {});
  strictEqual((await startSession({ names: 'J. Soto' }, openai, 'm')).status, 400);
  strictEqual((await startSession({ names: Array(41).fill('A') }, openai, 'm')).status, 400);
  strictEqual(calls.length, 0);
  deepStrictEqual(names(['J. Soto', '<script>', '', 'A & B', "D. O'Neil-Ruiz"]), ['J. Soto', "D. O'Neil-Ruiz"]);
  deepStrictEqual(lastNames(['J. Soto', 'R. Soto', "D. O'Neil-Ruiz", 'Lin']), ['Soto', "O'Neil-Ruiz", 'Lin']);
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
  voiceEndpoint({ getUser: () => Promise.resolve({ userId, unavailable }), allow, now: () => 0 }, handled);
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

Deno.test('the rate limit lets each phone make 30 requests a minute', async () => {
  const allow = rateLimit(30, 60_000);
  for (let index = 0; index < 30; index++) strictEqual(allow('user-1', index), true);
  strictEqual(allow('user-1', 100), false);
  strictEqual(allow('user-2', 100), true);
  strictEqual(allow('user-1', 60_000), true);
  strictEqual(allow('user-2', 200_000), true, 'users with no recent requests are forgotten');
  strictEqual((await endpoint('user-1', false, () => false)(post())).status, 429);
});
