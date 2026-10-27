import { relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkFixture, loadFixture, runFixture, statsFixtureFiles, statsFixtureRoot } from './fixture-runner.ts';

describe('batting-line fixtures', () => {
  it('finds at least one fixture', () => {
    expect(statsFixtureFiles.length).toBeGreaterThan(0);
  });

  for (const file of statsFixtureFiles) {
    const fixture = loadFixture(file);
    it(`${relative(statsFixtureRoot, file)}: ${fixture.name}`, () => {
      expect(fixture.batting, "a batting-line fixture states every batter's line").toBeDefined();
      checkFixture(fixture, runFixture(fixture));
    });
  }
});
