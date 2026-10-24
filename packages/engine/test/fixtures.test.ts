import { relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkFixture, fixtureFiles, fixtureRoot, loadFixture, runFixture } from './fixture-runner.ts';

describe('fixtures', () => {
  it('finds at least one fixture', () => {
    expect(fixtureFiles.length).toBeGreaterThan(0);
  });

  for (const file of fixtureFiles) {
    const fixture = loadFixture(file);
    const test = fixture.pending ? it.fails : it;
    test(`${relative(fixtureRoot, file)}: ${fixture.name}`, () => {
      checkFixture(fixture, runFixture(fixture));
    });
  }
});
