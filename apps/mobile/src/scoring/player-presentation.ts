import type { PlayerRef } from '@sandlot/engine';
import { displayPlayer } from './roster-presentation.ts';

export function playerPresentation(player: PlayerRef, role: string) {
  const display = displayPlayer(player);
  const named = display.name !== `Player #${display.number}` && display.name !== 'Player';
  return {...display, named, name: named ? display.name : role,
    identity: named ? `${display.name} · #${display.number}` : `${role} #${display.number}`};
}
