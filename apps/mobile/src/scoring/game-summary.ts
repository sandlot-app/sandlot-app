import type { GameState } from '@sandlot/engine';

export const blockedMessages = {
  version:
    'This game needs a different app version. Your saved plays have been kept. Update the app before scoring.',
  corrupt:
    'This saved game could not be read safely. Your plays have been kept. Scoring is paused.',
  storage:
    'Your saved game could not be opened. Scoring is paused so no play is lost. Try opening it again.',
};

export function basesSummary(bases: GameState['bases']): string {
  const occupied = ([1, 2, 3] as const).filter((base) => bases[base]);
  return occupied.length
    ? `Runners on ${occupied.map((base) => ['first', 'second', 'third'][base - 1]).join(' and ')}.`
    : 'Bases empty.';
}

export function gameSummary(state: GameState): string {
  const { balls, strikes } = state.count;
  const count = `${balls} ball${balls === 1 ? '' : 's'} and ${strikes} strike${strikes === 1 ? '' : 's'}`;
  return `Away ${state.score.away}, home ${state.score.home}. Inning ${state.inning}, ${state.half}. ${state.outs} out${state.outs === 1 ? '' : 's'}. Count ${count}. ${basesSummary(state.bases)}${state.status === 'final' ? ' Game final.' : ''}`;
}
