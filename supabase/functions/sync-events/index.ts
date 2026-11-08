import { admit, getUser, sql } from '../_shared/wiring.ts';
import { syncEndpoint } from './endpoint.ts';
import postgres from 'postgres';
import { type Store, type UploadEvent } from './handler.ts';



const store: Store = {
  async findGroup(gameId, groupId) {
    const [row] = await sql<{ userId: string; contentHash: string; ackRevision: number }[]>`
      select user_id as "userId", content_hash as "contentHash", ack_revision as "ackRevision"
      from public.groups where game_id = ${gameId} and group_id = ${groupId}`;
    return row ?? null;
  },
  async sessionEpoch(gameId, sessionId, userId) {
    const [row] = await sql<{ epoch: number }[]>`
      select s.epoch
      from public.scoring_sessions s join public.games g on g.id = s.game_id
      where s.id = ${sessionId} and s.game_id = ${gameId} and s.user_id = ${userId}
        and s.epoch = g.lock_epoch`;
    return row?.epoch ?? null;
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

const invalidData = (error: unknown) =>
  error instanceof postgres.PostgresError && error.code.startsWith('22');

Deno.serve(syncEndpoint({ getUser, access: (userId) => admit(userId, 'sync'), store, invalidData }));
