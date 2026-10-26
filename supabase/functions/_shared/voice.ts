// Shared by voice-session and voice-parse. Request bodies can hold player names (the lineup the phone sends, and the
// transcript), so nothing here logs a body, a transcript or a name (AGENTS.md rule 5).

export type Reply = { status: number; body: unknown };

/** Calls the OpenAI API. Tests pass a fake; index.ts passes one that adds the server's key. */
export type OpenAi = (path: string, init: { method: 'POST'; headers?: Record<string, string>; body: string | FormData }) => Promise<Response>;

export const reply = (status: number, body: unknown): Reply => ({ status, body });
export const unavailable = reply(502, { error: 'voice_unavailable' });

/**
 * At most `max` requests per user in any `windowMs`. It lives in the function instance, so a burst across instances can
 * get a little more; that's enough to keep one phone from running up the bill until the monthly cap (A9) arrives with #29.
 */
export function rateLimit(max: number, windowMs: number) {
  const recent = new Map<string, number[]>();
  return (userId: string, now: number): boolean => {
    const kept = (recent.get(userId) ?? []).filter((at) => now - at < windowMs);
    if (kept.length >= max) {
      recent.set(userId, kept);
      return false;
    }
    kept.push(now);
    recent.set(userId, kept);
    return true;
  };
}

/** A list of short display names from the phone, or null if it isn't one. */
export function names(value: unknown, max = 40): string[] | null {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > max) return null;
  if (!value.every((item) => typeof item === 'string' && item.length <= 40 && /^[\p{L}\p{N} .'’-]*$/u.test(item))) return null;
  return value as string[];
}

/** Who signed the request, or whether the auth service couldn't say. */
export type GetUser = (token: string) => Promise<{ userId: string | null; unavailable: boolean }>;

/** 15 seconds of base64 audio plus room for the JSON around it. */
const MAX_BODY_BYTES = 1_500_000;

/**
 * Everything a voice function checks before its handler runs: a POST from a signed-in phone (an anonymous sign-in is
 * enough for the demo; the scorer-lock check, A8, waits for #29), inside the rate limit, with a body that fits.
 */
export function voiceEndpoint(
  deps: { getUser: GetUser; allow: (userId: string, now: number) => boolean; now: () => number },
  handle: (body: unknown) => Promise<Reply>,
) {
  return async (request: Request): Promise<Response> => {
    const send = ({ status, body }: Reply) =>
      new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
    if (request.method !== 'POST') return send(reply(405, { error: 'method_not_allowed' }));
    const token = request.headers.get('authorization')?.replace(/^Bearer /i, '');
    const user = token ? await deps.getUser(token) : { userId: null, unavailable: false };
    if (user.unavailable) return send(reply(503, { error: 'auth_unavailable' }));
    if (!user.userId) return send(reply(401, { error: 'unauthenticated' }));
    if (!deps.allow(user.userId, deps.now())) return send(reply(429, { error: 'slow_down' }));
    if (Number(request.headers.get('content-length') ?? 0) > MAX_BODY_BYTES) return send(reply(413, { error: 'too_long' }));
    const text = await request.text();
    if (text.length > MAX_BODY_BYTES) return send(reply(413, { error: 'too_long' }));
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      return send(reply(400, { error: 'invalid' }));
    }
    return send(await handle(body));
  };
}
