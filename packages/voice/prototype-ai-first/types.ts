// PROTOTYPE, THROWAWAY. Shared shapes.

import type { Command } from '@sandlot/engine';
import type { PressGame } from '../src/index.ts';
import type { End, Expect, Sit } from './game.ts';

/** The ideal answer in a short form (cases.jsonl). `expandIdeal` in reader-b.ts turns it into the full schema answer. */
export type Ideal = {
  result?: 'play' | 'not_a_play' | 'question' | 'unclear';
  /** Pitches before any ball in play. */
  p?: string[];
  /** The ball in play: outcome, trajectory, fielders, where the batter went, where each runner went as "from>to". */
  bip?: { o: string; t?: string; f?: string[]; b: string; r?: string[] };
  /** Runner events as "event:from>to". */
  ev?: string[];
  fix?: boolean;
};

export type Case = { id: string; kind: string; sit: Sit; transcript: string; expect: Expect; ideal: Ideal; last?: Ideal };

/** A case with its game built. `last` is the play already saved, for cases that fix it. */
export type Prepared = Case & {
  game: PressGame;
  lastPlay?: { words: string; before: string; commands: Command[] };
};

export type Did = 'saved' | 'asked' | 'no_play' | 'rejected' | 'failed';

/** What one reader did with one press. */
export type Outcome = {
  did: Did;
  /** For `saved`: where the press ended. */
  end?: End;
  /** A short plain-words account. Never holds a key; may hold sample names. */
  note: string;
  ms: number;
  calls: number;
  inTokens: number;
  cachedTokens: number;
  outTokens: number;
  /** Reader A only: it asked or carded, and the right reading was among the choices. */
  cardRight?: boolean;
};
