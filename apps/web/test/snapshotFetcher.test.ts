import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LiveAction } from '../src/live.ts';
import { SNAPSHOT_TIMEOUT_MS, snapshotFetcher, type LoadSnapshot, type SnapshotReply } from '../src/snapshotFetcher.ts';
import { sampleEvents, snapshot } from './helpers.ts';

const reply = (): SnapshotReply => ({ data: snapshot(sampleEvents()), error: null });
const never = (): Promise<SnapshotReply> => new Promise(() => {});

function page() {
  const sent: LiveAction[] = [];
  return { sent, afterSeq: () => 0, send: (action: LiveAction) => sent.push(action), subscribed: () => true, closed: () => false };
}

describe('snapshotFetcher', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('gives up on a hung request, shows reconnecting, and lets the next fetch through', async () => {
    const signals: AbortSignal[] = [];
    const load = vi.fn<LoadSnapshot>((_afterSeq, signal) => {
      signals.push(signal);
      return signals.length === 1 ? never() : Promise.resolve(reply());
    });
    const live = page();
    const fetchSnapshot = snapshotFetcher(load, live);

    const hung = fetchSnapshot();
    await vi.advanceTimersByTimeAsync(SNAPSHOT_TIMEOUT_MS);
    await hung;

    expect(signals[0]?.aborted).toBe(true);
    expect(live.sent).toEqual([{ type: 'connection', status: 'reconnecting' }]);

    await fetchSnapshot();

    expect(load).toHaveBeenCalledTimes(2);
    expect(live.sent.slice(1).map((action) => (action.type === 'connection' ? action.status : action.type))).toEqual(['snapshot', 'live']);
  });

  it('runs a fetch asked for during a request once that request ends', async () => {
    let finish: (value: SnapshotReply) => void = () => {};
    let calls = 0;
    const load = vi.fn<LoadSnapshot>(() =>
      ++calls === 1 ? new Promise((resolve) => (finish = resolve)) : Promise.resolve(reply()),
    );
    const fetchSnapshot = snapshotFetcher(load, page());

    const first = fetchSnapshot();
    await fetchSnapshot();
    expect(load).toHaveBeenCalledTimes(1);

    finish(reply());
    await first;
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('shows reconnecting when the request fails outright', async () => {
    const live = page();

    await snapshotFetcher(() => Promise.reject(new Error('offline')), live)();

    expect(live.sent).toEqual([{ type: 'connection', status: 'reconnecting' }]);
  });
});
