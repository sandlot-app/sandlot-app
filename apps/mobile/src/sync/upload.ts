import type { UploadRequest } from '@sandlot/engine';
import type { OpenResult, SavedGame } from '../scoring/offline-game.ts';

// The phone's side of the write path in docs/contract.md: send each waiting play to sync-events in order, and count a
// play as uploaded only once the server acknowledges it. Plays are sent exactly as saved; nothing here changes them.

/** One request to sync-events. `fresh` asks for a new sign-in token. Null means no answer came back. */
export type Send = (request: UploadRequest, fresh: boolean) => Promise<{ status: number; body: unknown } | null>;

/** The upload side of a ready game. */
export type UploadStore = Pick<Extract<OpenResult, { kind: 'ready' }>, 'nextUpload' | 'acknowledge'>;

/** Why the queue stopped, as the sync line says it. Each one keeps every waiting play on the phone. */
export type StopReason = 'update_app' | 'rejected' | 'session' | 'conflict' | 'signed_out';

export type UploadResult = { status: UploadStatus; game: SavedGame | null };

export type UploadStatus =
  | { kind: 'synced' }
  /** No signal, a server error or a lost answer: the same play is sent again later. */
  | { kind: 'waiting' }
  | { kind: 'stopped'; reason: StopReason };

// The phone action for each error in docs/contract.md's Errors table.
const stops: Record<string, StopReason> = {
  unsupported_version: 'update_app',
  rejected: 'rejected',
  stale_session: 'session',
  stale_revision: 'conflict',
  id_conflict: 'conflict',
  invalid: 'conflict',
};

const errorCode = (body: unknown) =>
  typeof body === 'object' && body !== null && 'error' in body && typeof body.error === 'string' ? body.error : null;

/**
 * Sends waiting plays until none wait or one can't go yet. Returns where the queue stands and the game after the last
 * acknowledgment, or null when nothing was acknowledged.
 */
export async function uploadWaiting(store: UploadStore, send: Send): Promise<UploadResult> {
  let game: SavedGame | null = null;
  for (let request = await store.nextUpload(); request; request = await store.nextUpload()) {
    let answer = await send(request, false);
    // The contract's phone action for unauthenticated: refresh the sign-in, then retry. A second one means signed out.
    if (answer?.status === 401) answer = await send(request, true);
    if (answer?.status === 401) return { status: { kind: 'stopped', reason: 'signed_out' }, game };
    if (!answer || answer.status >= 500) return { status: { kind: 'waiting' }, game };
    if (answer.status !== 200) {
      return { status: { kind: 'stopped', reason: stops[errorCode(answer.body) ?? ''] ?? 'conflict' }, game };
    }
    const revision = (answer.body as { revision?: unknown } | null)?.revision;
    // The server acknowledges a group at its last seq. Any other revision means its game isn't the phone's.
    if (revision !== request.events.at(-1)!.seq) return { status: { kind: 'stopped', reason: 'conflict' }, game };
    // A failure saving the acknowledgment on this phone isn't the server's. The next run resends, and the server
    // answers with the acknowledgment it stored.
    const acknowledged = await store.acknowledge(request.events[0]!.group, revision);
    if (!acknowledged) return { status: { kind: 'waiting' }, game };
    game = acknowledged;
  }
  return { status: { kind: 'synced' }, game };
}
