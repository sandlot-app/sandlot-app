import type { TeamSide } from '@sandlot/engine';

// The demo game's teams and jersey numbers, the same as apps/mobile/src/scoring/demo-roster.ts. Games don't store
// team names or numbers yet. This page is public, so it shows numbers and never names.

export const TEAM_NAMES: Record<TeamSide, string> = { home: 'Hawks', away: 'Marlins' };
export const TEAM_SHORT_NAMES: Record<TeamSide, string> = { home: 'HAW', away: 'MAR' };

const JERSEYS: Record<string, string> = {
  'home-1': '15',
  'home-2': '12',
  'home-3': '24',
  'home-4': '7',
  'home-5': '3',
  'home-6': '6',
  'home-7': '9',
  'home-8': '1',
  'home-9': '22',
  'away-1': '17',
  'away-2': '3',
  'away-3': '8',
  'away-4': '5',
  'away-5': '11',
  'away-6': '4',
  'away-7': '2',
  'away-8': '14',
  'away-9': '21',
};

/** A player's jersey number, or their ID when the page doesn't know it. */
export function jersey(playerId: string): string {
  return JERSEYS[playerId] ?? playerId;
}

/** How a sentence names a player: "#17". */
export function playerLabel(playerId: string): string {
  const number = JERSEYS[playerId];
  return number ? `#${number}` : playerId;
}
