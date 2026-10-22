import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { apply, initialState, presets, type ApplyResult, type Command, type GameState } from '../src';

type Fixture = {
  name: string;
  cite: string;
  preset: keyof typeof presets;
  pending?: boolean;
  given?: Partial<GameState>;
  when: Command[];
  then: Partial<GameState> | { rejected: string };
};

const root = join(import.meta.dirname, '..', 'fixtures');

function load(file: string): Fixture {
  const data = parse(readFileSync(file, 'utf8')) as Fixture;
  for (const key of ['name', 'cite', 'preset', 'when', 'then'] as const) {
    if (data[key] === undefined) throw new Error(`${file}: missing "${key}"`);
  }
  if (!(data.preset in presets)) throw new Error(`${file}: unknown preset "${data.preset}"`);
  return data;
}

function run(fixture: Fixture): ApplyResult {
  const setup = { rules: presets[fixture.preset], pitcherOutsEarlierToday: {} };
  let result: ApplyResult = { ok: true, state: { ...initialState(setup), ...fixture.given } };
  for (const command of fixture.when) {
    if (!result.ok) break;
    result = apply(setup, result.state, command);
  }
  return result;
}

const files = readdirSync(root, { recursive: true, encoding: 'utf8' })
  .filter((f) => f.endsWith('.yaml'))
  .map((f) => join(root, f));

describe('fixtures', () => {
  it('finds at least one fixture', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  for (const file of files) {
    const fixture = load(file);
    const test = fixture.pending ? it.fails : it;
    test(`${relative(root, file)}: ${fixture.name}`, () => {
      const result = run(fixture);
      if ('rejected' in fixture.then) {
        expect(result).toEqual({ ok: false, code: fixture.then.rejected });
      } else {
        expect(result.ok).toBe(true);
        if (result.ok) expect(result.state).toMatchObject(fixture.then);
      }
    });
  }
});
