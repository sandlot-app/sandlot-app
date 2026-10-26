import { presets } from '@sandlot/engine';
import type {
  GameSetup,
  LineupSlot,
  OpponentId,
  PlayerId,
  PlayerRef,
  Position,
} from '@sandlot/engine';

const positions: Position[] = [
  'P',
  'C',
  '1B',
  '2B',
  '3B',
  'SS',
  'LF',
  'CF',
  'RF',
];
const home: PlayerRef[] = positions.map((_, index) => ({
  kind: 'player',
  id: `home-${index + 1}` as PlayerId,
}));
const away: PlayerRef[] = positions.map((_, index) => ({
  kind: 'opponent',
  id: `away-${index + 1}` as OpponentId,
}));

export const demoSetup: GameSetup = {
  rules: presets['moraga-mustang-second-half'],
  roster: { home, away },
  pitcherOutsEarlierToday: {},
};

export const legacyDemoSetup: GameSetup = {...demoSetup, rules: presets['moraga-mustang-first-half']};

export const demoLineups: Record<'home' | 'away', LineupSlot[]> = {
  home: home.map((player, index) => ({ player, position: positions[index]! })),
  away: away.map((player, index) => ({ player, position: positions[index]! })),
};
