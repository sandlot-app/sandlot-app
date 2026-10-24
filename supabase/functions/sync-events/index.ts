import { createClient } from '@supabase/supabase-js';
import postgres from 'postgres';
import { STATUS, syncEvents, type Store, type UploadEvent } from './handler.ts';

const sql = postgres(Deno.env.get('SUPABASE_DB_URL')!, { prepare: false });
const auth = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!).auth;

const store: Store = {
  async findGroup(gameId, groupId) {
    const [row] = await sql<{ userId: string; contentHash: string; ackRevision: number }[]>`
      select user_id as "userId", content_hash as "contentHash", ack_revision as "ackRevision"
      from public.groups where game_id = ${gameId} and group_id = ${groupId}`;
    return row ?? null;
  },
  async getBase(gameId) {
    const [row] = await sql`select private.get_base(${gameId}) as base`;
    return row?.base ?? null;
  },
  async commitGroup(c) {
    const [row] = await sql`
      select private.commit_group(
        ${c.userId}, ${c.sessionId}, ${c.gameId}, ${c.baseRevision},
        ${sql.json(c.events as UploadEvent[] & postgres.JSONValue)}, ${sql.json(c.newState as postgres.JSONValue)},
        ${c.contentHash}
      ) as outcome`;
    return row!.outcome;
  },
};

const reply = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

// Data exceptions mean the request held a value Postgres cannot store, which is the
// phone's bug, not an outage the phone should retry.
const invalidData = (error: unknown) =>
  error instanceof postgres.PostgresError && error.code.startsWith('22');

Deno.serve(async (req) => {
  const token = req.headers.get('authorization')?.replace(/^Bearer /i, '');
  const { data, error } = token ? await auth.getUser(token) : { data: { user: null }, error: null };
  const rejectedToken = error?.status !== undefined && error.status >= 400 && error.status < 500;
  if (error && !rejectedToken) return reply(503, { error: 'auth_unavailable' });
  if (!data.user) return reply(STATUS.unauthenticated, { error: 'unauthenticated' });

  const body = await req.json().catch(() => null);
  const outcome = await syncEvents(data.user.id, body, store).catch((error) => {
    if (invalidData(error)) return { ok: false, code: 'invalid' } as const;
    throw error;
  });
  if (outcome.ok) return reply(200, { revision: outcome.revision });
  return reply(
    STATUS[outcome.code],
    outcome.code === 'rejected' ? { error: outcome.code, reason: outcome.reason } : { error: outcome.code },
  );
});
