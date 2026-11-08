import postgres from 'postgres';
import { createClient } from '@supabase/supabase-js';
import { type Access, type GetUser, type OpenAi, signedIn } from './voice.ts';

// The deployed side of a voice function: Supabase sign-in and the OpenAI key from the function's secrets.

const auth = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!).auth;

export const getUser: GetUser = async (token) => {
  const { data, error } = await auth.getUser(token).catch((thrown) => ({ data: { user: null }, error: { status: undefined, thrown } }));
  return signedIn(data.user, error);
};

/** Null when the key isn't set, so the function answers "voice unavailable" rather than failing. */
export function openAi(): OpenAi | null {
  const key = Deno.env.get('OPENAI_API_KEY');
  if (!key) return null;
  return (path, init) => fetch(`https://api.openai.com${path}`, {
    ...init,
    headers: { ...init.headers, authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(10_000),
  });
}

export const sql = postgres(Deno.env.get('SUPABASE_DB_URL')!, { prepare: false });

export async function admit(userId: string, scope: 'voice' | 'sync'): Promise<Access> {
  const [row] = await sql<{ access: Access }[]>`select private.admit_request(${userId}::uuid, ${scope}) as access`;
  if (!row || !['allowed', 'forbidden', 'limited'].includes(row.access)) throw new Error('Admission unavailable');
  return row.access;
}
