import { parseUploadRequest } from '../../../packages/engine/src/contract.ts';
import { applyGroup, type RejectCode } from '../../../packages/engine/src/engine.ts';
import type { Event, GameSetup, RuleSet } from '../../../packages/engine/src/types.ts';
import { ENGINE_VERSION } from '../../../packages/engine/src/version.ts';

export type { UploadRequest } from '../../../packages/engine/src/contract.ts';
export type UploadEvent = Event;

export type ErrorCode =
  | 'unauthenticated'
  | 'invalid'
  | 'rejected'
  | 'id_conflict'
  | 'stale_revision'
  | 'stale_session'
  | 'unsupported_version';

export const STATUS: Record<ErrorCode, number> = {
  unauthenticated: 401,
  invalid: 400,
  rejected: 422,
  id_conflict: 409,
  stale_revision: 409,
  stale_session: 403,
  unsupported_version: 409,
};

export type Outcome =
  | { ok: true; revision: number }
  | { ok: false; code: Exclude<ErrorCode, 'rejected'> }
  | { ok: false; code: 'rejected'; reason: RejectCode };

export type StoredGroup = { userId: string; contentHash: string; ackRevision: number };

export type Base = {
  engineVersion: string;
  schemaVersion: number;
  rules: RuleSet;
  setup: Omit<GameSetup, 'rules'>;
  revision: number;
  state: unknown;
  events: UploadEvent[];
};

export type Store = {
  findGroup(gameId: string, groupId: string): Promise<StoredGroup | null>;
  sessionEpoch(gameId: string, sessionId: string, userId: string): Promise<number | null>;
  getBase(gameId: string): Promise<Base | null>;
  commitGroup(commit: {
    userId: string;
    sessionId: string;
    gameId: string;
    baseRevision: number;
    events: UploadEvent[];
    newState: unknown;
    contentHash: string;
  }): Promise<Outcome>;
};

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.keys(value).sort().map((key) => [key, canonical(value[key])]),
    );
  }
  return value;
}

export async function contentHash(events: UploadEvent[]): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(canonical(events)));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

function savedOutcome(stored: StoredGroup, userId: string, hash: string): Outcome {
  return stored.contentHash === hash && stored.userId === userId
    ? { ok: true, revision: stored.ackRevision }
    : { ok: false, code: 'id_conflict' };
}

export async function syncEvents(userId: string, body: unknown, store: Store): Promise<Outcome> {
  const parsed = parseUploadRequest(body);
  if (!parsed.ok) return { ok: false, code: parsed.code };

  const { events, schemaVersion, sessionId } = parsed.request;
  const [first] = events as [UploadEvent, ...UploadEvent[]];
  const hash = await contentHash(events);

  // Before the engine on purpose: a retry after a lost response is a group the
  // server already saved, and replaying it would reject an accepted play.
  const stored = await store.findGroup(first.gameId, first.group);
  if (stored) return savedOutcome(stored, userId, hash);

  // Before the base on purpose: getBase reads as the database owner, so without this
  // a caller who does not hold scoring could probe a private game through engine reasons.
  const epoch = await store.sessionEpoch(first.gameId, sessionId, userId);
  if (epoch === null || epoch !== first.lockEpoch) return { ok: false, code: 'stale_session' };

  const base = await store.getBase(first.gameId);
  if (!base) return { ok: false, code: 'invalid' };
  if (base.engineVersion !== ENGINE_VERSION || base.schemaVersion !== schemaVersion) {
    return { ok: false, code: 'unsupported_version' };
  }
  // A concurrent request can commit this group after the lookup above, which makes
  // the group stale or illegal against the base read here. The saved group decides.
  const savedOr = async (failure: Outcome): Promise<Outcome> => {
    const saved = await store.findGroup(first.gameId, first.group);
    return saved ? savedOutcome(saved, userId, hash) : failure;
  };
  if (base.revision !== first.seq - 1) return savedOr({ ok: false, code: 'stale_revision' });

  const applied = applyGroup({ ...base.setup, rules: base.rules }, base.events, events.map((e) => e.command));
  if (!applied.ok) return savedOr({ ok: false, code: 'rejected', reason: applied.code });

  return store.commitGroup({
    userId,
    sessionId,
    gameId: first.gameId,
    baseRevision: base.revision,
    events,
    newState: applied.state,
    contentHash: hash,
  });
}
