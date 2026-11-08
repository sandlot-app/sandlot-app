import { readdirSync, readFileSync } from 'node:fs';
import { isDeepStrictEqual } from 'node:util';
import { describe, expect, it } from 'vitest';
import { applyGroup, presets, replay, type Command, type Event, type EventId, type GameId, type GameSetup, type GroupId, type OpponentId, type PlayerId, type PlayerRef, type Timestamp } from '../src/index.ts';
import { canReplay, ENGINE_VERSION, EVENT_SCHEMA_VERSION, REPLAYABLE_ENGINE_VERSIONS } from '../src/version.ts';
import { collectFixtureResults } from '../scripts/fixture-results.ts';

const compat = new URL('../compat/', import.meta.url);
const frozenName = (version: string) => `fixture-results-${version}.json`;
const frozen = (version: string) => JSON.parse(readFileSync(new URL(frozenName(version), compat), 'utf8')) as {
  engineVersion: string;
  eventSchemaVersion: number;
  results: Record<string, unknown>;
};
const olderVersions = REPLAYABLE_ENGINE_VERSIONS.filter((version) => version !== ENGINE_VERSION);

/**
 * The recorded exception for engine 0.3.0 (docs/contract.md, Version pins). 0.3.0 refuses a runner who passes a runner
 * ahead of them (OBR 5.09(b)(9), `runner_passed`), and a runner who moves twice in one runner play (`duplicate_runner`),
 * which 0.2.0 and 0.1.1 accepted. These two fixtures recorded such a play, so their results differ. Only a game whose
 * history holds a pass or a double move stops replaying, and the app never makes one by itself: a scorer has to tap the
 * runners' destinations by hand. The one hosted game holds none. Every other drift still fails the test below, and an
 * entry that no longer drifts fails too, so this list cannot go stale.
 */
const recordedDrift = new Map([
  ['moraga/home-run-moves-only-listed-runners.yaml', 'a home run that left the runner on second behind; renamed home-run-rejects-an-unlisted-runner-left-behind.yaml, now runner_passed'],
  ['moraga/single-moves-listed-runners-atomically.yaml', 'a single that scored the runner from second past the runner left on third; the fixture now sends that runner out, so it still tests atomic moves'],
]);

describe('which engine versions this engine replays', () => {
  it('replays games pinned to its own version and to 0.1.1, and to nothing else', () => {
    expect(canReplay(ENGINE_VERSION)).toBe(true);
    expect(canReplay('0.1.1')).toBe(true);
    for (const other of ['0.1.0', '0.0.1', '0.2.1', '1.0.0', 'future', '']) expect(canReplay(other)).toBe(false);
  });

  it('lists its own version first, once each', () => {
    expect(REPLAYABLE_ENGINE_VERSIONS[0]).toBe(ENGINE_VERSION);
    expect(new Set(REPLAYABLE_ENGINE_VERSIONS).size).toBe(REPLAYABLE_ENGINE_VERSIONS.length);
  });

  it('freezes the fixture results of every older version it still replays, and of no other', () => {
    const files = readdirSync(compat).filter((file) => file.endsWith('.json')).sort();
    expect(files).toEqual(olderVersions.map(frozenName).sort());
  });
});

describe('a game recorded under an older version replays identically', () => {
  it.each(olderVersions)('%s: every fixture result it recorded still comes out the same', (version) => {
    const lock = frozen(version);
    expect(lock.engineVersion).toBe(version);
    // The same event format, or the stored events themselves would not read the same.
    expect(lock.eventSchemaVersion).toBe(EVENT_SCHEMA_VERSION);
    const recorded = Object.keys(lock.results);
    expect(recorded.length).toBeGreaterThan(0);

    const now = collectFixtureResults().results;
    // A result that differs, or a fixture that is gone, means this engine no longer replays that version's games as
    // they were recorded. Take the version out of REPLAYABLE_ENGINE_VERSIONS and delete its frozen file instead of
    // editing the frozen file, and say in the PR which games stop replaying.
    const drifted = recorded.filter((path) => !isDeepStrictEqual(now[path], lock.results[path]));
    expect(drifted.filter((path) => !recordedDrift.has(path))).toEqual([]);
    // An exception that no longer drifts is stale: take it out of the list above.
    expect(recorded.filter((path) => recordedDrift.has(path) && !drifted.includes(path))).toEqual([]);
  });
});

