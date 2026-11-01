import type { Base, GameState, PlayerRef, Position } from '@sandlot/engine';
import type { AnswerReading, Named } from './answer.ts';
import type { Mapped } from './commands.ts';
import { normalize } from './local.ts';
import { entryFor, fits, namedPlayer, nearly, samePlayer, words } from './players.ts';
import { batterUp, batting, fielding, type PressGame, type RosterEntry } from './state.ts';

// Who holds each role a reading names, and whether the scorer's words fit them. The AI reports the words; the phone
// decides whether they fit (#78: the AI never decides roles), so a name in the wrong role never saves as another player.

export type Role =
  | { kind: 'batter' }
  /** The batter of an earlier at-bat the same press ended, counting from 0. */
  | { kind: 'earlier_batter'; index: number }
  | { kind: 'pitcher' }
  /** A runner, on `base` before the press, or after the ball in play when `after` is set. */
  | { kind: 'runner'; base: Base; after?: true }
  | { kind: 'fielder'; position: Position };

export type NameRefusal =
  /** The words don't fit the player in that role. `other` is the player they do name, when exactly one. */
  | { kind: 'wrong_role'; role: Role; holder: RosterEntry; other: RosterEntry | null }
  /** Nobody holds the role the words were given to, such as a rover in a nine-fielder game. */
  | { kind: 'nobody'; role: Role }
  /** The words name a player, or a jersey number, that the answer gave no role, so it may have answered by role alone. */
  | { kind: 'unaccounted' };

type Slot = { role: Role; heard: Named };
const runner = (base: string, after?: true): Role => ({ kind: 'runner', base: Number(base) as Base, ...(after ? { after } : {}) });
const fielders = (list: (Named & { position: Position })[]): Slot[] => list.map((fielder) => ({ role: { kind: 'fielder', position: fielder.position }, heard: fielder }));

/** Every place the reading names a player, in the order they're checked. Slots with no name or number are the role itself. */
function namedSlots(reading: AnswerReading): Slot[] {
  const slots: Slot[] = [
    { role: { kind: 'pitcher' }, heard: reading.pitcher },
    ...reading.runner_events.flatMap((event) => [{ role: runner(event.from), heard: event }, ...fielders(event.fielders)]),
    ...(reading.ball_in_play?.runners ?? []).map((move) => ({ role: runner(move.from), heard: move })),
    ...reading.forced_runners.map((move) => ({ role: runner(move.from), heard: move })),
    ...fielders(reading.ball_in_play?.fielders ?? []),
    ...reading.runner_events_after.flatMap((event) => [{ role: runner(event.from, true), heard: event }, ...fielders(event.fielders)]),
    ...reading.earlier_batters.map((heard, index) => ({ role: { kind: 'earlier_batter', index } as Role, heard })),
    { role: { kind: 'batter' }, heard: reading.batter },
  ];
  return slots.filter(({ heard }) => heard.name !== null || heard.number !== null);
}

/** Who holds a role: the batters as the press found them, everyone else as they stood before the press. */
function holderOf(game: PressGame, before: GameState, mapped: Extract<Mapped, { ok: true }>, role: Role): RosterEntry | null {
  let player: PlayerRef | undefined;
  switch (role.kind) {
    case 'batter': player = batterUp(mapped.atBat); break;
    case 'earlier_batter': player = mapped.earlier[role.index]; break;
    case 'pitcher': player = before.pitchers[fielding(before)]; break;
    case 'runner': player = (role.after ? mapped.afterPlay : before)?.bases[role.base]?.player; break;
    case 'fielder': player = before.lineups[fielding(before)].find((slot) => slot.position === role.position)?.player; break;
  }
  return player ? entryFor(game.roster, player) ?? null : null;
}

/** Words that are also things on the field or everyday talk, so they don't count as a near spelling of a name. */
const plainWords = new Set(['ball', 'strike', 'foul', 'out', 'home', 'first', 'second', 'third', 'short', 'left', 'right',
  'center', 'field', 'run', 'runs', 'hit', 'hits', 'base', 'safe', 'fly', 'pop', 'line', 'walk', 'steal', 'play', 'double',
  'triple', 'single', 'most', 'past', 'part', 'with', 'what', 'that', 'then', 'they', 'this', 'there', 'nice', 'great', 'good',
  'come', 'gone', 'here', 'yeah', 'okay', 'well', 'whoa', 'wait', 'sorry', 'over', 'back', 'down', 'deep', 'hard', 'fast',
  'kind', 'full', 'wild', 'sharp', 'long', 'called', 'solo', 'both']);

/**
 * A capitalized word spelled like a surname with up to two more or fewer letters at the end, sharing at least four
 * ("Parker" for "Park"). Stricter than the name policy's near match, because here any word in the press could match.
 */
