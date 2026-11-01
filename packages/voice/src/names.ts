import type { Base, GameState, Position } from '@sandlot/engine';
import type { AnswerReading, Named } from './answer.ts';
import { entryFor, fits, namedPlayer, samePlayer, words } from './players.ts';
import { batterUp, batting, fielding, type PressGame, type RosterEntry } from './state.ts';

// Who holds each role a reading names, and whether the scorer's words fit them. The AI reports the words; the phone
// decides whether they fit (#78: the AI never decides roles), so a name in the wrong role never saves as another player.

export type Role =
  | { kind: 'batter' }
  | { kind: 'pitcher' }
  | { kind: 'runner'; base: Base }
  | { kind: 'fielder'; position: Position };

export type NameRefusal =
  /** The words don't fit the player in that role. `other` is the player they do name, when exactly one. */
  | { kind: 'wrong_role'; role: Role; holder: RosterEntry; other: RosterEntry | null }
  /** Nobody holds the role the words were given to, such as a rover in a nine-fielder game. */
  | { kind: 'nobody'; role: Role }
  /** The transcript names a player the answer gave no role, so it may have answered by role alone. */
  | { kind: 'unaccounted' };

/** Every place the reading names a player, in the order they're checked. Slots with no name or number are the role itself. */
function namedSlots(reading: AnswerReading): { role: Role; heard: Named }[] {
  const slots: { role: Role; heard: Named }[] = [
    { role: { kind: 'pitcher' }, heard: reading.pitcher },
    ...reading.runner_events.map((event) => ({ role: { kind: 'runner', base: Number(event.from) as Base } as Role, heard: event })),
    ...(reading.ball_in_play?.runners ?? []).map((move) => ({ role: { kind: 'runner', base: Number(move.from) as Base } as Role, heard: move })),
    ...reading.forced_runners.map((move) => ({ role: { kind: 'runner', base: Number(move.from) as Base } as Role, heard: move })),
    ...(reading.ball_in_play?.fielders ?? []).map((fielder) => ({ role: { kind: 'fielder', position: fielder.position } as Role, heard: fielder })),
    { role: { kind: 'batter' }, heard: reading.batter },
  ];
  return slots.filter(({ heard }) => heard.name !== null || heard.number !== null);
}

/** Who holds a role: the batter up at the ball in play, everyone else as they stood before the press. */
function holderOf(game: PressGame, before: GameState, atBat: GameState, role: Role): RosterEntry | null {
  const player = role.kind === 'batter' ? batterUp(atBat)
    : role.kind === 'pitcher' ? before.pitchers[fielding(before)]
    : role.kind === 'runner' ? before.bases[role.base]?.player
    : before.lineups[fielding(before)].find((slot) => slot.position === role.position)?.player;
  return player ? entryFor(game.roster, player) ?? null : null;
}

/** Words that are also names of things on the field, so a player called Ball or Short doesn't trip the check below. */
const scoringWords = new Set(['ball', 'strike', 'foul', 'out', 'home', 'first', 'second', 'third', 'short', 'left', 'right',
  'center', 'field', 'run', 'runs', 'hit', 'base', 'safe', 'fly', 'pop', 'line', 'walk', 'steal', 'play', 'double', 'triple', 'single']);

/**
 * The first named slot whose words don't fit the player in that role, or a batting player named in the transcript
 * that the answer gave no role. Null when every name fits.
 */
export function checkNames(game: PressGame, before: GameState, atBat: GameState, reading: AnswerReading, transcript: string): NameRefusal | null {
  const slots = namedSlots(reading);
  for (const { role, heard } of slots) {
    const holder = holderOf(game, before, atBat, role);
    if (!holder) return { kind: 'nobody', role };
    if (fits(game.roster, holder, heard)) continue;
    // Who the words do name, looking first on the role's own team, since both teams reuse jersey numbers.
    const side = role.kind === 'batter' || role.kind === 'runner' ? batting(before) : fielding(before);
    const others = game.roster.filter((entry) => !samePlayer(entry.player, holder.player));
    const other = namedPlayer(others.filter((entry) => entry.side === side), heard)
      ?? (heard.name !== null ? namedPlayer(others, heard) : null);
    return { kind: 'wrong_role', role, holder, other };
  }
  // The second witness: answering by role loses which name was said, so a batting player's surname in the words must
  // show up in a slot. Only the batting team's players can be recorded as a batter or runner; a fielder's name can't
  // save as another player, because plays name fielders by position.
  const said = new Set(words(transcript));
  const reported = new Set(slots.flatMap(({ heard }) => heard.name ? words(heard.name) : []));
  const unaccounted = game.roster.some((entry) => {
    if (entry.side !== batting(before)) return false;
    const surname = words(entry.name).at(-1);
    return surname !== undefined && surname.length >= 3 && !scoringWords.has(surname) && said.has(surname) && !reported.has(surname);
  });
  return unaccounted ? { kind: 'unaccounted' } : null;
}
