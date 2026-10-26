import { createClient } from '@supabase/supabase-js';
import type { GetUser, OpenAi } from './voice.ts';

// The deployed side of a voice function: Supabase sign-in and the OpenAI key from the function's secrets.

const auth = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!).auth;

export const getUser: GetUser = async (token) => {
  const { data, error } = await auth.getUser(token);
  const rejected = error?.status !== undefined && error.status >= 400 && error.status < 500;
  return { userId: data.user?.id ?? null, unavailable: Boolean(error) && !rejected };
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
