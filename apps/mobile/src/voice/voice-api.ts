import { readAnswer, type Answer, type PressContext } from '@sandlot/voice';

// The two voice functions, as the Voice section of docs/contract.md describes them. Bodies carry display names and
// what was said, so nothing here logs a body, a transcript or a name (rule 5).

/** Why a press fell back to taps. Each one shows one line, and the pitch buttons keep working (spec A10). */
export type VoiceFailure =
  | 'unauthenticated' | 'slow_down' | 'too_long' | 'invalid' | 'voice_unavailable' | 'auth_unavailable'
  | 'timeout' | 'offline' | 'microphone';

export type Result<T> = { ok: true; value: T } | { ok: false; failure: VoiceFailure };

export type Session = { url: string; secret: string; expiresAt: number; sampleRate: number };
/** The words, or the clip when streaming didn't connect, with the game as the AI sees it. */
export type ParseBody = { transcript: string; context: PressContext } | { audio: string; context: PressContext };
/** `answer` is null for empty words, words the phone reads itself, or an answer voice-parse couldn't use. */
export type Parsed = { transcript: string; answer: Answer | null };

export type VoiceApi = {
  session(names: string[]): Promise<Result<Session>>;
  parse(body: ParseBody): Promise<Result<Parsed>>;
};

type Fetch = (url: string, init: { method: 'POST'; headers: Record<string, string>; body: string; signal: AbortSignal }) =>
  Promise<{ status: number; json(): Promise<unknown> }>;

export type ApiConfig = {
  /** The Supabase project URL. */
  url: string;
  /** The project's publishable key, which the gateway wants on every call. */
  key: string;
  /** The signed-in phone's access token. `fresh` signs in again after a 401. */
  token(fresh: boolean): Promise<string | null>;
  fetch: Fetch;
  /** A clip goes through two OpenAI calls, so each request gets about 25 seconds. */
  timeoutMs?: number;
};

const failures: Record<number, VoiceFailure> = {
  400: 'invalid',
  401: 'unauthenticated',
  413: 'too_long',
  429: 'slow_down',
  502: 'voice_unavailable',
  503: 'auth_unavailable',
};

const isText = (value: unknown): value is string => typeof value === 'string';

function session(value: unknown): Session | null {
  const raw = value as Partial<Session> | null;
  if (!raw || !isText(raw.url) || !raw.url.startsWith('wss://') || !isText(raw.secret)) return null;
  if (typeof raw.expiresAt !== 'number' || typeof raw.sampleRate !== 'number') return null;
  return { url: raw.url, secret: raw.secret, expiresAt: raw.expiresAt, sampleRate: raw.sampleRate };
}

/** The reply, with the answer read as strictly as voice-parse read it, so nothing outside the schema reaches decide(). */
function parsed(value: unknown): Parsed | null {
  const raw = value as { transcript?: unknown; answer?: unknown } | null;
  if (!raw || !isText(raw.transcript) || !('answer' in raw)) return null;
  if (raw.answer === null) return { transcript: raw.transcript, answer: null };
  const answer = readAnswer(raw.answer);
  return answer ? { transcript: raw.transcript, answer } : null;
}

export function createVoiceApi({ url, key, token, fetch, timeoutMs = 25_000 }: ApiConfig): VoiceApi {
  async function call<T>(name: string, body: unknown, read: (value: unknown) => T | null): Promise<Result<T>> {
    for (const fresh of [false, true]) {
      const access = await token(fresh).catch(() => null);
      if (!access) return { ok: false, failure: 'auth_unavailable' };
      const abort = new AbortController();
      const timer = setTimeout(() => abort.abort(), timeoutMs);
      try {
        const response = await fetch(`${url}/functions/v1/${name}`, {
          method: 'POST',
          headers: { authorization: `Bearer ${access}`, apikey: key, 'content-type': 'application/json' },
          body: JSON.stringify(body),
          signal: abort.signal,
        });
        // The gateway can answer 401 before the function runs, with its own body, so this reads the status only.
        if (response.status === 401 && !fresh) continue;
        if (response.status !== 200) return { ok: false, failure: failures[response.status] ?? 'voice_unavailable' };
        const value = read(await response.json().catch(() => null));
        return value ? { ok: true, value } : { ok: false, failure: 'voice_unavailable' };
      } catch {
        return { ok: false, failure: abort.signal.aborted ? 'timeout' : 'offline' };
      } finally {
        clearTimeout(timer);
      }
    }
    return { ok: false, failure: 'unauthenticated' };
  }
  return {
    session: (names) => call('voice-session', { names }, session),
    parse: (body) => call('voice-parse', body, parsed),
  };
}
