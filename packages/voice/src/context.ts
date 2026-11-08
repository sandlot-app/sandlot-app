import type { Event, Half, PlayerRef, Position } from '@sandlot/engine';
import { positions } from './answer.ts';
import { readBack } from './explain.ts';
import { entryFor } from './players.ts';
import { batterUp, batting, fielding, stateAfter, type PressGame } from './state.ts';

// The whole game as the AI sees it, owned in one place: the phone builds it (pressContext), voice-parse reads it
// (readContext) and renders it into the model's input (contextText). Display names and jersey numbers labeled by
// role, the situation, and the last play in words (ADR 0007). No player IDs leave the phone: it maps the answer back
// to players by role and base on its own copy of the game.

/** A player as the AI sees one: the display name and jersey number the scorer sees. */
export type Person = { name: string; number: string };

export type PressContext = {
  inning: number;
  half: Half;
  outs: 0 | 1 | 2;
  balls: number;
  strikes: number;
  score: { batting: number; fielding: number };
  batter: Person;
  pitcher: Person | null;
  runners: Partial<Record<'1' | '2' | '3', Person>>;
  /** The batting team in batting order, with fielding positions where they have one. */
  battingOrder: { player: Person; position: Position | null }[];
  /** The fielding team by position. */
  fielders: { player: Person; position: Position }[];
  /** The latest play that stands, in the banner's words. The AI needs it to tell a fix from a new play. */
  lastPlay: string | null;
};

const unknownPlayer: Person = { name: 'Unknown player', number: '' };

/**
 * One word of a name, the one rule both sides use: initials with their dots ("A.J."), or letters, digits and '’-
 * with at most one dot at the end ("Jr.", "O'Neil"). It must hold a letter or digit.
 */