function startsLike(word: string, surname: string): boolean {
  const [short, long] = word.length <= surname.length ? [word, surname] : [surname, word];
  return short.length >= 4 && long.length - short.length <= 2 && long.startsWith(short);
}

/**
 * Whether the words name a player, or a jersey number, that no slot accounts for. Answering by role loses which name
 * was said, so this doesn't trust the slots. Speech-to-text capitalizes names, so when the words have capitals, every
 * capitalized word that is a roster name, or spelled nearly like a surname ("Parker"), must show up in some slot or
 * among the names the scorer took back; "off the wall" stays a wall. A "number 8" must show up too.
 */
function unaccounted(game: PressGame, reading: AnswerReading, slots: Slot[], transcript: string): boolean {
  // A name counts as taken back only when the words take it back: "not Cole", or "Cole, no, I mean Shah", where a
  // correction follows it and then a name the answer gave a role. Otherwise it could hide a name the answer misplaced.
  const said = normalize(transcript).replace(/['’-]/g, '');
  const slotWords = new Set(slots.flatMap(({ heard }) => heard.name ? words(heard.name) : []));
  const takenBack = reading.taken_back.filter((heard) => heard.name !== null && words(heard.name).every((word) => {
    if (new RegExp(`\\bnot ${word}\\b`).test(said)) return true;
    // The word right after the correction ("no, I mean Shah") must be a name the answer placed: "no throw" isn't one.
    const next = said.match(new RegExp(`\\b${word}\\b[^.]{0,30}?\\b(?:no|nope|sorry|wait|actually|make that|scratch that|i mean)\\b[, ]*(?:i mean[, ]*)?(\\p{L}+)`, 'u'))?.[1];
    return next !== undefined && slotWords.has(next);
  }));
  const reported = [...slots.map(({ heard }) => heard), ...takenBack];
  const reportedWords = new Set(reported.flatMap((heard) => heard.name ? words(heard.name) : []));
  const reportedNumbers = new Set(reported.flatMap((heard) => heard.number ? [heard.number] : []));
  const cased = /\p{Lu}/u.test(transcript);
  // With capitals, only capitalized words can be names. A word that starts a sentence is capitalized anyway, so there
  // only an exact name counts, or a close spelling that isn't an everyday word ("Kind of a bloop", "Come on").
  const candidates = cased
    ? [...transcript.matchAll(/\p{Lu}[\p{L}'’-]*/gu)].map((match) => ({ word: words(match[0]).join(''), initial: /(?:^|[.!?…])\W*$/u.test(transcript.slice(0, match.index)) }))
    : transcript.split(/[^\p{L}'’-]+/u).flatMap(words).map((word) => ({ word, initial: true }));
  const nameWords = (entry: RosterEntry) => words(entry.name).filter((word, index, all) => index === all.length - 1 || word.length > 1);
  const names = candidates.some(({ word, initial }) => word && !reportedWords.has(word) && game.roster.some((entry) => {
    const surname = nameWords(entry).at(-1)!;
    if (initial) return nameWords(entry).includes(word) || (cased && !plainWords.has(word) && startsLike(word, surname));
    return nameWords(entry).includes(word) || startsLike(word, surname) || (!plainWords.has(word) && nearly(word, entry));
  }));
  const numbers = [...normalize(transcript).matchAll(/(?:\bnumber|#|\bno\.?) ?(\d{1,2})\b/g)].map((match) => match[1]!);
  return names || numbers.some((number) => !reportedNumbers.has(number));
}

/**
 * The first named slot whose words don't fit the player in that role, or a player or number in the words that the
 * answer gave no role. Null when every name fits.
 */
export function checkNames(game: PressGame, before: GameState, mapped: Extract<Mapped, { ok: true }>, reading: AnswerReading, transcript: string): NameRefusal | null {
  const slots = namedSlots(reading);
  for (const { role, heard } of slots) {
    const holder = holderOf(game, before, mapped, role);
    if (!holder) return { kind: 'nobody', role };
    if (fits(game.roster, holder, heard)) continue;
    // Who the words do name, looking first on the role's own team, since both teams reuse jersey numbers.
    const side = role.kind === 'pitcher' || role.kind === 'fielder' ? fielding(before) : batting(before);
    const others = game.roster.filter((entry) => !samePlayer(entry.player, holder.player));
    const other = namedPlayer(others.filter((entry) => entry.side === side), heard)
      ?? (heard.name !== null ? namedPlayer(others, heard) : null);
    return { kind: 'wrong_role', role, holder, other };
  }
  return unaccounted(game, reading, slots, transcript) ? { kind: 'unaccounted' } : null;
}
