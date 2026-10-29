// PROTOTYPE, THROWAWAY. Loads cases.jsonl, builds each game, and checks a case's ideal answer against its expected end state.

import { readFileSync } from 'node:fs';
import { append, buildGame, endState, sameEnd, showEnd, showExpect, stateOf } from './game.ts';
import { expandIdeal, situationWords, toCommands } from './reader-b.ts';
import type { Case, Prepared } from './types.ts';

export const loadCases = (): Case[] => readFileSync(new URL('./cases.jsonl', import.meta.url), 'utf8')
  .split('\n').filter((line) => line.trim()).map((line) => JSON.parse(line) as Case);

export function prepare(c: Case): Prepared {
  const start = buildGame(c.sit);
  if (!c.last) return { ...c, game: start };
  const mapped = toCommands(start, expandIdeal(c.last));
  if (!mapped.ok) throw new Error(`Case ${c.id}: its last play doesn't map: ${mapped.why}`);
  const commands = mapped.groups.at(-1)!;
  return {
    ...c,
    game: append(start, 'play-last', commands),
    lastPlay: { words: mapped.words, before: situationWords(start, stateOf(start)), commands },
  };
}

/** Null when the case's ideal answer, run through the same mapping and the engine, lands on its expected end state. */
export function checkCase(p: Prepared): string | null {
  const { expect } = p;
  if (expect.do !== 'save') {
    const result = p.ideal.result ?? 'play';
    const right = expect.do === 'no_play' ? result === 'not_a_play' : result === 'question' || result === 'unclear';
    return right ? null : `ideal says "${result}" but the case expects "${expect.do}"`;
  }
  const mapped = toCommands(p.game, expandIdeal(p.ideal));
  if (!mapped.ok) return `the ideal answer doesn't map: ${mapped.why}`;
  const end = endState(p.game, mapped.before, mapped.after);
  return sameEnd(end, expect) ? null : `the ideal answer ends at [${showEnd(end)}] but the case expects [${showExpect(expect)}]`;
}
