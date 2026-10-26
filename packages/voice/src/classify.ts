import type { Command, GameState } from '@sandlot/engine';
import { batting } from './resolve.ts';

/**
 * Simple or complex, by the spec's section 3: a group is simple only when it moves or retires at most one player,
 * has no error, doesn't end the half-inning or the game, and has no substitution or lineup change.
 */
export function classify(before: GameState, after: GameState, commands: Command[]): 'simple' | 'complex' {
  const hasError = commands.some((command) => (command.kind === 'ball_in_play' && command.outcome === 'error')
    || (command.kind === 'runner' && command.event === 'advance_on_error'));
  if (hasError) return 'complex';
  if (commands.some((command) => command.kind === 'substitution' || command.kind === 'game')) return 'complex';
  if (after.status === 'final' || after.half !== before.half || after.inning !== before.inning) return 'complex';
  const side = batting(before);
  const batterDone = after.nextBatter[side] !== before.nextBatter[side] ? 1 : 0;
  const runnersMoved = ([1, 2, 3] as const).filter((base) => {
    const runner = before.bases[base]?.player;
    if (!runner) return false;
    const still = after.bases[base]?.player;
    return !still || still.kind !== runner.kind || still.id !== runner.id;
  }).length;
  return batterDone + runnersMoved <= 1 ? 'simple' : 'complex';
}
