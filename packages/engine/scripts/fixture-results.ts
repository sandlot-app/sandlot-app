import { deepStrictEqual } from 'node:assert';
import { isDeepStrictEqual } from 'node:util';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ENGINE_VERSION, EVENT_SCHEMA_VERSION } from '../src/version.ts';
import type { ApplyResult } from '../src/index.ts';
import { checkFixture, fixtureFiles, fixtureRoot, loadFixture, runFixture } from '../test/fixture-runner.ts';

type FixtureResults = {
  engineVersion: string;
  eventSchemaVersion: number;
  results: Record<string, ApplyResult>;
};

const artifact = new URL('../src/fixture-results.json', import.meta.url);
const repoRoot = fileURLToPath(new URL('../../..', import.meta.url));
const artifactPath = 'packages/engine/src/fixture-results.json';
const versionPath = 'packages/engine/src/version.ts';
const preLockBase = 'fcc7ed5c50335ca50a4c7d8c552015d63410eeec';

export function collectFixtureResults(): FixtureResults {
  const results: Record<string, ApplyResult> = {};
  for (const file of fixtureFiles) {
    const fixture = loadFixture(file);
    if (fixture.pending) throw new Error(`${file}: pending fixtures cannot enter the release lock`);
    const result = runFixture(fixture);
    checkFixture(fixture, result);
    results[relative(fixtureRoot, file).replaceAll('\\', '/')] = result;
  }
  return { engineVersion: ENGINE_VERSION, eventSchemaVersion: EVENT_SCHEMA_VERSION, results };
}

function readArtifact(json: string): FixtureResults {
  const value: unknown = JSON.parse(json);
  if (value === null || typeof value !== 'object' || !('engineVersion' in value)
    || !('eventSchemaVersion' in value) || !('results' in value)
    || typeof value.engineVersion !== 'string' || !Number.isInteger(value.eventSchemaVersion)
    || value.results === null || typeof value.results !== 'object' || Array.isArray(value.results)) {
    throw new Error('Invalid fixture result artifact');
  }
  return value as FixtureResults;
}

function git(...args: string[]): string {
  return execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function pins(source: string): { engine: string; schema: number } {
  const engine = source.match(/^export const ENGINE_VERSION = ['"]([^'"]+)['"];$/m)?.[1];
  const schema = source.match(/^export const EVENT_SCHEMA_VERSION = (\d+);$/m)?.[1];
  if (!engine || !schema) throw new Error('Cannot read baseline version exports');
  return { engine, schema: Number(schema) };
}

function newerVersion(current: string, previous: string): boolean {
  const parse = (version: string) => {
    const match = version.match(/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/);
    if (!match) throw new Error(`Invalid engine version ${version}`);
    return { core: match.slice(1, 4).map(Number), pre: match[4]?.split('.') };
  };
  const next = parse(current);
  const old = parse(previous);
  for (let index = 0; index < 3; index++) {
    if (next.core[index] !== old.core[index]) return next.core[index]! > old.core[index]!;
  }
  if (!next.pre || !old.pre) return !next.pre && !!old.pre;
  for (let index = 0; index < Math.max(next.pre.length, old.pre.length); index++) {
    const a = next.pre[index];
    const b = old.pre[index];
    if (a === b) continue;
    if (a === undefined || b === undefined) return a !== undefined;
    const numericA = /^\d+$/.test(a);
    const numericB = /^\d+$/.test(b);
    if (numericA && numericB) return Number(a) > Number(b);
    if (numericA !== numericB) return !numericA;
    return a > b;
  }
  return false;
}

function checkBase(base: string, current: FixtureResults): void {
  if (!/^[a-f0-9]{40}$/.test(base) || /^0+$/.test(base)) throw new Error('A trusted full base commit SHA is required');
  if (git('rev-parse', '--verify', `${base}^{commit}`) !== base) throw new Error('Baseline must identify a commit');
  git('merge-base', '--is-ancestor', base, 'HEAD');
  const baselinePins = pins(git('show', `${base}:${versionPath}`));
  const exists = git('ls-tree', '--name-only', base, '--', artifactPath) !== '';
  if (!exists) {
    if (base !== preLockBase || baselinePins.engine !== '0.1.0-alpha.1' || baselinePins.schema !== 2
      || current.engineVersion !== '0.1.0' || current.eventSchemaVersion !== 2) {
      throw new Error('Baseline has no fixture lock and is not the approved 0.1.0 bootstrap');
    }
    return;
  }
  const previous = readArtifact(git('show', `${base}:${artifactPath}`));
  deepStrictEqual({ engine: previous.engineVersion, schema: previous.eventSchemaVersion }, baselinePins, 'Baseline artifact disagrees with its version exports');
  if (!isDeepStrictEqual(current, previous) && !newerVersion(current.engineVersion, previous.engineVersion)) {
    throw new Error('Fixture results changed without an engine-version increase relative to the trusted base');
  }
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const update = args.length === 1 && args[0] === '--update';
  const base = args.length === 2 && args[0] === '--base' ? args[1] : undefined;
  if (args.length && !update && !base) throw new Error('Usage: fixture-results.ts [--update | --base <trusted SHA>]');
  const actual = collectFixtureResults();
  if (update) {
    const entries = Object.entries(actual.results).map(([path, result]) => `    ${JSON.stringify(path)}: ${JSON.stringify(result)}`);
    writeFileSync(artifact, `{\n  "engineVersion": ${JSON.stringify(actual.engineVersion)},\n  "eventSchemaVersion": ${actual.eventSchemaVersion},\n  "results": {\n${entries.join(',\n')}\n  }\n}\n`);
    console.log(`Recorded ${entries.length} fixture results for engine ${ENGINE_VERSION}`);
  } else {
    deepStrictEqual(readArtifact(readFileSync(artifact, 'utf8')), actual, 'Fixture result lock is stale. Review changes, bump the engine version, and run fixtures:update');
    if (base) checkBase(base, actual);
    console.log(`Verified ${fixtureFiles.length} fixture results for engine ${ENGINE_VERSION}${base ? ` against ${base}` : ''}`);
  }
}
