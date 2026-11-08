import { jsonResponse, readJson } from '../_shared/http.ts';
import type { Admission, GetUser } from '../_shared/voice.ts';
import { STATUS, syncEvents, type Store } from './handler.ts';

export function syncEndpoint(deps: { getUser: GetUser; access: Admission; store: Store; invalidData(error: unknown): boolean }) {
  return async (request: Request): Promise<Response> => {
    if (request.method !== 'POST') return jsonResponse({ status: 405, body: { error: 'method_not_allowed' } });
    const token = request.headers.get('authorization')?.replace(/^Bearer /i, '');
    const user = token ? await deps.getUser(token).catch(() => ({ userId: null, unavailable: true })) : { userId: null, unavailable: false };
    if (user.unavailable) return jsonResponse({ status: 503, body: { error: 'auth_unavailable' } });
    if (!user.userId) return jsonResponse({ status: 401, body: { error: 'unauthenticated' } });
    const access = await deps.access(user.userId).catch(() => null);
    if (access === null) return jsonResponse({ status: 503, body: { error: 'sync_unavailable' } });
    if (access === 'forbidden') return jsonResponse({ status: 403, body: { error: 'stale_session' } });
    if (access === 'limited') return jsonResponse({ status: 429, body: { error: 'slow_down' } });
    const body = await readJson(request, 262_144);
    if (!body.ok) return jsonResponse(body.reply);
    const outcome = await syncEvents(user.userId, body.body, deps.store).catch((error) => {
      if (deps.invalidData(error)) return { ok: false, code: 'invalid' } as const;
      throw error;
    });
    return jsonResponse(outcome.ok
      ? { status: 200, body: { revision: outcome.revision } }
      : { status: STATUS[outcome.code], body: outcome.code === 'rejected'
        ? { error: outcome.code, reason: outcome.reason } : { error: outcome.code } });
  };
}
