import { presets } from '@sandlot/engine';
import type {
  GameSetup,
  LineupSlot,
  OpponentId,
  PlayerId,
  PlayerRef,
  Position,
  TeamSide,
} from '@sandlot/engine';

/** The part of the season whose rules a game uses (GLOSSARY: Season half). */
export type SeasonHalf = 'first' | 'second';

const seasonHalfPresets = {
  first: 'moraga-mustang-first-half',
  second: 'moraga-mustang-second-half',
} as const satisfies Record<SeasonHalf, keyof typeof presets>;

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
// home-10 has no fielding position in the sample lineup: everyone present bats in Mustang.
const home: PlayerRef[] = [...positions, null].map((_, index) => ({
  kind: 'player',
  id: `home-${index + 1}` as PlayerId,
}));
const away: PlayerRef[] = positions.map((_, index) => ({
  kind: 'opponent',
  id: `away-${index + 1}` as OpponentId,
}));
const roster: Record<TeamSide, PlayerRef[]> = { home, away };

/** The demo game's setup for `half`: the demo roster under that half's Mustang rules. */
export function gameSetup(half: SeasonHalf): GameSetup {
  return { rules: presets[seasonHalfPresets[half]], roster, pitcherOutsEarlierToday: {} };
}

/** Development and sample data use the second half. */
export const demoSetup: GameSetup = gameSetup('second');

const slot = (id: string, position: Position | null): LineupSlot => ({
  player: home.find((player) => player.id === id)!,
  position,
});

/** The sample lineups (docs/design/spec-update-milestone-4.md, Sample lineup), by player ID. */
export const demoLineups: Record<TeamSide, LineupSlot[]> = {
  home: [
    slot('home-8', 'CF'),
    slot('home-6', 'SS'),
    slot('home-4', '2B'),
    slot('home-3', '1B'),
    slot('home-7', 'LF'),
    slot('home-5', '3B'),
    slot('home-1', 'P'),
    slot('home-2', 'C'),
    slot('home-9', 'RF'),
    slot('home-10', null),
  ],
  away: away.map((player, index) => ({ player, position: positions[index]! })),
};
