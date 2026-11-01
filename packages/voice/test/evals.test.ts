import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { readAnswer } from '../src/answer.ts';
import { pressContext, readContext } from '../src/context.ts';
import { decide, type Decision, type Heard } from '../src/decide.ts';
import { readLocally } from '../src/local.ts';
import { nameOf } from '../src/players.ts';
import { stateAfter, batting, type PressGame } from '../src/state.ts';
import { buildGame, stateOf, withLastPlay, type Sit } from './game.ts';
import { expandShort, type Short } from './short.ts';

// The voice test set, with the model's answers replayed. Each line is one press in one situation, the answer the model
// should give for it, and what the phone must do with it. Until a key is available, `answer` is written by hand in the
// short spelling; a real model answer recorded on the Mac (`recorded`, the full JSON) is replayed instead when present.
// A press the phone reads alone (pitch calls, a lone undo, filler) has no answer, and the runner checks it never needs
// one. Every situation's context also goes through the same JSON round trip voice-parse sees.

type Expect =
  | { do: 'save'; banner: string; runs?: number; bases?: Partial<Record<'1' | '2' | '3', string>>; outs?: number; count?: string }
  | { do: 'choose'; banners: string[] }
  | { do: 'message'; message: string }
  | { do: 'undo' };

export type Case = {
  id: string;
  sit: Sit;
  /** A play saved just before this press. */
  last?: Short;
  transcript: string;
  answer?: Short | 'unusable';
  recorded?: unknown;
  expect: Expect;
  /** What the old reader expected, and why it changed. */
  was?: string;
};

const folder = new URL('../evals/', import.meta.url);
const sets = readdirSync(folder).filter((file) => file.endsWith('.jsonl')).sort().map((file) => ({
  file,
  cases: readFileSync(new URL(file, folder), 'utf8').split('\n').filter((line) => line.trim()).map((line) => JSON.parse(line) as Case),
}));

function heard(c: Case): Heard {
  const local = readLocally(c.transcript);
  if (local) return local;
  if (c.answer === undefined && c.recorded === undefined) throw new Error('This press goes to the AI, so the case needs an answer');
  if (c.answer === 'unusable') return { kind: 'unusable' };
  const answer = readAnswer(c.recorded ?? expandShort(c.answer!));
  return answer ? { kind: 'answer', answer } : { kind: 'unusable' };
}

/** What the scorer would see, in the same terms as `expect`. */
function shown(game: PressGame, decision: Decision, expected: Expect): Expect {
  switch (decision.kind) {
    case 'undo': return { do: 'undo' };
    case 'message': return { do: 'message', message: decision.message };
    case 'choose': return { do: 'choose', banners: decision.readings.map((reading) => reading.banner) };
    case 'save': {
      if (expected.do !== 'save') return { do: 'save', banner: decision.reading.banner };
      const before = stateOf(game);
      const after = stateAfter(game, decision.reading.commands)!;
      const ended = after.half !== before.half || after.inning !== before.inning || after.status === 'final';
      const bases = Object.fromEntries((['1', '2', '3'] as const).flatMap((base) => {
        const runner = after.bases[Number(base) as 1 | 2 | 3]?.player;
        return runner && !ended ? [[base, nameOf(game.roster, runner)]] : [];
      }));
      const end = {
        runs: after.score[batting(before)] - before.score[batting(before)],
        bases,
        outs: ended ? 3 : after.outs,
        count: ended ? '0-0' : `${after.count.balls}-${after.count.strikes}`,
      };
      // Only the parts of the end state the case gives are compared.
      const picked = Object.fromEntries(Object.entries(end).filter(([key]) => key in expected));
      return { do: 'save', banner: decision.reading.banner, ...picked };
    }
  }
}

for (const { file, cases } of sets) {
  describe(file, () => {
    it.each(cases.map((c) => [c.id, c] as const))('%s', (_, c) => {
      const start = buildGame(c.sit);
      const game = c.last ? withLastPlay(start, c.last) : start;
      const local = readLocally(c.transcript);
      expect(local === null, local ? 'the phone reads this press alone, so it needs no answer' : 'this press goes to the AI').toBe(c.answer !== undefined || c.recorded !== undefined);
      expect(readContext(JSON.parse(JSON.stringify(pressContext(game)))), 'voice-parse accepts the context the phone builds').not.toBeNull();
      const decision = decide({ game, transcript: c.transcript, at: 10_000 }, heard(c));
      expect(shown(game, decision, c.expect)).toEqual(c.expect);
    });
  });
}
