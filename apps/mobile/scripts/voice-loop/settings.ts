import type { OpenAi } from '../../../../supabase/functions/_shared/voice.ts';
import { startSession } from '../../../../supabase/functions/voice-session/handler.ts';

// The live transcription settings under test (issue #86). A setting only adds flags to the session voice-session asks
// OpenAI for; the shape itself comes from voice-session's own `startSession`, so the loop can't drift from the phone.

export type Setting = {
  name: string;
  /** `session.audio.input.noise_reduction`. */
  noiseReduction?: 'near_field' | 'far_field';
  /** `session.audio.input.transcription.delay`. */
  delay?: 'minimal' | 'low' | 'medium' | 'high' | 'xhigh';
  /** `session.audio.input.transcription.prompt`. */
  prompt?: string;
};

/** Today's settings first, so every other row is read against it. */
export const SETTINGS: Setting[] = [
  { name: 'today' },
  { name: 'far_field', noiseReduction: 'far_field' },
  { name: 'near_field', noiseReduction: 'near_field' },
  { name: 'delay_high', delay: 'high' },
  { name: 'prompt', prompt: 'Short scoring calls from a parent at a youth baseball field, with crowd noise and cheering in the background.' },
];

type Body = { session: { audio: { input: { noise_reduction?: unknown; transcription: Record<string, unknown> } } } };

/** Adds the setting's flags to the session `send` is about to ask OpenAI for. */
export function withSetting(setting: Setting, send: OpenAi): OpenAi {
  return (path, init) => {
    if (typeof init.body !== 'string') return send(path, init);
    const body = JSON.parse(init.body) as Body;
    const input = body.session.audio.input;
    if (setting.noiseReduction) input.noise_reduction = { type: setting.noiseReduction };
    if (setting.delay) input.transcription.delay = setting.delay;
    if (setting.prompt) input.transcription.prompt = setting.prompt;
    return send(path, { ...init, body: JSON.stringify(body) });
  };
}

export type DirectSession = { ok: true; url: string; secret: string } | { ok: false; why: string };

const safe = (value: unknown) => typeof value === 'string' && /^[\w.[\]-]{1,100}$/.test(value) ? value : null;

/** Status, error code and field of a turned-down request. Never the message, which may echo the key or a name. */
async function rejection(response: Response): Promise<string> {
  const { error } = await response.json().catch(() => ({})) as { error?: { code?: unknown; param?: unknown } };
  const code = safe(error?.code);
  const param = safe(error?.param);
  return `HTTP ${response.status}${code ? ` ${code}` : ''}${param ? ` (${param})` : ''}`;
}

/**
 * What the phone gets from voice-session, but straight from OpenAI with this machine's key, so a setting can be tried
 * before voice-session knows it. The key goes in the header and nowhere else.
 */
export async function directSession(setting: Setting, lineup: string[], apiKey: string, model: string, send: typeof fetch = fetch): Promise<DirectSession> {
  let why = 'no answer from OpenAI';
  const openai: OpenAi = async (path, init) => {
    const response = await send(`https://api.openai.com${path}`, {
      ...init,
      headers: { ...init.headers, authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(10_000),
    });
    why = response.ok ? 'unexpected answer from OpenAI' : await rejection(response.clone());
    return response;
  };
  const reply = await startSession({ names: lineup }, withSetting(setting, openai), model);
  const { url, secret } = reply.body as { url?: string; secret?: string };
  return reply.status === 200 && url && secret ? { ok: true, url, secret } : { ok: false, why };
}