export const isNameWord = (word: string) =>
  /[\p{L}\p{N}]/u.test(word) && (/^(?:\p{L}\.)+$/u.test(word) || /^[\p{L}\p{N}'’-]+\.?$/u.test(word));

/**
 * A display name in the shape voice-parse accepts: up to four words of letters, digits and .'’-, at most 40
 * characters. Anything else is dropped, so a name like "Player #7" goes as "Player 7" rather than failing the press.
 */
function cleanName(name: string): string {
  // "A.J" gets its last dot. Any other dot that isn't the end of a word becomes a space ("O.'Neil" is "O 'Neil"), so
  // the name still reads as the same words as the roster's and a name the AI echoes back still matches it.
  const spaced = name.replace(/[^\p{L}\p{N} .'’-]/gu, ' ').replace(/\.(?=\p{L}{2})/gu, '. ').split(/\s+/)
    .flatMap((raw) => /^(?:\p{L}\.)+\p{L}$/u.test(raw) ? [`${raw}.`] : isNameWord(raw) ? [raw] : raw.split('.'));
  const kept = spaced.filter(isNameWord);
  // Past four words or 40 characters, words go from the middle, so the first name and the surname survive.
  while (kept.length > 2 && (kept.length > 4 || kept.join(' ').length > 40)) kept.splice(1, 1);
  if (kept.join(' ').length > 40) kept.splice(0, kept.length - 1);
  return kept.join(' ').length <= 40 && kept.length ? kept.join(' ') : unknownPlayer.name;
}
const cleanNumber = (number: string) => /^\d{1,3}$/.test(number) ? number : '';

/** Keeps the end of a long last play, a whole part at a time, so it fits what voice-parse accepts. */
function fitted(words: string): string | null {
  const parts = words.split(' · ');
  while (parts.length > 1 && parts.join(' · ').length > 300) parts.shift();
  const text = parts.join(' · ');
  return text && text.length <= 300 ? text : null;
}

/** The groups that stand, oldest first: an undo takes back the latest one standing. Setup and lineups aren't plays. */
export function standingPlays(events: Event[]): Event[][] {
  const groups: Event[][] = [];
  for (const event of events) {
    const last = groups.at(-1);
    if (last && last[0]!.group === event.group) last.push(event);
    else groups.push([event]);
  }
  const standing: Event[][] = [];
  for (const group of groups) {
    if (group[0]!.command.kind === 'undo') standing.pop();
    else standing.push(group);
  }
  return standing.filter((group) => group.every((event) => event.command.kind !== 'game'));
}

/** PHONE. The context for one press, from the same game decide() will check the answer against. */
export function pressContext(game: PressGame): PressContext {
  const state = stateAfter(game, []);
  if (!state) throw new Error("The game doesn't replay");
  // The AI sees display names as voice-parse accepts them, and the last play is told with the same names.
  const roster = game.roster.map((entry) => ({ ...entry, name: cleanName(entry.name), number: cleanNumber(entry.number) }));
  const person = (player: PlayerRef | undefined): Person => {
    const entry = player && entryFor(roster, player);
    return entry ? { name: entry.name, number: entry.number } : unknownPlayer;
  };
  const runners: PressContext['runners'] = {};
  for (const base of [1, 2, 3] as const) {
    const runner = state.bases[base]?.player;
    if (runner) runners[String(base) as '1' | '2' | '3'] = person(runner);
  }
  const last = standingPlays(game.events).at(-1);
  let lastPlay: string | null = null;
  if (last) {
    const before = { ...game, roster, events: game.events.slice(0, game.events.indexOf(last[0]!)) };
    lastPlay = fitted(readBack(before, last.map((event) => event.command)));
  }
  const pitcher = state.pitchers[fielding(state)];
  return {
    inning: state.inning,
    half: state.half,
    outs: state.outs,
    balls: state.count.balls,
    strikes: state.count.strikes,
    score: { batting: state.score[batting(state)], fielding: state.score[fielding(state)] },
    batter: person(batterUp(state)),
    pitcher: pitcher ? person(pitcher) : null,
    runners,
    battingOrder: state.lineups[batting(state)].map((slot) => ({ player: person(slot.player), position: slot.position })),
    fielders: state.lineups[fielding(state)].flatMap((slot) => slot.position ? [{ player: person(slot.player), position: slot.position }] : []),
    lastPlay,
  };
}

type Raw = Record<string, unknown>;
const isObject = (value: unknown): value is Raw => typeof value === 'object' && value !== null && !Array.isArray(value);
const whole = (value: unknown, min: number, max: number): value is number => Number.isInteger(value) && (value as number) >= min && (value as number) <= max;

/**
 * A name is up to four words of letters, digits and .'’- ("A.J." counts as one), at most 40 characters, with no line breaks or other
 * symbols. That keeps a name looking like a name, so it can carry little more than a name into the prompt.
 */
function readPerson(raw: unknown): Person | null {
  if (!isObject(raw) || typeof raw.name !== 'string' || typeof raw.number !== 'string') return null;
  const words = raw.name.split(' ');
  if (!raw.name.trim() || raw.name.length > 40 || words.length > 4 || !words.every(isNameWord)) return null;
  if (!/^\d{0,3}$/.test(raw.number)) return null;
  return { name: raw.name, number: raw.number };
}

function readPlayers<T>(raw: unknown, max: number, read: (item: Raw, player: Person) => T | null): T[] | null {
  if (!Array.isArray(raw) || raw.length > max) return null;
  const items = raw.map((item) => {
    const player = isObject(item) ? readPerson(item.player) : null;
    return player && isObject(item) ? read(item, player) : null;
  });
  return items.some((item) => item === null) ? null : items as T[];
}

/**
 * SERVER. The context from the request body, rebuilt field by field, or null (400 invalid) when anything is off.
 * The last play's words come from the phone's banner, so they're held to the banner's alphabet and length.
 */
export function readContext(raw: unknown): PressContext | null {
  if (!isObject(raw) || !isObject(raw.score) || !isObject(raw.runners)) return null;
  const { inning, half, outs, balls, strikes, score, runners: rawRunners, lastPlay } = raw;
  if (!whole(inning, 1, 30) || (half !== 'top' && half !== 'bottom') || !whole(outs, 0, 2) || !whole(balls, 0, 3) || !whole(strikes, 0, 2)) return null;
  if (!whole(score.batting, 0, 99) || !whole(score.fielding, 0, 99)) return null;
  if (lastPlay !== null && (typeof lastPlay !== 'string' || lastPlay.length > 300 || !/^[\p{L}\p{N} .,'’:·→–-]*$/u.test(lastPlay))) return null;
  const batter = readPerson(raw.batter);
  const pitcher = raw.pitcher === null ? null : readPerson(raw.pitcher);
  if (!batter || (raw.pitcher !== null && !pitcher)) return null;
  const runners: PressContext['runners'] = {};
  for (const [base, value] of Object.entries(rawRunners)) {
    const runner = readPerson(value);
    if ((base !== '1' && base !== '2' && base !== '3') || !runner) return null;
    runners[base] = runner;
  }
  const battingOrder = readPlayers(raw.battingOrder, 20, (item, player) =>
    item.position === null || (positions as readonly unknown[]).includes(item.position) ? { player, position: item.position as Position | null } : null);
  const fielders = readPlayers(raw.fielders, 10, (item, player) =>
    (positions as readonly unknown[]).includes(item.position) ? { player, position: item.position as Position } : null);
  if (!battingOrder || !fielders || new Set(fielders.map((fielder) => fielder.position)).size !== fielders.length) return null;
  return {
    inning, half, outs: outs as PressContext['outs'], balls, strikes, score: { batting: score.batting, fielding: score.fielding },
    batter, pitcher, runners, battingOrder, fielders, lastPlay: lastPlay as string | null,
  };
}

const ordinal = (n: number) => n === 1 ? '1st' : n === 2 ? '2nd' : n === 3 ? '3rd' : `${n}th`;
const label = (person: Person) => person.number ? `${person.name} #${person.number}` : person.name;

/** SERVER. The model's input: the game before the press, then the words. Everything that changes per press is here. */
export function contextText(context: PressContext, transcript: string): string {
  const runners = (['1', '2', '3'] as const).map((base) => `${ordinal(Number(base))}: ${context.runners[base] ? label(context.runners[base]) : 'empty'}`);
  return [
    'GAME STATE (before this press)',
    `Inning: ${context.half} of the ${ordinal(context.inning)}. Outs: ${context.outs}. Count: ${context.balls} balls, ${context.strikes} strikes.`,
    `Score: batting team ${context.score.batting}, fielding team ${context.score.fielding}.`,
    `Batter due up: ${label(context.batter)}.`,
    `Pitcher: ${context.pitcher ? label(context.pitcher) : 'unknown'}.`,
    `Runners: ${runners.join('; ')}.`,
    `Fielders by position: ${context.fielders.map((fielder) => `${fielder.position} ${label(fielder.player)}`).join('; ') || 'unknown'}.`,
    `Batting order: ${context.battingOrder.map((slot, index) => `${index + 1}. ${label(slot.player)}${slot.position ? ` (${slot.position})` : ''}`).join('; ') || 'unknown'}.`,
    `Last saved play: ${context.lastPlay ?? 'none yet'}.`,
    '',
    'TRANSCRIPT',
    JSON.stringify(transcript),
  ].join('\n');
}
