import type {
  Advance, BallInPlayOutcome, Base, Destination, OutType, PlayerRef, Position, Trajectory,
} from '@sandlot/engine';
import type { DemoAction, SavedGame } from './offline-game.ts';
import { displayPlayer } from './roster-presentation.ts';

export type OutcomeChoice = {
  id: string;
  label: string;
  section: 'Hit' | 'Out' | 'Other';
  outcome: BallInPlayOutcome;
  trajectory: Trajectory | null;
  bases: number;
};

export const outcomeChoices: OutcomeChoice[] = [
  { id: 'single', label: 'Single', section: 'Hit', outcome: 'single', trajectory: null, bases: 1 },
  { id: 'double', label: 'Double', section: 'Hit', outcome: 'double', trajectory: null, bases: 2 },
  { id: 'triple', label: 'Triple', section: 'Hit', outcome: 'triple', trajectory: null, bases: 3 },
  { id: 'home-run', label: 'Home run', section: 'Hit', outcome: 'home_run', trajectory: null, bases: 4 },
  { id: 'ground-out', label: 'Ground out', section: 'Out', outcome: 'out', trajectory: 'ground', bases: 0 },
  { id: 'fly-out', label: 'Fly out', section: 'Out', outcome: 'out', trajectory: 'fly', bases: 0 },
  { id: 'line-out', label: 'Line out', section: 'Out', outcome: 'out', trajectory: 'line', bases: 0 },
  { id: 'pop-out', label: 'Pop out', section: 'Out', outcome: 'out', trajectory: 'popup', bases: 0 },
  { id: 'error', label: 'Error', section: 'Other', outcome: 'error', trajectory: null, bases: 1 },
  { id: 'fielders-choice', label: "Fielder’s choice", section: 'Other', outcome: 'fielders_choice', trajectory: 'ground', bases: 1 },
  { id: 'sac-bunt', label: 'Sac bunt', section: 'Other', outcome: 'sacrifice_bunt', trajectory: 'bunt', bases: 0 },
  { id: 'sac-fly', label: 'Sac fly', section: 'Other', outcome: 'sacrifice_fly', trajectory: 'fly', bases: 0 },
];

export type RunnerMode = Extract<DemoAction, {kind: 'runner_play'}>['event'];
export type RunnerChoice = {
  runner: PlayerRef;
  from: 0 | Base;
  number: string;
  to: Destination;
  outType: OutType;
  outOrder: number;
  forced: boolean;
};
export type InPlayDraft = {
  kind: 'in_play';
  at: string;
  step: 'outcome' | 'fielder' | 'runners';
  game: SavedGame;
  choice: OutcomeChoice | null;
  fielder: Position | null;
  rows: RunnerChoice[];
};
export type RunnerDraft = { kind: 'runner'; at: string; mode: RunnerMode; game: SavedGame; rows: RunnerChoice[] };
export type PlayDraft = {kind: 'more'; game: SavedGame} | InPlayDraft | RunnerDraft;

export function beginInPlay(game: SavedGame, at: string): InPlayDraft {
  return {kind: 'in_play', at, step: 'outcome', game, choice: null, fielder: null, rows: []};
}

export function runnerRows(game: SavedGame, choice: OutcomeChoice | null): RunnerChoice[] {
  const {state} = game;
  const side = state.half === 'top' ? 'away' : 'home';
  const lineup = state.lineups[side];
  const batter = lineup[state.nextBatter[side]]!.player;
  let forceThrough = 0;
  for (const base of [1, 2, 3] as const) {
    if (!state.bases[base]) break;
    forceThrough = base;
  }
  const runners: {runner: PlayerRef; from: 0 | Base}[] = [];
  if (choice) runners.push({runner: batter, from: 0});
  for (const from of [1, 2, 3] as const) {
    const runner = state.bases[from]?.player;
    if (runner) runners.push({runner, from});
  }
  return runners.map(({runner, from}) => {
    let to: Destination = from || 1;
    if (choice) {
      if (from === 0) to = choice.bases === 0 ? 'out' : choice.bases >= 4 ? 'home' : choice.bases as Base;
      else if (choice.section === 'Hit') to = from + choice.bases >= 4 ? 'home' : (from + choice.bases) as Base;
      else if (choice.bases && from <= forceThrough) to = from === 3 ? 'home' : (from + 1) as Base;
    }
    const forced = from > 0 && from <= forceThrough;
    return {runner, from, to, forced,
      number: displayPlayer(runner).number,
      outType: choice?.section === 'Hit' ? 'non_force' : from === 0 ? 'batter_before_first' : !forced || choice?.bases === 0 ? 'non_force' : 'force',
      outOrder: to === 'out' ? 1 : 0};
  });
}

export function chooseDestination(rows: RunnerChoice[], id: string, to: Destination): RunnerChoice[] {
  const nextOrder = Math.max(0, ...rows.map((row) => row.outOrder)) + 1;
  return rows.map((row) => row.runner.id !== id ? row : {
    ...row, to, outOrder: to === 'out' ? row.to === 'out' ? row.outOrder : nextOrder : 0,
  });
}

export function earlierOut(rows: RunnerChoice[], id: string): RunnerChoice[] {
  const outs = rows.filter((row) => row.to === 'out').sort((a, b) => a.outOrder - b.outOrder);
  const index = outs.findIndex((row) => row.runner.id === id);
  if (index < 1) return rows;
  const current = outs[index]!;
  const previous = outs[index - 1]!;
  return rows.map((row) => row === current ? {...row, outOrder: previous.outOrder}
    : row === previous ? {...row, outOrder: current.outOrder} : row);
}

export function draftProblem(draft: InPlayDraft | RunnerDraft): string | null {
  if (draft.kind !== 'in_play' || !draft.choice || !draft.rows.length) return null;
  if (draft.choice.bases === 0 && !draft.rows.some((row) => row.to === 'out'))
    return 'Choose an Out destination for this outcome, or go back to change it.';
  if (draft.choice.section === 'Hit') {
    const batter = draft.rows.find((row) => row.from === 0)!;
    if (draft.choice.bases === 4 && batter.to !== 'home')
      return 'A home run puts the batter Home. Go back to change the outcome.';
    if (typeof batter.to === 'number' && batter.to < draft.choice.bases)
      return 'The batter must reach the credited hit’s base. Change the destination or go back to choose another outcome.';
  }
  return null;
}

export function completePlay(draft: InPlayDraft | RunnerDraft): DemoAction | null {
  if (draftProblem(draft)) return null;
  if (draft.kind === 'runner') {
    const moves = draft.rows.filter((row) => row.to !== row.from).map(({runner, to}) => ({runner, to}));
    return moves.length ? {kind: 'runner_play', at: draft.at, expectedRevision: draft.game.revision, event: draft.mode, moves} : null;
  }
  if (!draft.choice) return null;
  const safe = draft.rows.filter((row) => row.to !== 'out');
  const outs = draft.rows.filter((row) => row.to === 'out').sort((a, b) => a.outOrder - b.outOrder);
  const advances: Advance[] = [...safe, ...outs].map((row) => row.to === 'out'
    ? {runner: row.runner, to: 'out', outType: row.outType}
    : {runner: row.runner, to: row.to});
  return {kind: 'ball_in_play', at: draft.at, expectedRevision: draft.game.revision, outcome: draft.choice.outcome,
    trajectory: draft.choice.trajectory, fielders: draft.fielder ? [draft.fielder] : [], advances};
}
