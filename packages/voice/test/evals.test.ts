import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Decision } from '../src/types.ts';
import { press, said } from './game.ts';

type Case = { id: string; said: string[]; transcript: string; expect: { kind: Decision['kind']; readBack?: string; prompt?: string; message?: string } };

const cases: Case[] = readFileSync(new URL('../evals/demo.jsonl', import.meta.url), 'utf8')
  .split('\n').filter(Boolean).map((line) => JSON.parse(line) as Case);

function matches(decision: Decision, expected: Case['expect']): boolean {
  if (decision.kind !== expected.kind) return false;
  const shown = decision.kind === 'save' || decision.kind === 'confirm' ? decision.reading.readBack : undefined;
  if (expected.readBack !== undefined && shown !== expected.readBack) return false;
  if (expected.prompt !== undefined && (decision.kind !== 'ask' || decision.prompt !== expected.prompt)) return false;
  if (expected.message !== undefined && !('message' in decision && decision.message === expected.message)) return false;
  return true;
}

// The typed half of the voice test set. Recorded spoken plays join it once the app can capture them (plan, "Voice scoring").
describe('voice eval set', () => {
  it.each(cases.map((c) => [c.id, c] as const))('%s', (_, c) => {
    const decision = press(said(c.said), c.transcript);
    expect(decision).toMatchObject({ kind: c.expect.kind });
    expect(matches(decision, c.expect), JSON.stringify(decision)).toBe(true);
  });

  it('parses at least 95% of the set exactly right (plan target 1)', () => {
    const right = cases.filter((c) => matches(press(said(c.said), c.transcript), c.expect)).length;
    expect(right / cases.length).toBeGreaterThanOrEqual(0.95);
  });
});