const home = (n: number): PlayerRef => ({ kind: 'player', id: `home-${n}` as PlayerId });
const away = (n: number): PlayerRef => ({ kind: 'opponent', id: `away-${n}` as OpponentId });
const at = '2026-10-28T17:00:00.000Z' as Timestamp;
const positions = ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'] as const;
const nine = (player: (n: number) => PlayerRef) => positions.map((position, index) => ({ player: player(index + 1), position }));
const setup: GameSetup = {
  rules: presets['moraga-mustang-first-half'],
  roster: { home: nine(home).map(({ player }) => player), away: nine(away).map(({ player }) => player) },
  pitcherOutsEarlierToday: {},
};

/**
 * A history shaped like the one hosted game, which is pinned 0.1.1 (22 events: both lineups, the start, pitches and
 * undos, and one single that puts the batter on first with the bases empty). The real events are not kept here, so
 * this is the same shape with made-up pitches and generic IDs, not a copy.
 */
function demoShapedHistory(): Event[] {
  const plays: Command[][] = [
    [{ kind: 'game', control: { kind: 'lineup_set', side: 'away', lineup: nine(away) } }],
    [{ kind: 'game', control: { kind: 'lineup_set', side: 'home', lineup: nine(home) } }],
    [{ kind: 'game', control: { kind: 'start', umpireStart: at } }],
    [{ kind: 'pitch', result: 'ball' }],
    [{ kind: 'pitch', result: 'called_strike' }],
    [{ kind: 'pitch', result: 'foul' }],
    [{ kind: 'pitch', result: 'ball' }],
  ];
  // Six pitches each taken back by the next group, so the log holds undos and nothing they undid counts.
  for (let pair = 0; pair < 6; pair++) {
    plays.push([{ kind: 'pitch', result: 'ball' }]);
    plays.push([{ kind: 'undo', target: `p-${plays.length}` as GroupId }]);
  }
  plays.push([
    { kind: 'pitch', result: 'in_play' },
    { kind: 'ball_in_play', outcome: 'single', trajectory: 'line', fielders: ['LF'], advances: [] },
  ]);
  plays.push([{ kind: 'pitch', result: 'ball' }]);
  let seq = 0;
  return plays.flatMap((commands, play) => commands.map((command): Event => {
    seq += 1;
    return { id: `e-${seq}` as EventId, gameId: 'g' as GameId, seq, group: `p-${play + 1}` as GroupId, lockEpoch: 1, source: 'tap', at, command };
  }));
}

describe('the one hosted game, which is pinned 0.1.1', () => {
  it('is still replayed and continued by this engine, play by play as the server and the page apply it', () => {
    const events = demoShapedHistory();
    expect(events).toHaveLength(22);
    expect(canReplay('0.1.1')).toBe(true);

    const whole = replay(setup, events);
    expect(whole.ok).toBe(true);
    if (!whole.ok) return;
    expect(whole.state).toMatchObject({
      status: 'in_progress', inning: 1, half: 'top', outs: 0, score: { home: 0, away: 0 },
      count: { balls: 1, strikes: 0 },
      bases: { 1: { player: away(1) } },
    });

    // The server and the page apply each stored play as a new play on the plays before it.
    const groups = [...new Set(events.map((event) => event.group))];
    let last = whole.state;
    for (const [index, group] of groups.entries()) {
      const before = events.filter((event) => groups.indexOf(event.group) < index);
      const result = applyGroup(setup, before, events.filter((event) => event.group === group).map((event) => event.command));
      expect(result.ok, group).toBe(true);
      if (result.ok) last = result.state;
    }
    expect(last).toEqual(whole.state);

    const next = applyGroup(setup, events, [{ kind: 'pitch', result: 'called_strike' }]);
    expect(next.ok && next.state.count).toEqual({ balls: 1, strikes: 1, pitches: 2 });
  });
});
