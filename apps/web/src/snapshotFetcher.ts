import type { LiveAction } from './live.ts';
import { isSnapshot } from './snapshot.ts';

export type SnapshotReply = { data: unknown; error: unknown };

/** Calls `get_snapshot` for the events after `afterSeq`, and cancels the call when `signal` aborts. */
export type LoadSnapshot = (afterSeq: number, signal: AbortSignal) => PromiseLike<SnapshotReply>;

export const SNAPSHOT_TIMEOUT_MS = 10_000;

type Page = {
  afterSeq: () => number;
  send: (action: LiveAction) => void;
  subscribed: () => boolean;
  closed: () => boolean;
};

async function loadWithTimeout(load: LoadSnapshot, afterSeq: number, timeoutMs: number): Promise<SnapshotReply> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  // The race settles even when the request ignores the abort, so a hung request always lets the next one through.
  const timedOut = new Promise<SnapshotReply>((resolve) => {
    timer = setTimeout(() => {
      controller.abort();
      resolve({ data: null, error: new Error(`get_snapshot took longer than ${timeoutMs} ms`) });
    }, timeoutMs);
  });
  try {
    return await Promise.race([load(afterSeq, controller.signal), timedOut]);
  } catch (error) {
    return { data: null, error };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Returns the function the page calls whenever it wants the latest snapshot. It sends one request at a time, so two
 * replies can never arrive out of order and leave a gap in the events. A call made while a request is out runs once
 * that request ends.
 */
export function snapshotFetcher(load: LoadSnapshot, page: Page, timeoutMs = SNAPSHOT_TIMEOUT_MS): () => Promise<void> {
  let fetching = false;
  let fetchAgain = false;
  return async () => {
    if (fetching) {
      fetchAgain = true;
      return;
    }
    fetching = true;
    try {
      do {
        fetchAgain = false;
        const { data, error } = await loadWithTimeout(load, page.afterSeq(), timeoutMs);
        if (page.closed()) return;
        if (error || (data !== null && !isSnapshot(data))) {
          page.send({ type: 'connection', status: 'reconnecting' });
        } else {
          page.send({ type: 'snapshot', snapshot: data });
          if (page.subscribed()) page.send({ type: 'connection', status: 'live' });
        }
      } while (fetchAgain);
    } finally {
      fetching = false;
    }
  };
}
