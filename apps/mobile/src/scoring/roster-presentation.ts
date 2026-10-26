import type { PlayerRef, TeamSide } from '@sandlot/engine';
import { roster } from './game-setup.ts';

const labels: Record<TeamSide, readonly (readonly [number, string])[]> = {
  away: [[1, 'K. Moss'], [6, 'J. Ruiz'], [7, 'S. Bell'], [24, 'D. Park'], [9, 'R. Hale'], [3, 'A. Kindle'],
    [15, 'T. Nguyen'], [12, 'M. Ortiz'], [22, 'E. Brooks'], [18, 'B. Lane'], [11, 'R. James'], [4, 'S. Fox']],
  home: [[2, 'L. Darcy'], [8, 'C. Vance'], [5, 'N. Cole'], [17, 'P. Shah'], [10, 'D. Reed'], [14, 'J. Hall'],
    [19, 'M. Chen'], [23, 'A. Bell'], [21, 'L. Ford'], [16, 'T. Green'], [20, 'E. Gray'], [13, 'C. Lee']],
};
export const teamNames: Record<TeamSide, string> = {away: 'Hawks', home: 'Marlins'};

export function displayPlayer(player: PlayerRef): {number: string; name: string} {
  const side = player.kind === 'player' ? 'home' : 'away';
  const index = roster[side].findIndex((entry) => entry.id === player.id);
  const label = labels[side][index];
  return label ? {number: String(label[0]), name: label[1]} : {number: '?', name: 'Player'};
}
