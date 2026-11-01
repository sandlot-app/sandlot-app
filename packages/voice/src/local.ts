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

type Pitch = AnswerReading['pitches'][number] | 'strike';

const pitchPhrases: [RegExp, Pitch][] = [
  [/^(?:a )?ball(?: (?:one|two|three|1|2|3))?$/, 'ball'],
  [/^(?:a )?strike(?: (?:one|two|1|2))?$/, 'strike'],
  [/^(?:called strike|strike looking|looking|called)(?: (?:one|two|1|2))?$/, 'called_strike'],
  [/^(?:swinging strike|strike swinging|swinging|swing and a miss|swing and miss|swings and misses)(?: (?:one|two|1|2))?$/, 'swinging_strike'],
  [/^(?:foul|foul ball|fouled off|fouls it off|foul back)$/, 'foul'],
  [/^foul tip$/, 'foul_tip'],
];

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
  // "Strike two, swinging" is one pitch: a looking or swinging said after a strike tells which kind it was.
  const text = normalize(transcript).replace(/\bstrike( (?:one|two|1|2))?[,;.]? (swinging|looking)\b/g, 'strike $2$1');
  const parts = text.split(/[,;.]| and then | then /).map((part) => part.trim()).filter((part) => part && !crowd.test(part));
  if (parts.length === 1 && undoPhrase.test(parts[0]!)) return { kind: 'undo' };
  const pitches = parts.map((part) => pitchPhrases.find(([pattern]) => pattern.test(part))?.[1]);
  if (!pitches.length || pitches.some((pitch) => pitch === undefined)) return null;
  const strikes = pitches.filter((pitch) => pitch === 'strike').length;
  if (strikes > 1) return null;
  const withStrike = (strike: AnswerReading['pitches'][number]) => pitchesOnly(pitches.map((pitch) => pitch === 'strike' ? strike : pitch!) as AnswerReading['pitches']);
  if (!strikes) return { kind: 'answer', answer: { result: 'play', fix_last: false, readings: [withStrike('called_strike')] } };
  return { kind: 'answer', answer: { result: 'question', fix_last: false, readings: [withStrike('called_strike'), withStrike('swinging_strike')] } };
}
