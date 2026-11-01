import { battingLines, type BattingLine, type PlayerRef, type RuleSet } from '@sandlot/engine';
import { tokens } from '@sandlot/tokens';
import type { SavedGame } from './offline-game.ts';

export type PitchTone = 'normal' | 'warning' | 'danger';
export type PitchLine = { count: string; tone: PitchTone; spoken: string };

/** The batter's game so far, as the matchup ticket shows it: "3 for 4, 2B, HR", or "First up" before they've batted. */
export function batterStat(line: BattingLine | undefined): string {
  if (!line?.plateAppearances) return 'First up';
  const parts = [`${line.hits} for ${line.atBats}`];
  for (const [count, label] of [[line.doubles, '2B'], [line.triples, '3B'], [line.homeRuns, 'HR'], [line.walks, 'BB']] as const) {
    if (count) parts.push(count === 1 ? label : `${count} ${label}`);
  }
  return parts.join(', ');
}

/** The pitcher's count against the league limit. Amber from the warning, red from the limit, as the old pitch meter was. */
export function pitchLine(thrown: number, limits: RuleSet['pitchCountLimits']): PitchLine {
  if (!limits) return { count: `${thrown}`, tone: 'normal', spoken: `${thrown} pitch${thrown === 1 ? '' : 'es'}` };
  const tone = thrown >= limits.limit ? 'danger' : thrown >= limits.warnAt ? 'warning' : 'normal';
  return { count: `${thrown}/${limits.limit}`, tone, spoken: `${thrown} of ${limits.limit} pitches` };
}

/** The ticket's bat and ball marks are 32 across, with a space/2 gap before the text. */
export const markSize = 32;
const markRoom = markSize + tokens.modes.Light.sizes['space/2'];

/**
 * Whether the icon marks fit: both stat lines must stay on one line in a half less the mark's room. Stats never
 * shorten, so when one won't fit both marks hide. The widths are the stats' own and the half's, neither of which
 * changes when the marks do, so the answer can't flip back and forth from pitch to pitch.
 */
export function marksFit(halfWidth: number, statWidths: number[]): boolean {
  return !halfWidth || statWidths.every((width) => width <= halfWidth - markRoom + 0.5);
}

/** Who's up and who's pitching, with the lines the ticket shows, from the game the scorer's phone has saved. */
export function ticketLines(game: SavedGame): {
  lines: Record<string, BattingLine>;
  batter: { player: PlayerRef; stat: string } | null;
  pitcher: { player: PlayerRef; count: PitchLine } | null;
} {
  const { state } = game;
  const batting = state.half === 'top' ? 'away' : 'home';
  const fielding = state.half === 'top' ? 'home' : 'away';
  const lines = battingLines(game.setup, game.events);
  const up = state.lineups[batting][state.nextBatter[batting]]?.player;
  const pitcher = state.pitchers[fielding];
  return {
    lines,
    batter: up ? { player: up, stat: batterStat(lines[up.id]) } : null,
    pitcher: pitcher ? { player: pitcher, count: pitchLine(state.pitchCounts[pitcher.id] ?? 0, game.setup.rules.pitchCountLimits) } : null,
  };
}
