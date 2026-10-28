import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Decision } from '../src/types.ts';
import { press, said } from './game.ts';

type Case = { id: string; said: string[]; transcript: string; expect: { kind: Decision['kind']; readBack?: string; prompt?: string; message?: string } };

// Every `*.jsonl` in evals/ is one eval set, so a ticket can add its own file.
const folder = new URL('../evals/', import.meta.url);
const sets = readdirSync(folder).filter((file) => file.endsWith('.jsonl')).sort().map((file) => ({
  file,
  cases: readFileSync(new URL(file, folder), 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line) as Case),
}));

function matches(decision: Decision, expected: Case['expect']): boolean {
  if (decision.kind !== expected.kind) return false;
  const shown = decision.kind === 'save' || decision.kind === 'confirm' ? decision.reading.readBack : undefined;
  if (expected.readBack !== undefined && shown !== expected.readBack) return false;
  if (expected.prompt !== undefined && (decision.kind !== 'ask' || decision.prompt !== expected.prompt)) return false;
  if (expected.message !== undefined && !('message' in decision && decision.message === expected.message)) return false;
  return true;
}

it('finds the demo and "talks like a parent" eval sets', () => {
  expect(sets.map((set) => set.file)).toEqual(expect.arrayContaining(['demo.jsonl', 'parent.jsonl']));
});

// The typed half of the voice test set. Recorded spoken plays join it once the app can capture them (plan, "Voice scoring").
describe.each(sets.map((set) => [set.file, set] as const))('voice eval set %s', (_, { cases }) => {
  it.each(cases.map((c) => [c.id, c] as const))('%s', (_, c) => {
    const decision = press(said(c.said), c.transcript);
    expect(decision).toMatchObject({ kind: c.expect.kind });
    expect(matches(decision, c.expect), JSON.stringify(decision)).toBe(true);
  });

  it('parses at least 95% of the set exactly right (plan target 1)', () => {
    const right = cases.filter((c) => matches(press(said(c.said), c.transcript), c.expect)).length;
    console.info(`Voice eval set: ${right} of ${cases.length} routed exactly right (${Math.round((right / cases.length) * 1000) / 10}%, target 95%).`);
    expect(right / cases.length).toBeGreaterThanOrEqual(0.95);
  });

  it('never saves without a card when the case expects a card, a question or a message (spec target)', () => {
    const wrong = cases.filter((c) => c.expect.kind !== 'save' && press(said(c.said), c.transcript).kind === 'save');
    expect(wrong.map((c) => c.id)).toEqual([]);
  });
});
