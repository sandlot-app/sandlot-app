import type { UploadRequest } from '@sandlot/engine';
import { createClient, isAuthRetryableFetchError } from '@supabase/supabase-js';
import Storage from 'expo-sqlite/kv-store';
import { resolveToken, type AuthPort, type TokenResult } from './identity.ts';
import { ServerRefused, type ServerRows } from './server-game.ts';
import type { Send } from './upload.ts';

// The phone's Supabase project, shared by voice and sync: one anonymous sign-in, kept across launches.

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

const supabase = url && key ? createClient(url, key, {
  // Each request reads the session, which refreshes an expired token, so no background timer is needed.
  auth: { storage: Storage, persistSession: true, autoRefreshToken: false, detectSessionInUrl: false },
}) : null;

/** The project's URL and publishable key, or null when this build has none. */
export const project = url && key ? { url, key } : null;

const auth: AuthPort | null = supabase ? {
  getSession: async () => { const { data, error } = await supabase.auth.getSession(); return { session: data.session, error }; },
  refreshSession: async () => { const { data, error } = await supabase.auth.refreshSession(); return { session: data.session, error }; },
  signInAnonymously: async () => { const { data, error } = await supabase.auth.signInAnonymously(); return { session: data.session, error }; },
  retryable: (error) => isAuthRetryableFetchError(error),
} : null;

/** The signed-in phone's token, keeping the identity the seed made a scorer (see identity.ts). */
async function phoneToken(fresh: boolean): Promise<TokenResult> {
  if (!auth) return { failure: 'signed_out' };
  return resolveToken(auth, Storage, fresh).catch(() => ({ failure: 'offline' as const }));
}

/** The signed-in phone's token, or null when there isn't one. An anonymous sign-in is enough for the demo. */
export async function token(fresh: boolean): Promise<string | null> {
  const result = await phoneToken(fresh);
  return 'token' in result ? result.token : null;
}

/** This phone's user ID, which the seed script needs to make it the demo game's scorer. Null until it signs in. */
export async function phoneId(): Promise<string | null> {
  if (!supabase || !(await token(false))) return null;
  return (await supabase.auth.getSession()).data.session?.user.id ?? null;
}

/** sync-events, with a 20-second limit. Null when no answer came back. */
export const send: Send | null = project ? async (request: UploadRequest, fresh: boolean) => {
  const signedIn = await phoneToken(fresh);
  // With no answer from sign-in, nothing was sent. Signed out reads like the server's own 401.
  if ('failure' in signedIn) return signedIn.failure === 'offline' ? null : { status: 401, body: { error: 'unauthenticated' } };
  const bearer = signedIn.token;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch(`${project.url}/functions/v1/sync-events`, {
      method: 'POST', signal: controller.signal, body: JSON.stringify(request),
      headers: { apikey: project.key, Authorization: `Bearer ${bearer}`, 'content-type': 'application/json' },
    });
    return { status: response.status, body: await response.json().catch(() => null) };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
} : null;

/** The reads that find this phone's server game. Each throws when the server doesn't answer. */
export const serverRows: ServerRows | null = supabase ? {
  async latestSession() {
    if (!(await token(false))) throw new Error('Not signed in');
    const { data, error } = await supabase.from('scoring_sessions').select('id, game_id, epoch')
      .order('started_at', { ascending: false }).limit(1).maybeSingle();
    if (error) throw error.code ? new ServerRefused(error.code) : error;
    return data;
  },
  async game(id) {
    const { data, error } = await supabase.from('games')
      .select('id, engine_version, schema_version, rules, setup, lock_epoch, revision').eq('id', id).maybeSingle();
    if (error) throw error.code ? new ServerRefused(error.code) : error;
    return data;
  },
} : null;
