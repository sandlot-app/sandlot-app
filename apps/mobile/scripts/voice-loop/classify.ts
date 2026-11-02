import { readLocally } from '@sandlot/voice';

// What a transcript counts as, next to the words a clip really says (issue #86). The loop never prints a transcript, so
// this verdict is all a run leaves behind (AGENTS.md rule 5: player names stay out of logs).

/** The words a clip says, and which of them are player names. */
export type Expected = { phrase: string; names: string[] };

/**
 * - `right`: the words said are all there, in order. Chatter before or after ("Come on, ...") is fine.
 * - `name-dropped`: the other words are there, in order, but a player's name is not. A misheard name lands here too,
 *   since the phone can't use it either.
 * - `wrong`: some words came back, but neither of the above.
 * - `blank`: nothing, or only filler. The phone's own reader (`readLocally`), so it is the "Didn't catch that" case.
 */
export type Verdict = 'right' | 'name-dropped' | 'wrong' | 'blank';

const words = (text: string): string[] => text.toLowerCase().replace(/[’`]/g, "'").replace(/[^a-z0-9' ]/g, ' ').split(/\s+/).filter(Boolean);

/** Where `needle` appears whole and in a row inside `hay`. */
function contains(hay: string[], needle: string[]): boolean {
  return needle.length === 0 || hay.some((_, start) => needle.every((word, offset) => hay[start + offset] === word));
}

/** Whether `needle` appears in `hay` in order, with anything allowed between. */
function inOrder(hay: string[], needle: string[]): boolean {
  let at = 0;
  for (const word of hay) if (word === needle[at]) at += 1;
  return at === needle.length;
}

const count = (hay: string[], word: string) => hay.filter((each) => each === word).length;

export function classify(expected: Expected, transcript: string): Verdict {
  if (readLocally(transcript)?.kind === 'empty') return 'blank';
  const heard = words(transcript);
  const said = words(expected.phrase);
  if (contains(heard, said)) return 'right';
  const names = expected.names.flatMap(words);
  const nameMissing = names.some((name) => count(heard, name) < count(said, name));
  return nameMissing && inOrder(heard, said.filter((word) => !names.includes(word))) ? 'name-dropped' : 'wrong';
}
