import { readdirSync, readFileSync } from 'node:fs';
import { isDeepStrictEqual } from 'node:util';
import { describe, expect, it } from 'vitest';
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
    expect(drifted).toEqual([]);
  });
});
