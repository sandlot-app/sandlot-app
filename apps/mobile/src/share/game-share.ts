import { battingLines } from '@sandlot/engine';
import type { BattingLine, Event, GameSetup, GameState, PlayerRef, Position, TeamSide } from '@sandlot/engine';
import { appearances, type Appearance } from '../scoring/play-log.ts';

// What a stat sticker or stat card shows for one child's game (GLOSSARY: Stat card; Figma section 221:13593).
// It reads the saved events and never changes them. Names come in from presentation and never go back into events.

export type StatLabel = 'AB' | 'H' | '2B' | '3B' | 'HR' | 'BB';
export type StatCell = { label: StatLabel; value: number };
export type GameShare = {
  team: string;
  number: string;
  first: string;
  last: string;
  /** The child's position in words, such as SHORTSTOP, or null when they had none. */
  position: string | null;
  /** SAT, OCT 24 */
  date: string;
  division: string;
  /** FALL 2026 */
  season: string;
  stats: StatCell[];
  /** 2 FOR 3 · DOUBLE · WALK */
  gameLine: string;
  /** Doubled to center in the 3rd. Null when the child had no hit, walk or hit by pitch. */
  bestPlay: string | null;
};

/** AB and H always, then up to two of 2B, 3B, HR and BB above zero, in that order. Strikeouts never show. */
export function statCells(line: BattingLine): StatCell[] {
  const extras: StatCell[] = ([['2B', line.doubles], ['3B', line.triples], ['HR', line.homeRuns], ['BB', line.walks]] as const)
    .filter(([, value]) => value > 0).slice(0, 2).map(([label, value]) => ({ label, value }));
  return [{ label: 'AB', value: line.atBats }, { label: 'H', value: line.hits }, ...extras];
}

const extraWords: Record<Exclude<StatLabel, 'AB' | 'H'>, [string, string]> = {
  '2B': ['DOUBLE', 'DOUBLES'], '3B': ['TRIPLE', 'TRIPLES'], HR: ['HOME RUN', 'HOME RUNS'], BB: ['WALK', 'WALKS'],
};

/** The Lower third's line: "2 FOR 3", then the extras in words. A child with no at-bats skips the "0 FOR 0". */
export function gameLine(line: BattingLine): string {
  const words = statCells(line).slice(2).map(({ label, value }) => {
    const [one, many] = extraWords[label as keyof typeof extraWords];
    return value === 1 ? one : `${value} ${many}`;
  });
  return [line.atBats > 0 ? `${line.hits} FOR ${line.atBats}` : '', ...words].filter(Boolean).join(' · ');
}

const pastTense: Partial<Record<Appearance['result'], string>> = {
  home_run: 'Homered', triple: 'Tripled', double: 'Doubled', ground_rule_double: 'Hit a ground-rule double',
  single: 'Singled', walk: 'Walked', hit_by_pitch: 'Was hit by a pitch',
};
const bestFirst: Appearance['result'][] = ['home_run', 'triple', 'double', 'ground_rule_double', 'single', 'walk', 'hit_by_pitch'];
const fieldNames: Partial<Record<Position, string>> = {
  P: 'the pitcher', C: 'the catcher', '1B': 'first', '2B': 'second', '3B': 'third', SS: 'short', LF: 'left', CF: 'center', RF: 'right',
};
const hitsWithFielder = new Set<Appearance['result']>(['home_run', 'triple', 'double', 'single']);

function ordinal(value: number): string {
  const teen = value % 100 >= 11 && value % 100 <= 13;
  const suffix = teen ? 'th' : ['th', 'st', 'nd', 'rd'][value % 10] ?? 'th';
  return `${value}${suffix}`;
}

/** The child's best play in past tense, "Doubled to center in the 3rd." It's at most 60 characters by construction. */
export function bestPlay(found: Appearance[]): string | null {
  for (const result of bestFirst) {
    const play = found.find((item) => item.result === result);
    if (!play) continue;
    const field = hitsWithFielder.has(result) && play.fielder ? fieldNames[play.fielder] : undefined;
    return `${pastTense[result]}${field ? ` to ${field}` : ''} in the ${ordinal(play.inning)}.`;
  }
  return null;
}

const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

/** SAT, OCT 24, in the phone's time zone. */
export function shortDate(at: string): string {
  const date = new Date(at);
  return `${days[date.getDay()]}, ${months[date.getMonth()]} ${date.getDate()}`;
}

/** FALL 2026. Spring is February to May, summer June and July, fall August to November, winter December and January. */
export function seasonOf(at: string): string {
  const date = new Date(at);
  const month = date.getMonth();
  const season = month >= 1 && month <= 4 ? 'SPRING' : month <= 6 && month >= 5 ? 'SUMMER' : month >= 7 && month <= 10 ? 'FALL' : 'WINTER';
  return `${season} ${month === 0 ? date.getFullYear() - 1 : date.getFullYear()}`;
}

const positionNames: Record<Position, string> = {
  P: 'PITCHER', C: 'CATCHER', '1B': 'FIRST BASE', '2B': 'SECOND BASE', '3B': 'THIRD BASE', SS: 'SHORTSTOP',
  LF: 'LEFT FIELD', CF: 'CENTER FIELD', RF: 'RIGHT FIELD', ROVER: 'ROVER',
};

export type GameShareInput = {
  setup: GameSetup;
  events: Event[];
  state: GameState;
  player: PlayerRef;
  side: TeamSide;
  /** Presentation only: these never reach events, stats or logs (AGENTS.md rule 5). */
  names: { first: string; last: string; number: string };
  team: string;
  division: string;
};

/** The child's share, or null when they had no plate appearance in the game. */
export function gameShare({ setup, events, state, player, side, names, team, division }: GameShareInput): GameShare | null {
  const line = battingLines(setup, events)[player.id];
  if (!line || line.plateAppearances === 0) return null;
  const first = events[0]?.at ?? new Date(0).toISOString();
  const position = state.lineups[side].find((slot) => slot.player.id === player.id)?.position ?? null;
  return {
    team, division, ...names,
    position: position ? positionNames[position] : null,
    date: shortDate(first),
    season: seasonOf(first),
    stats: statCells(line),
    gameLine: gameLine(line),
    bestPlay: bestPlay(appearances(setup, events, player)),
  };
}
