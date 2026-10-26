import type { Command, PitchResult, RunnerEvent } from '@sandlot/engine';
import { outcomeChoices } from './tap-play.ts';

const pitchLabels: Record<PitchResult, string> = {
  ball: 'Ball',
  called_strike: 'Strike',
  swinging_strike: 'Strike',
  foul_tip: 'Strike',
  foul: 'Foul',
  hit_by_pitch: 'Hit by pitch',
  in_play: 'In play',
};

const runnerLabels: Partial<Record<RunnerEvent, string>> = {
  stolen_base: 'Steal',
  caught_stealing: 'Steal',
  wild_pitch: 'Wild pitch',
  passed_ball: 'Passed ball',
  pickoff: 'Pickoff',
};

/** Names a saved play in a few words, as the Undo pill and sync line show it. */
export function playLabel(commands: Command[]): string {
  const outcome = commands.find((command) => command.kind === 'ball_in_play');
  if (outcome) {
    const choice = outcomeChoices.find((item) => item.outcome === outcome.outcome && item.trajectory === outcome.trajectory)
      ?? outcomeChoices.find((item) => item.outcome === outcome.outcome);
    return choice?.label ?? 'In play';
  }
  const first = commands[0];
  if (first?.kind === 'pitch') return pitchLabels[first.result];
  if (first?.kind === 'runner') return runnerLabels[first.event] ?? 'Runner';
  return 'Play';
}
