import type { Base, Position } from '@sandlot/engine';
import type { Mention, ParseResult, Spoken, Target } from './types.ts';

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

function normalize(transcript: string): string {
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

const baseWords: Record<string, Base> = { first: 1, '1st': 1, '1': 1, second: 2, '2nd': 2, '2': 2, third: 3, '3rd': 3, '3': 3 };
const base = '(first|second|third|1st|2nd|3rd|1|2|3)';
const target = '(first|second|third|1st|2nd|3rd|1|2|3|home)';
const toTarget = (word: string): Target => word === 'home' ? 'home' : baseWords[word]!;

const fielderWords: [RegExp, Position][] = [
  [/^(?:the )?(?:left|left field|leftfield|left fielder)$/, 'LF'],
  [/^(?:the )?(?:center|centre|center field|centerfield|center fielder|middle|up the middle)$/, 'CF'],
  [/^(?:the )?(?:right|right field|rightfield|right fielder)$/, 'RF'],
  [/^(?:the )?(?:short|shortstop|short stop)$/, 'SS'],
  [/^(?:the )?(?:second|second base|second baseman|2nd)$/, '2B'],
  [/^(?:the )?(?:third|third base|third baseman|3rd)$/, '3B'],
  [/^(?:the )?(?:first|first base|first baseman|1st)$/, '1B'],
  [/^(?:the )?(?:pitcher|mound)$/, 'P'],
  [/^(?:the )?catcher$/, 'C'],
];
const notation: Position[] = ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'];

function fielder(words: string | undefined): Position | undefined {
  if (!words) return undefined;
  return fielderWords.find(([pattern]) => pattern.test(words))?.[1];
}

/** Who a clause names, from the words before its verb. */
function mention(words: string | undefined): Mention | undefined {
  const text = words?.replace(/^(?:and|then|so) /, '').trim();
  if (!text || /^(?:the )?(?:runner|batter|hitter|he|she|they|it)$/.test(text)) return undefined;
  const onBase = text.match(new RegExp(`^(?:the )?runner (?:on|at|from) ${base}$`));
  if (onBase) return { base: baseWords[onBase[1]!]! };
  const number = text.match(/^(?:number |#)?(\d{1,2})$/);
  if (number) return { number: number[1]! };
  return { name: text };
}

function withMention<T extends Spoken>(spoken: T, key: 'batter' | 'runner', words: string | undefined): T {
  const who = mention(words);
  return who ? { ...spoken, [key]: who } : spoken;
}

const pitchPhrases: [RegExp, Extract<Spoken, { kind: 'pitch' }>['result']][] = [
  [/^(?:a )?ball(?: (?:one|two|three|1|2|3))?$/, 'ball'],
  [/^(?:a )?strike(?: (?:one|two|1|2))?$/, 'strike'],
  [/^(?:called strike|strike looking|looking|called)(?: (?:one|two|1|2))?$/, 'called_strike'],
  [/^(?:swinging strike|strike swinging|swinging|swing and a miss|swing and miss|swings and misses)(?: (?:one|two|1|2))?$/, 'swinging_strike'],
  [/^(?:foul|foul ball|fouled off|fouls it off|foul back)$/, 'foul'],
  [/^foul tip$/, 'foul_tip'],
  [/^(?:.+ )?(?:hit by (?:a |the )?pitch|hbp|hit batter|plunked|gets hit)$/, 'hit_by_pitch'],
];

const hitBases: [RegExp, 1 | 2 | 3 | 4][] = [
  [/^(?:singles|singled|single|base hit|hits a single)$/, 1],
  [/^(?:doubles|doubled|double|hits a double)$/, 2],
  [/^(?:triples|tripled|triple|hits a triple)$/, 3],
  [/^(?:homers|homered|homer|home run|hits a home run|went yard|goes yard)$/, 4],
];
const hitVerb = 'singles|singled|single|base hit|hits a single|doubles|doubled|double|hits a double|triples|tripled|triple|hits a triple|homers|homered|homer|home run|hits a home run|went yard|goes yard';

const outTrajectory: [RegExp, Extract<Spoken, { kind: 'out' }>['trajectory']][] = [
  [/^(?:grounds out|ground out|grounded out|groundout)$/, 'ground'],
  [/^(?:flies out|fly out|flied out|flyout|flies)$/, 'fly'],
  [/^(?:lines out|line out|lined out|lineout)$/, 'line'],
  [/^(?:pops out|pop out|popped out|pops up|pop up|popup|popped up)$/, 'popup'],
];
const outVerb = 'grounds out|ground out|grounded out|groundout|flies out|fly out|flied out|flyout|lines out|line out|lined out|lineout|pops out|pop out|popped out|pops up|pop up|popup|popped up';

const crowd = /^(?:(?:run|go|let's go|lets go|come on|nice|nice job|good|good job|yes|yeah|wow|great|hustle|get it|throw it|all the way|keep going|stay|back)(?: |$))+$/;

/** Reads one clause, or returns null when the local grammar doesn't know it. */
function clause(text: string): Spoken | 'crowd' | null {
  if (/^(?:undo|undo that|scratch that|take that back|cancel that)$/.test(text)) return { kind: 'undo' };
  if (crowd.test(text)) return 'crowd';
  for (const [pattern, result] of pitchPhrases) if (pattern.test(text)) return { kind: 'pitch', result };
  if (/^(?:.+ )?(?:walks|walked|walk|ball four|ball 4|base on balls|takes first on balls)$/.test(text)) return { kind: 'walk' };

  let match = text.match(/^(?:(.+?) )?(?:strikes out|struck out|strikeout|strike out|k|punched out|rung up|strike three|strike 3|called third strike)(?: (looking|swinging))?$/);
  if (match) {
    const looking = /called third strike/.test(text) ? true : match[2] ? match[2] === 'looking' : undefined;
    return looking === undefined ? { kind: 'strikeout' } : { kind: 'strikeout', looking };
  }
  match = text.match(new RegExp(`^(?:(.+?) )?(${hitVerb})(?: (?:to|into|through|down the line in|in) (.+)| (up the middle))?$`));
  if (match) {
    const bases = hitBases.find(([pattern]) => pattern.test(match![2]!))![1];
    const at = fielder(match[3] ?? match[4]);
    return withMention(at ? { kind: 'hit', bases, fielder: at } : { kind: 'hit', bases }, 'batter', match[1]);
  }
  match = text.match(new RegExp(`^(?:(.+?) )?(${outVerb})(?: (?:to|at) (.+))?$`));
  if (match) {
    const trajectory = outTrajectory.find(([pattern]) => pattern.test(match![2]!))![1];
    const at = fielder(match[3]);
    if (match[3] && !at) return null;
    return withMention(at ? { kind: 'out', trajectory, fielder: at } : { kind: 'out', trajectory }, 'batter', match[1]);
  }
  match = text.match(/^(?:(.+?) )?([1-9])[ -]([1-9])$/);
  if (match) return withMention({ kind: 'out', trajectory: 'ground', fielder: notation[Number(match[2]) - 1]! }, 'batter', match[1]);
  match = text.match(/^(?:((?!(?:is |safe |reaches |reached ))(?:.+?)) )?(?:(?:is )?safe on an error|reaches on an error|reached on an error|on an error|error)(?: (?:by|on) (.+))?$/);
  if (match) {
    const at = fielder(match[2]);
    if (match[2] && !at) return null;
    return withMention(at ? { kind: 'error', fielder: at } : { kind: 'error' }, 'batter', match[1]);
  }
  match = text.match(/^e([1-9])$/);
  if (match) return { kind: 'error', fielder: notation[Number(match[1]) - 1]! };
  match = text.match(/^(?:(.+?) )?(?:is safe at first|safe at first|reaches first|reached first|reaches base|is safe|safe)(?: on (?:the|a) (?:grounder|ground ball|throw|play|fly ball) (?:to|at) (.+))?$/);
  if (match) {
    const at = fielder(match[2]);
    return withMention(at ? { kind: 'reached', fielder: at } : { kind: 'reached' }, 'batter', match[1]);
  }
  match = text.match(new RegExp(`^(?:(.+?) )?(?:caught stealing|thrown out stealing|is caught stealing|out stealing)(?: ${target})?$`));
  if (match) return withMention(match[2] ? { kind: 'caught_stealing', at: toTarget(match[2]) } : { kind: 'caught_stealing' }, 'runner', match[1]);
  match = text.match(new RegExp(`^(?:(.+?) )?(?:steals|stole|swipes|swiped|steal)(?: ${target})?$`));
  if (match) return withMention(match[2] ? { kind: 'steal', to: toTarget(match[2]) } : { kind: 'steal' }, 'runner', match[1]);
  match = text.match(new RegExp(`^(?:(.+?) )?(?:picked off|pickoff|is picked off)(?: (?:at )?${base})?$`));
  if (match) return withMention(match[2] ? { kind: 'pickoff', at: baseWords[match[2]]! } : { kind: 'pickoff' }, 'runner', match[1]);
  match = text.match(/^(wild pitch|passed ball)(?: (.+))?$/);
  if (match) {
    const event = match[1] === 'wild pitch' ? 'wild_pitch' : 'passed_ball';
    if (!match[2]) return { kind: 'advance', event };
    const moved = clause(match[2]);
    if (moved && moved !== 'crowd' && (moved.kind === 'moves' || moved.kind === 'scores')) {
      const to: Target = moved.kind === 'moves' ? moved.to : 'home';
      return moved.runner ? { kind: 'advance', event, runner: moved.runner, to } : { kind: 'advance', event, to };
    }
    return null;
  }
  match = text.match(new RegExp(`^(?:(.+?) )?(?:to|goes to|takes|advances to|moves to|moves up to|over to|on to) ${base}$`));
  if (match && match[1]) return withMention({ kind: 'moves', to: baseWords[match[2]!]! }, 'runner', match[1]);
  match = text.match(/^(?:(.+?) )?(?:scores|scored|comes home|comes in|crosses|crosses the plate|run scores|scoring)$/);
  if (match) return withMention({ kind: 'scores' }, 'runner', match[1]);
  return null;
}

const correction = /^(?:no|nope|wait|no wait|sorry|actually|i mean|make that|scratch that)(?: (.+))?$/;

/** The local grammar: common phrases become plays with no AI. Anything it doesn't know is `unclear`, for the parser model. */
export function parsePhrase(transcript: string): ParseResult {
  const raw = transcript.trim();
  const text = normalize(raw);
  if (/\?\s*$/.test(raw) || /^(?:who|what|where|when|why|how|which|is|are|was|did|does|do|can)\b/.test(text)) {
    return { kind: 'not_a_command', question: true };
  }
  const plays: Spoken[] = [];
  const parts: string[] = [];
  let replace = false;
  let heard = false;
  for (const part of text.split(/[,;.]| and then | then /).map((piece) => piece.trim()).filter(Boolean)) {
    const fix = part.match(correction);
    if (fix && (plays.length || fix[1])) {
      if (!fix[1]) { replace = true; continue; }
      const corrected = clause(fix[1].replace(/^(?:a|an|it'?s a|that'?s a|it was a) /, ''));
      if (!corrected || corrected === 'crowd') return { kind: 'unclear' };
      if (plays.length) { plays.pop(); parts.pop(); }
      plays.push(corrected);
      parts.push(fix[1]);
      replace = false;
      heard = true;
      continue;
    }
    const read = clause(part.replace(/^(?:a|an) (?=(?:single|double|triple|home run|homer|walk)\b)/, ''));
    if (read === null) return { kind: 'unclear' };
    if (read === 'crowd') continue;
    if (replace && plays.length) { plays.pop(); parts.pop(); }
    replace = false;
    plays.push(read);
    parts.push(part);
    heard = true;
  }
  return heard ? { kind: 'plays', plays, parts } : { kind: 'not_a_command', question: false };
}
