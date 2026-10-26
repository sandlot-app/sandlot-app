import type { PlayerRef, TeamSide } from '@sandlot/engine';
import type { Mention, RosterEntry } from './types.ts';

const words = (name: string) => name.toLowerCase().replace(/[^a-z ]/g, ' ').split(/\s+/).filter(Boolean);
const lastName = (name: string) => words(name).at(-1) ?? '';

export const samePlayer = (a: PlayerRef, b: PlayerRef) => a.kind === b.kind && a.id === b.id;

export function entryFor(roster: RosterEntry[], player: PlayerRef): RosterEntry | undefined {
  return roster.find((entry) => samePlayer(entry.player, player));
}

export function nameOf(roster: RosterEntry[], player: PlayerRef): string {
  const entry = entryFor(roster, player);
  return entry ? entry.name : 'the runner';
}

/** Everyone on the roster the mention could mean. Numbers are matched within `side`, since both teams reuse numbers. */
export function matches(roster: RosterEntry[], who: Mention, side: TeamSide): RosterEntry[] {
  if (who.number) return roster.filter((entry) => entry.side === side && entry.number === who.number);
  if (!who.name) return [];
  const heard = words(who.name);
  return roster.filter((entry) => {
    const known = words(entry.name);
    return lastName(entry.name) === heard.at(-1) && (heard.length === 1 || heard[0]![0] === known[0]![0]);
  });
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

/** The two closest names to what was heard, among `among` (B1). */
export function closest(among: RosterEntry[], heard: string): RosterEntry[] {
  const target = lastName(heard);
  return [...among].sort((a, b) => distance(lastName(a.name), target) - distance(lastName(b.name), target)).slice(0, 2);
}
