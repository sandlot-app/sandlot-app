import { presets } from '@sandlot/engine';
import type { GameSetup, LineupSlot, OpponentId, PlayerId, PlayerRef, Position, TeamSide } from '@sandlot/engine';
import { demoSetup, legacyDemoSetup } from './demo-game.ts';

export type SeasonHalf = 'first' | 'second';
export type SetupSelection = {seasonHalf: SeasonHalf; lineups: Record<TeamSide, LineupSlot[]>};
export type SetupDraft = {seasonHalf: SeasonHalf; lineups: Record<TeamSide, LineupSlot[] | null>};

export const roster: Record<TeamSide, PlayerRef[]> = {
  home: Array.from({length: 12}, (_, index) => ({kind: 'player', id: `home-${index + 1}` as PlayerId})),
  away: Array.from({length: 12}, (_, index) => ({kind: 'opponent', id: `away-${index + 1}` as OpponentId})),
};
const positions: (Position | null)[] = ['CF', 'SS', '2B', '1B', 'LF', '3B', 'P', 'C', 'RF', null];

export function initialLineup(side: TeamSide): LineupSlot[] {
  return roster[side].slice(0, positions.length).map((player, index) => ({player, position: positions[index]!}));
}

export function seasonHalfFor(date: Date): SeasonHalf {
  return date.getMonth() >= 9 ? 'second' : 'first';
}

export function newSetupDraft(date = new Date()): SetupDraft {
  return {seasonHalf: seasonHalfFor(date), lineups: {home: null, away: null}};
}

export function setupFor(half: SeasonHalf): GameSetup {
  return {rules: presets[half === 'first' ? 'moraga-mustang-first-half' : 'moraga-mustang-second-half'], roster,
    pitcherOutsEarlierToday: {}};
}

export function readSavedSetup(serialized: string): GameSetup | null {
  return [legacyDemoSetup, demoSetup, setupFor('first'), setupFor('second')]
    .find((setup) => JSON.stringify(setup) === serialized) ?? null;
}

export function assignPosition(lineup: LineupSlot[], playerId: string, position: Position | null): LineupSlot[] {
  const selected = lineup.find((slot) => slot.player.id === playerId);
  if (!selected) return lineup;
  return lineup.map((slot) => slot === selected ? {...slot, position}
    : position !== null && slot.position === position ? {...slot, position: selected.position} : slot);
}
