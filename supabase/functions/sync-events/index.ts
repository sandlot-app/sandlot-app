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

Deno.serve(async (req) => {
  const token = req.headers.get('authorization')?.replace(/^Bearer /i, '');
  const { data } = token ? await auth.getUser(token) : { data: { user: null } };
  if (!data.user) return reply(STATUS.unauthenticated, { error: 'unauthenticated' });

  const body = await req.json().catch(() => null);
  const outcome = await syncEvents(data.user.id, body, store);
  return outcome.ok
    ? reply(200, { revision: outcome.revision })
    : reply(STATUS[outcome.code], { error: outcome.code });
});
