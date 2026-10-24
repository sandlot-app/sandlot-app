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

export type UploadEvent = {
  id: string;
  gameId: string;
  seq: number;
  group: string;
  lockEpoch: number;
  source: 'tap' | 'voice';
  at: string;
  command: { kind: string } & Record<string, unknown>;
};

export type UploadRequest = { sessionId: string; events: UploadEvent[] };

export type Outcome = { ok: true; revision: number } | { ok: false; code: ErrorCode };

export type StoredGroup = { userId: string; contentHash: string; ackRevision: number };

export type Base = { revision: number; state: unknown; events: UploadEvent[] };

export type Store = {
  findGroup(gameId: string, groupId: string): Promise<StoredGroup | null>;
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

const MAX_EVENTS = 20;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const isText = (v: unknown): v is string => typeof v === 'string' && v.length > 0;
const isCount = (v: unknown): v is number => Number.isInteger(v) && (v as number) > 0;

function parseEvent(v: unknown): UploadEvent | null {
  if (!isRecord(v)) return null;
  const { id, gameId, seq, group, lockEpoch, source, at, command } = v;
  if (
    !isText(id) || !isText(gameId) || !UUID.test(gameId) || !isCount(seq) || !isText(group) ||
    !isCount(lockEpoch) || (source !== 'tap' && source !== 'voice') || !isText(at) ||
    !isRecord(command) || !isText(command.kind)
  ) {
    return null;
  }
  return { id, gameId, seq, group, lockEpoch, source, at, command: command as UploadEvent['command'] };
}

// Checks the request's shape only. The engine's parseUploadRequest replaces this
// once it exists, and it also checks every command.
export function parseUploadRequest(body: unknown): UploadRequest | null {
  if (!isRecord(body) || !isText(body.sessionId) || !UUID.test(body.sessionId)) return null;
  if (!Array.isArray(body.events) || body.events.length === 0 || body.events.length > MAX_EVENTS) return null;

  const events: UploadEvent[] = [];
  for (const raw of body.events) {
    const event = parseEvent(raw);
    if (!event) return null;
    events.push(event);
  }

  const [first] = events as [UploadEvent, ...UploadEvent[]];
  const ids = new Set(events.map((e) => e.id));
  const consistent = events.every(
    (e, i) =>
      e.gameId === first.gameId && e.group === first.group &&
      e.lockEpoch === first.lockEpoch && e.at === first.at && e.seq === first.seq + i,
  );
  if (!consistent || ids.size !== events.length) return null;

  return { sessionId: body.sessionId, events };
}

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
  const request = parseUploadRequest(body);
  if (!request) return { ok: false, code: 'invalid' };

  const { events, sessionId } = request;
  const [first] = events as [UploadEvent, ...UploadEvent[]];
  const hash = await contentHash(events);

  // Before the engine on purpose: a retry after a lost response is a group the
  // server already saved, and replaying it would reject an accepted play.
  const stored = await store.findGroup(first.gameId, first.group);
  if (stored) return savedOutcome(stored, userId, hash);

  const base = await store.getBase(first.gameId);
  if (!base) return { ok: false, code: 'invalid' };
  if (base.revision !== first.seq - 1) {
    const committed = await store.findGroup(first.gameId, first.group);
    return committed ? savedOutcome(committed, userId, hash) : { ok: false, code: 'stale_revision' };
  }

  // First connection test only: the engine has no game logic yet, so the group is
  // stored without replaying or applying it, and the cached state is unchanged.
  // Milestone 6 requires the engine step here.
  const newState = base.state;

  return store.commitGroup({
    userId,
    sessionId,
    gameId: first.gameId,
    baseRevision: base.revision,
    events,
    newState,
    contentHash: hash,
  });
}
