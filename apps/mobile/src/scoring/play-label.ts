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

/** A play's calls, each as its commands: an in-play pitch with its ball in play, a run of one runner event, or one command. */
function units(commands: Command[]): Command[][] {
  const result: Command[][] = [];
  for (const command of commands) {
    const call = result.at(-1);
    const previous = call?.at(-1);
    const joins = (command.kind === 'ball_in_play' && previous?.kind === 'pitch' && previous.result === 'in_play')
      || (command.kind === 'runner' && previous?.kind === 'runner' && previous.event === command.event);
    if (call && joins) call.push(command);
    else result.push([command]);
  }
  return result;
}

function callLabel(commands: Command[]): string {
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

/**
 * Names a saved play in a few words, as the Undo pill and sync line show it. A spoken press can hold several calls, so
 * each is named ("Ball · Ball"), and Undo says exactly what it takes back.
 */
export function playLabel(commands: Command[]): string {
  return units(commands).map(callLabel).join(' · ') || 'Play';
}
