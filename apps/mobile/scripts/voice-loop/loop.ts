// Streams one recorded clip through the phone's own live client (src/voice/realtime.ts), paced like a real press, and
// prints one JSON line: whether the transcript came back right, name-dropped, wrong or blank, and how long the final
// transcript took after the release. It never prints the transcript, the audio or any key (AGENTS.md rule 5).
//
// Two ways to get the session:
//   hosted (default): the deployed voice-session function, the way the phone does it. Needs ENV_FILE.
//   --direct:         straight from OpenAI with OPENAI_API_KEY, so a setting can be tried before voice-session has it.
//
// Exit 0 when the transcript is right, 1 when it is not (or never came), 2 when the command is used wrong, 3 when no
// session could be started.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { classify } from './classify.ts';
import { apiKey, fail, whole } from './cli.ts';
import { findClip, LINEUP, readPcm } from './clips.ts';
import { directSession, type DirectSession, type Setting } from './settings.ts';
import { cut, streamClip } from './stream.ts';

const usage = `Usage: node --experimental-strip-types scripts/voice-loop/loop.ts <clip.pcm> [options]
  <clip.pcm>                   a clip such as ~/Downloads/sandlot-voice-clips/nguyen-walks.noisy.pcm
  --direct                     ask OpenAI directly with OPENAI_API_KEY (default: the hosted voice-session, needs ENV_FILE)
  --noise-reduction <type>     with --direct: far_field or near_field
  --delay <level>              with --direct: minimal, low, medium, high or xhigh
  --prompt <text>              with --direct: a short description of the setting
  --model <name>               with --direct: the transcription model (default gpt-live-transcribe)
  --cut-start-ms <n>           drop this much audio from the start, like a late mic (default 0)
  --cut-end-ms <n>             drop this much from the end (default 0)
  --chunk-ms <n>               how much audio to send at a time (default 100)`;

let parsed;
try {
  parsed = parseArgs({
    allowPositionals: true,
    options: {
      direct: { type: 'boolean' },
      'noise-reduction': { type: 'string' },
      delay: { type: 'string' },
      prompt: { type: 'string' },
      model: { type: 'string', default: 'gpt-live-transcribe' },
      'cut-start-ms': { type: 'string', default: '0' },
      'cut-end-ms': { type: 'string', default: '0' },
      'chunk-ms': { type: 'string', default: '100' },
    },
  });
} catch (error) {
  fail(`${(error as Error).message}\n\n${usage}`);
}
const { values, positionals } = parsed;

const key = values.direct ? apiKey() : null;
const [path, ...extra] = positionals;
if (!path || extra.length) fail(usage);
const found = findClip(path);
if (!found) fail('That is not one of the known clips (see CLIPS in clips.ts). Use a file like nguyen-walks.noisy.pcm.');
if (!existsSync(path)) fail('That clip file is not there. See README.md for how to regenerate the clips.');

const oneOf = <T extends string>(flag: string, value: string | undefined, allowed: readonly T[]): T | undefined => {
  if (value !== undefined && !allowed.includes(value as T)) fail(`${flag} must be one of ${allowed.join(', ')}.`);
  return value as T | undefined;
};
const setting: Setting = {
  name: 'custom',
  noiseReduction: oneOf('--noise-reduction', values['noise-reduction'], ['far_field', 'near_field']),
  delay: oneOf('--delay', values.delay, ['minimal', 'low', 'medium', 'high', 'xhigh']),
  prompt: values.prompt,
};
if (!values.direct && (setting.noiseReduction || setting.delay || setting.prompt)) {
  fail('--noise-reduction, --delay and --prompt change the session, which only --direct builds. Add --direct.');
}

/** The deployed voice-session, signed in the way the phone signs in. The token is cached in .token.json (git ignores it). */
async function hostedSession(): Promise<DirectSession> {
  if (!process.env.ENV_FILE) fail('Hosted mode needs ENV_FILE=apps/mobile/.env.local. To ask OpenAI directly instead, add --direct.');
  const env = Object.fromEntries(readFileSync(process.env.ENV_FILE, 'utf8').split('\n')
    .filter((line) => /^[A-Z_]+=/.test(line)).map((line) => line.split(/=(.*)/s).slice(0, 2)));
  const base = env.EXPO_PUBLIC_SUPABASE_URL;
  const publishable = env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!base || !publishable) fail('ENV_FILE needs EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY.');

  const cache = join(import.meta.dirname, '.token.json');
  let token: string | null = null;
  if (existsSync(cache)) {
    const saved = JSON.parse(readFileSync(cache, 'utf8')) as { access_token: string; expires_at: number };
    if (saved.expires_at * 1000 > Date.now() + 60_000) token = saved.access_token;
  }
  if (!token) {
    const signUp = await fetch(`${base}/auth/v1/signup`, { method: 'POST', headers: { apikey: publishable, 'content-type': 'application/json' }, body: '{}', signal: AbortSignal.timeout(10_000) });
    if (!signUp.ok) return { ok: false, why: `sign-in ${signUp.status}` };
    const body = await signUp.json() as { access_token: string; expires_at: number };
    writeFileSync(cache, JSON.stringify(body));
    token = body.access_token;
  }
  const response = await fetch(`${base}/functions/v1/voice-session`, {
    method: 'POST',
    headers: { apikey: publishable, authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ names: LINEUP }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) return { ok: false, why: `voice-session ${response.status}` };
  const { url, secret } = await response.json() as { url: string; secret: string };
  return { ok: true, url, secret };
}

const pcm = cut(readPcm(path), whole(values['cut-start-ms'], '--cut-start-ms'), whole(values['cut-end-ms'], '--cut-end-ms'));
const chunkMs = whole(values['chunk-ms'], '--chunk-ms', 1);

const label = `${found.clip.id}.${found.noise}`;
const session = key ? await directSession(setting, LINEUP, key, values.model) : await hostedSession();
if (!session.ok) {
  console.log(JSON.stringify({ clip: label, error: session.why }));
  process.exit(3);
}

const { transcript, finalMs } = await streamClip(session, pcm, chunkMs);
const outcome = transcript === null ? 'failed' : classify(found.clip, transcript);
console.log(JSON.stringify({ clip: label, mode: values.direct ? 'direct' : 'hosted', outcome, finalMs }));
process.exit(outcome === 'right' ? 0 : 1);
