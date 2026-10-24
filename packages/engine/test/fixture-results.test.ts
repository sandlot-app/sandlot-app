import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ENGINE_VERSION, EVENT_SCHEMA_VERSION } from '../src/version.ts';
import { collectFixtureResults } from '../scripts/fixture-results.ts';

describe('fixture result lock', () => {
  it('records the released engine and event schema beside every fixture result', () => {
    const snapshot = JSON.parse(readFileSync(new URL('../src/fixture-results.json', import.meta.url), 'utf8'));
    expect(snapshot.engineVersion).toBe(ENGINE_VERSION);
    expect(snapshot.eventSchemaVersion).toBe(EVENT_SCHEMA_VERSION);
    expect(Object.keys(snapshot.results).length).toBeGreaterThan(0);
    expect(snapshot).toEqual(collectFixtureResults());
  });
});
