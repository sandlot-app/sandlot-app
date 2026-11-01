import type { PlayerRef } from '@sandlot/engine';
import type { Named } from './answer.ts';
import type { RosterEntry } from './state.ts';

/** A name's words, lower case, letters only, with any "'s" dropped: "D. Park's" is ["d", "park"]. */
export const words = (name: string) => name.toLowerCase().replace(/['’]s\b/g, '').replace(/[^\p{L} ]/gu, ' ').split(/\s+/).filter(Boolean);

export const samePlayer = (a: PlayerRef, b: PlayerRef) => a.kind === b.kind && a.id === b.id;

export function entryFor(roster: RosterEntry[], player: PlayerRef): RosterEntry | undefined {
  return roster.find((entry) => samePlayer(entry.player, player));
}

export function nameOf(roster: RosterEntry[], player: PlayerRef): string {
  const entry = entryFor(roster, player);
  return entry ? entry.name : 'the runner';
}

function distance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i++) {
    let previous = row[0]!;
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const current = row[j]!;
      row[j] = Math.min(row[j]! + 1, row[j - 1]! + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1));
      previous = current;
    }
  }
  return row[b.length]!;
}

/**
 * The words exactly name the player: the last word is their surname, and a first initial said with it matches.
 * A one-word first name matches too, when the roster has the whole first name ("Danny" for "Danny Park").
 */
export function exactly(heard: string, entry: RosterEntry): boolean {
  const said = words(heard);
  const known = words(entry.name);
  if (!said.length || !known.length) return false;
  if (said.at(-1) === known.at(-1)) return said.length === 1 || said[0]![0] === known[0]![0];
  return said.length === 1 && known.length > 1 && known[0]!.length > 1 && said[0] === known[0];
}

/**
 * The words nearly name the player, as speech-to-text often spells a name: one surname starts with the other, sharing
 * at least 3 letters and at most 2 more ("Parker" for "Park"), or they are one letter apart and both have at least 4
 * ("Ruis"). A first initial said with it must still match.
 */
function nearly(heard: string, entry: RosterEntry): boolean {
  const said = words(heard);
  const known = words(entry.name);
  if (said.length > 1 && said[0]![0] !== known[0]?.[0]) return false;
  const [a, b] = [said.at(-1) ?? '', known.at(-1) ?? ''];
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  return (short.length >= 3 && long.length - short.length <= 2 && long.startsWith(short)) || (short.length >= 4 && distance(a, b) === 1);
}

/**
 * THE NAME POLICY. Whether the words the scorer used for a role can mean the player who holds it.
 * - A number fits only the holder's own jersey number.
 * - An exact name fits. A teammate with the same surname doesn't stop it: the role tells two Lopezes apart.
 * - A near name fits only when the holder is the one player on either roster it equals or nearly equals. So
 *   "Parker" saves as batter D. Park when no one else is near "Parker", and the banner names D. Park, so a wrong
 *   guess shows and is one Undo away. A name near anyone else never saves.
 */
export function fits(roster: RosterEntry[], holder: RosterEntry, heard: Named): boolean {
  if (heard.number !== null && heard.number !== holder.number) return false;
  if (heard.name === null) return true;
  if (exactly(heard.name, holder)) return true;
  const name = heard.name;
  return nearly(name, holder) && roster.every((entry) => samePlayer(entry.player, holder.player) || !(exactly(name, entry) || nearly(name, entry)));
}

/** The one roster player on `among` the words exactly name, for a message like "J. Ruiz is up, not K. Moss." */
export function namedPlayer(among: RosterEntry[], heard: Named): RosterEntry | null {
  const found = among.filter((entry) => (heard.number === null || entry.number === heard.number) &&
    (heard.name === null ? heard.number !== null : exactly(heard.name, entry)));
  return found.length === 1 ? found[0]! : null;
}
