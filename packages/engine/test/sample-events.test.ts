import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { sampleHalfInning, sampleSetup } from '../scripts/sample-events.ts';
import {
  applyGroup, ENGINE_VERSION, EVENT_SCHEMA_VERSION, parseUploadRequest, replay,
  type Event, type GameId, type GameSetup, type SessionId,
} from '../src/index.ts';

const options = {
  gameId: '11111111-1111-1111-1111-111111111111' as GameId,
  sessionId: '22222222-2222-2222-2222-222222222222' as SessionId,
  lockEpoch: 1,
};

describe('sample-events', () => {
  it('accepts every request printed by the sample CLI and replays the half-inning', () => {
    const printed: unknown = JSON.parse(execFileSync(process.execPath, [
      'scripts/sample-events.ts', '--game', options.gameId, '--session', options.sessionId,
    ], { cwd: new URL('..', import.meta.url), encoding: 'utf8' }));
    expect(printed).toEqual(sampleHalfInning(options));
    if (!Array.isArray(printed)) throw new Error('sample-events must print a request array');
    const requests = printed.map((value) => {
      const parsed = parseUploadRequest(value);
      if (!parsed.ok) throw new Error('sample-events printed an invalid upload request');
      return parsed.request;
    });
    const setup = sampleSetup();
    const events: Event[] = [];
    for (const request of requests) {
      const applied = applyGroup(setup, events, request.events.map(({ command }) => command));
      expect(applied.ok).toBe(true);
      events.push(...request.events);
      expect(replay(setup, events)).toEqual(applied);
    }
    expect(replay(setup, events)).toMatchObject({
      ok: true, state: { inning: 1, half: 'bottom', outs: 0, bases: {}, score: { home: 0, away: 0 }, pitchCounts: { 'home-1': 8, 'away-1': 0 } },
    });
  });
  it('prints the pins of a game that accepts the sample half-inning on one JSON line with --pins', () => {
    const output = execFileSync(process.execPath, ['scripts/sample-events.ts', '--pins'], {
      cwd: new URL('..', import.meta.url), encoding: 'utf8',
    });
    expect(output.trimEnd().split('\n')).toHaveLength(1);
    const { rules, ...setup } = sampleSetup();
    const pins: { rules: GameSetup['rules']; setup: Omit<GameSetup, 'rules'> } = JSON.parse(output);
    expect(pins).toEqual({ engineVersion: ENGINE_VERSION, schemaVersion: EVENT_SCHEMA_VERSION, rules, setup });
    const events = sampleHalfInning(options).flatMap((request) => request.events);
    expect(replay({ ...pins.setup, rules: pins.rules }, events)).toMatchObject({ ok: true });
  });

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
      expect(parseUploadRequest(request)).toEqual({ ok: true, request });
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
