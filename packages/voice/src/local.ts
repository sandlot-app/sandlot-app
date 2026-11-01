import type { Answer, AnswerReading } from './answer.ts';

// The phone's own reader, cut down to what ADR 0007 leaves it: a press made of nothing but pitch calls, a lone
// "undo" or "scratch that", and filler. These stay instant and cost no AI call. Anything else returns null and goes to
// the AI with the whole game in view. A pitch press comes back as an ordinary Answer, so it takes the same path through
// decide() and the engine as the AI's answer.

const units = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve',
  'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const tens: Record<string, number> = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };

/** Spoken jersey numbers become digits: "number twenty one" reads as "number 21". */
function numbersAsDigits(text: string): string {
  const unit = units.join('|');
  const ten = Object.keys(tens).join('|');
  return text
    .replace(new RegExp(`\\b(${ten})[ -](${unit})\\b`, 'g'), (_, t: string, u: string) => String(tens[t]! + units.indexOf(u)))
    .replace(new RegExp(`\\b(number|#) (${ten}|${unit})\\b`, 'g'), (_, n: string, w: string) => `${n} ${tens[w] ?? units.indexOf(w)}`);
}

/** Lower case, digits for jersey numbers, no filler words or stray symbols. */
export function normalize(transcript: string): string {
  return numbersAsDigits(transcript.toLowerCase().replace(/[’`]/g, "'"))
    .replace(/[^a-z0-9#,;.' -]/g, ' ')
    .replace(/\b(um+|uh+|er+|hmm+|okay|ok)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** True when nothing but filler was said (A6). */
export function isEmptyTranscript(transcript: string): boolean {
  return normalize(transcript).replace(/[,;. ]/g, '') === '';
}

type Pitch = AnswerReading['pitches'][number];
/** A bare "strike", or a bare "swinging" or "looking" that says which kind a strike next to it was. */
type Word = Pitch | 'strike' | 'swinging' | 'looking';

const count = '(?: (?:one|two|three|1|2|3))?';
const pitchPhrases: [RegExp, Word][] = ([
  [`(?:a )?ball${count}`, 'ball'],
  [`(?:a )?strike${count}`, 'strike'],
  [`(?:a )?(?:called strike|strike looking)${count}`, 'called_strike'],
  [`(?:a )?(?:swinging strike|strike swinging)${count}`, 'swinging_strike'],
  [`(?:looking|called)${count}`, 'looking'],
  [`(?:swing and a miss|swings and misses|swing and miss|swinging)${count}`, 'swinging'],
  ['(?:a )?(?:fouled it off|fouls it off|fouled off|foul ball|foul back|foul)', 'foul'],
  ['(?:a )?foul tip', 'foul_tip'],
] as const).map(([source, word]) => [new RegExp(`^${source}(?= |$)`), word]); // longest wording first in each

/** The pitch calls in one part of a press, longest phrase first, with "and" or "then" between them; null if anything else is said. */
function pitchesIn(part: string): Word[] | null {
  const found: Word[] = [];
  let rest = part;
  while (rest) {
    const matches = pitchPhrases.flatMap(([pattern, word]) => {
      const match = rest.match(pattern);
      return match ? [{ word, length: match[0].length }] : [];
    });
    if (!matches.length) return null;
    const longest = matches.reduce((best, match) => match.length > best.length ? match : best);
    found.push(longest.word);
    rest = rest.slice(longest.length).trim().replace(/^(?:and (?:a |an )?|then )/, '');
  }
  return found;
}

/** "Strike two, swinging" and "swing and a miss, strike two" are one pitch: the word next to a bare strike says which kind. */
function joinStrikes(words: Word[]): (Pitch | 'strike')[] | null {
  const pitches: (Pitch | 'strike')[] = [];
  for (let index = 0; index < words.length; index += 1) {
    const word = words[index]!;
    const next = words[index + 1];
    const kind = (qualifier: Word | undefined) => qualifier === 'swinging' ? 'swinging_strike' : qualifier === 'looking' ? 'called_strike' : null;
    if (word === 'strike' && kind(next)) { pitches.push(kind(next)!); index += 1; }
    else if (kind(word) && next === 'strike') { pitches.push(kind(word)!); index += 1; }
    else if (kind(word)) pitches.push(kind(word)!);
    else pitches.push(word as Pitch | 'strike');
  }
  return pitches;
}

const undoPhrase = /^(?:undo|undo that|scratch that|take that back|cancel that)$/;
const crowd = /^(?:(?:run|go|let's go|lets go|come on|nice|nice job|good|good job|yes|yeah|wow|great|hustle|get it|throw it|all the way|keep going|stay|back)(?: |$))+$/;

export type Local = { kind: 'empty' } | { kind: 'undo' } | { kind: 'answer'; answer: Answer };

const nobody = { name: null, number: null };
const pitchesOnly = (pitches: AnswerReading['pitches']): AnswerReading =>
  ({ batter: nobody, earlier_batters: [], pitcher: nobody, pitches, ball_in_play: null, runner_events: [], runner_events_after: [], forced_runners: [], taken_back: [] });

/**
 * What the phone can read on its own, or null when the press needs the AI. A single bare "strike" keeps its
 * looking-or-swinging card, as a question whose two readings differ only there. Two bare strikes go to the AI.
 */
export function readLocally(transcript: string): Local | null {
  if (isEmptyTranscript(transcript)) return { kind: 'empty' };
  // A question ("Ball?") isn't a call. The AI says it isn't a play.
  if (/\?\s*$/.test(transcript.trim())) return null;
  const parts = normalize(transcript).split(/[,;.]| and then | then /).map((part) => part.trim()).filter((part) => part && !crowd.test(part));
  if (parts.length === 1 && undoPhrase.test(parts[0]!)) return { kind: 'undo' };
  const words: Word[] = [];
  for (const part of parts) {
    const read = pitchesIn(part);
    if (!read) return null;
    words.push(...read);
  }
  const pitches = joinStrikes(words);
  if (!pitches?.length) return null;
  const strikes = pitches.filter((pitch) => pitch === 'strike').length;
  if (strikes > 1) return null;
  const withStrike = (strike: Pitch) => pitchesOnly(pitches.map((pitch) => pitch === 'strike' ? strike : pitch));
  if (!strikes) return { kind: 'answer', answer: { result: 'play', fix_last: false, readings: [withStrike('called_strike')] } };
  return { kind: 'answer', answer: { result: 'question', fix_last: false, readings: [withStrike('called_strike'), withStrike('swinging_strike')] } };
}
