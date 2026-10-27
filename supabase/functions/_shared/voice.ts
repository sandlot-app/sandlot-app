// Shared by voice-session and voice-parse. Request bodies can hold player names (the lineup the phone sends, and the
// transcript), so nothing here logs a body, a transcript or a name (AGENTS.md rule 5).

export type Reply = { status: number; body: unknown };

/** Calls the OpenAI API. Tests pass a fake; index.ts passes one that adds the server's key. */
export type OpenAi = (path: string, init: { method: 'POST'; headers?: Record<string, string>; body: string | FormData }) => Promise<Response>;

export const reply = (status: number, body: unknown): Reply => ({ status, body });
export const unavailable = reply(502, { error: 'voice_unavailable' });

/**
 * At most `max` requests per user in any `windowMs`. It lives in the function instance, so each instance counts on its
 * own. It slows down one busy phone; it is not a spending cap. The OpenAI project budget is that (contract, Cost).
 */
export function rateLimit(max: number, windowMs: number, recent = new Map<string, number[]>()) {
  return (userId: string, now: number): boolean => {
    for (const [id, times] of recent) if (times.every((at) => now - at >= windowMs)) recent.delete(id);
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

/**
 * Short display names from the phone, skipping any that are empty or have characters a name doesn't, or null if it
 * isn't a short list of text (the phone has a bug).
 */
export function names(value: unknown, max = 40): string[] | null {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > max || value.some((item) => typeof item !== 'string')) return null;
  return (value as string[]).filter((item) => item.trim() !== '' && item.length <= 40 && /^[\p{L}\p{N} .'’-]+$/u.test(item));
}

/** Jr and Sr in any case, Roman numerals in capitals only, so a surname like "Ii" stays. */
const SUFFIX = /^(?:[JjSs]r\.?|II|III|IV)$/;

/** Last names only, past any Jr or III: what the transcriber needs to spell a player's name, and no more (data minimization). */
export const lastNames = (list: string[]) => [...new Set(list.map((name) => {
  const words = name.trim().split(/\s+/);
  while (words.length > 1 && SUFFIX.test(words.at(-1)!)) words.pop();
  return words.at(-1)!.replace(/^[.'’-]+|[.'’-]+$/g, '');
}).filter(Boolean))];

/**
 * Supabase's answer to "who sent this token". A 4xx means the token is no good (401), except 429, which, like a 5xx
 * or a network error, means sign-in is busy or down right now (503), so the phone doesn't throw away a good session.
 */
export function signedIn(user: { id: string } | null, error: { status?: number } | null): { userId: string | null; unavailable: boolean } {
  const rejected = error?.status !== undefined && error.status >= 400 && error.status < 500 && error.status !== 429;
  return { userId: user?.id ?? null, unavailable: Boolean(error) && !rejected };
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
