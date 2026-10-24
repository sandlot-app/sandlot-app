import { describe, expect, it } from 'vitest';
import { sampleHalfInning } from '../scripts/sample-events.ts';
import type { GameId, SessionId } from '../src/index.ts';

const options = { gameId: 'game-1' as GameId, sessionId: 'session-1' as SessionId, lockEpoch: 1 };

describe('sample-events', () => {
  it('prints the same requests on every run', () => {
    expect(sampleHalfInning(options)).toEqual(sampleHalfInning(options));
  });

  it('gives a different game different IDs', () => {
    const other = sampleHalfInning({ ...options, gameId: 'game-2' as GameId });
    expect(other[0]!.events[0]!.id).not.toBe(sampleHalfInning(options)[0]!.events[0]!.id);
  });

  it('numbers events from 1 with no gaps across every request', () => {
    const seqs = sampleHalfInning(options).flatMap((r) => r.events.map((e) => e.seq));
    expect(seqs).toEqual(seqs.map((_, i) => i + 1));
  });

  it('meets the parser rules in docs/contract.md for each request', () => {
    for (const request of sampleHalfInning(options)) {
      const [first] = request.events;
      expect(request.events.length).toBeGreaterThan(0);
      expect(request.events.length).toBeLessThanOrEqual(20);
      for (const event of request.events) {
        expect(event).toMatchObject({ gameId: first!.gameId, group: first!.group, lockEpoch: first!.lockEpoch, at: first!.at });
      }
      expect(new Set(request.events.map((e) => e.id)).size).toBe(request.events.length);
    }
  });

  it('gives every event and play a unique ID', () => {
    const requests = sampleHalfInning(options);
    const events = requests.flatMap((r) => r.events);
    expect(new Set(events.map((e) => e.id)).size).toBe(events.length);
    expect(new Set(requests.map((r) => r.events[0]!.group)).size).toBe(requests.length);
  });

  it('records each ball in play as an in_play pitch followed by the outcome', () => {
    for (const { events } of sampleHalfInning(options)) {
      const kinds = events.map((e) => e.command.kind);
      if (!kinds.includes('ball_in_play')) continue;
      expect(events.map((e) => e.command)).toMatchObject([{ kind: 'pitch', result: 'in_play' }, { kind: 'ball_in_play' }]);
    }
  });
});
