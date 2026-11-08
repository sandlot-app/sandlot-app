import type { GameState, PlayerRef, TeamSide } from '@sandlot/engine';

// Display names for the demo game, from the design's sample game. They stay in presentation:
// events, stats and logs refer to players by ID only.
// The family live page keeps its own copy of these team names and jersey numbers, without the names, in
// apps/web/src/roster.ts (PR #73). Rename or renumber a demo player in both places.

export const demoTeams: Record<TeamSide, { name: string; short: string }> = {
  home: { name: 'Hawks', short: 'HAW' },
  away: { name: 'Marlins', short: 'MAR' },
};

const demoPlayers: Record<string, { number: string; name: string }> = {
  'home-1': { number: '15', name: 'T. Nguyen' },
  'home-2': { number: '12', name: 'M. Ortiz' },
  'home-3': { number: '24', name: 'D. Park' },
  'home-4': { number: '7', name: 'S. Bell' },
  'home-5': { number: '3', name: 'A. Kindle' },
  'home-6': { number: '6', name: 'J. Ruiz' },
  'home-7': { number: '9', name: 'R. Hale' },
  'home-8': { number: '1', name: 'K. Moss' },
  'home-9': { number: '22', name: 'E. Brooks' },
  'away-1': { number: '17', name: 'J. Soto' },
  'away-2': { number: '3', name: 'L. Darcy' },
  'away-3': { number: '8', name: 'C. Vance' },
  'away-4': { number: '5', name: 'N. Cole' },
  'away-5': { number: '11', name: 'P. Shah' },
  'away-6': { number: '4', name: 'R. Diaz' },
  'away-7': { number: '2', name: 'G. Ford' },
  'away-8': { number: '14', name: 'H. Lin' },
  'away-9': { number: '21', name: 'M. Webb' },
};

/** The demo family's child, whose stat stickers and card the family shares after a Final game. */
export const demoChild = { player: { kind: 'player', id: 'home-6' } as PlayerRef, side: 'home' as TeamSide, first: 'Javier', last: 'Ruiz' };

/** The demo game's division, as the games list and stat card show it. */
export const demoDivision = 'Mustang';

/** The jersey number and short name a screen shows for a player, falling back to their batting order. */
export function playerDisplay(state: GameState, side: TeamSide, player: PlayerRef): { number: string; name: string } {
  const known = demoPlayers[player.id];
  if (known) return known;
  const order = state.lineups[side].findIndex((slot) => slot.player.kind === player.kind && slot.player.id === player.id) + 1;
  return { number: String(order), name: `Player #${order}` };
}
