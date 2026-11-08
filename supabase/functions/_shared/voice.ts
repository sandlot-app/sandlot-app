import { jsonResponse, readJson } from './http.ts';

// Shared by voice-session and voice-parse. Request bodies can hold player names (the lineup the phone sends, and the
// transcript), so nothing here logs a body, a transcript or a name (AGENTS.md rule 5).

export type Reply = { status: number; body: unknown };

/** Calls the OpenAI API. Tests pass a fake; index.ts passes one that adds the server's key. */
export type OpenAi = (path: string, init: { method: 'POST'; headers?: Record<string, string>; body: string | FormData }) => Promise<Response>;

export const reply = (status: number, body: unknown): Reply => ({ status, body });
export const unavailable = reply(502, { error: 'voice_unavailable' });

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
const SUFFIX = /^(?:[JjSs][Rr]\.?|II|III|IV)$/;

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

export type Access = 'allowed' | 'forbidden' | 'limited';
export type Admission = (userId: string) => Promise<Access>;

export function voiceEndpoint(
  deps: { getUser: GetUser; access: Admission },
  handle: (body: unknown) => Promise<Reply>,
) {
  return async (request: Request): Promise<Response> => {
    if (request.method !== 'POST') return jsonResponse(reply(405, { error: 'method_not_allowed' }));
    const token = request.headers.get('authorization')?.replace(/^Bearer /i, '');
    const user = token ? await deps.getUser(token).catch(() => ({ userId: null, unavailable: true })) : { userId: null, unavailable: false };
    if (user.unavailable) return jsonResponse(reply(503, { error: 'auth_unavailable' }));
    if (!user.userId) return jsonResponse(reply(401, { error: 'unauthenticated' }));
    const access = await deps.access(user.userId).catch(() => null);
    if (access === null) return jsonResponse(reply(503, { error: 'voice_unavailable' }));
    if (access === 'forbidden') return jsonResponse(reply(403, { error: 'not_scorer' }));
    if (access === 'limited') return jsonResponse(reply(429, { error: 'slow_down' }));
    const body = await readJson(request, 1_500_000);
    return jsonResponse(body.ok ? await handle(body.body) : body.reply);
  };
}
