import { applyGroup } from '@sandlot/engine';
import type { Advance, Base, Command, Destination, GameState, PlayerRef, RejectCode } from '@sandlot/engine';
import type { AnswerReading, BaseKey, DestinationKey } from './answer.ts';
import { baseOf, batterDefault, batterUp, type PressGame } from './state.ts';

// One reading of the answer as engine commands. Runners are looked up by the base they were on when the press began,
// the batter comes from the game, and the engine still decides whether the whole thing is legal (rule 6).

export type Mapped =
  /** `atBat` is the game as it stood for the pitch that ended the at-bat, so its batter is the one the press was about. */
  | { ok: true; commands: Command[]; atBat: GameState }
  | { ok: false; why: { kind: 'no_runner'; base: Base } | { kind: 'engine'; code: RejectCode } };

const hits = new Set(['single', 'double', 'ground_rule_double', 'triple', 'home_run']);
const toBase = (key: BaseKey): Base => Number(key) as Base;
const toDestination = (key: DestinationKey): Destination => key === 'home' || key === 'out' ? key : toBase(key);
const leadFirst = <T extends { from: BaseKey }>(moves: T[]) => [...moves].sort((a, b) => Number(b.from) - Number(a.from));

/**
 * The commands for one reading, applied to the game as it stood before the press (`before`). Runner events go first,
 * lead runner first because the engine checks each runner's base as it moves them, then the pitches, then the ball in
 * play. A runner who stayed put is left out, so the engine keeps them on their base and the banner says they held.
 */
export function toCommands(game: PressGame, before: GameState, reading: AnswerReading): Mapped {
  const runnerOn = (key: BaseKey): PlayerRef | undefined => before.bases[toBase(key)]?.player;
  const commands: Command[] = [];
  for (const event of leadFirst(reading.runner_events)) {
    const runner = runnerOn(event.from);
    if (!runner) return { ok: false, why: { kind: 'no_runner', base: toBase(event.from) } };
    commands.push({ kind: 'runner', event: event.event, runner, to: toDestination(event.to) });
  }
  for (const pitch of reading.pitches) commands.push({ kind: 'pitch', result: pitch });

  const play = reading.ball_in_play;
  // The batter is whoever was up for the pitch that ended the at-bat: before the ball in play, or before the last pitch.
  const upFor = play || !reading.pitches.length ? commands : commands.slice(0, -1);
  let atBat = before;
  if (upFor.length) {
    const prefix = applyGroup(game.setup, game.events, upFor);
    if (!prefix.ok) return { ok: false, why: { kind: 'engine', code: prefix.code } };
    atBat = prefix.state;
  }
  if (!play) return { ok: true, commands, atBat };

  const batter = batterUp(atBat);
  if (!batter) return { ok: false, why: { kind: 'engine', code: 'game_over' } };
  const hit = hits.has(play.outcome);
  const flies = play.trajectory === 'fly' || play.trajectory === 'line' || play.trajectory === 'popup';
  // A runner can be forced only while every base behind them is full. A derived batter out comes first and ends every force.
  let forceThrough = 0;
  for (const base of [1, 2, 3] as const) { if (!atBat.bases[base]) break; forceThrough = base; }
  const defaultTo = batterDefault[play.outcome];
  if (defaultTo === 'out' && play.batter_to === 'out') forceThrough = -1;
  const advances: Advance[] = [];
  for (const move of leadFirst(play.runners)) {
    const runner = runnerOn(move.from);
    if (!runner) return { ok: false, why: { kind: 'no_runner', base: toBase(move.from) } };
    const from = baseOf(atBat, runner);
    if (move.to === 'out') {
      const forced = !hit && !flies && from !== null && from <= forceThrough;
      advances.push({ runner, to: 'out', outType: forced ? 'force' : 'non_force' });
      forceThrough = Math.min(forceThrough, (from ?? 1) - 1);
    } else if (from === null || toDestination(move.to) !== from) {
      advances.push({ runner, to: toDestination(move.to) as Exclude<Destination, 'out'> });
    }
  }
  // The batter's base comes from the outcome. Only an answer that says otherwise gives the batter an advance, last.
  if (toDestination(play.batter_to) !== defaultTo) {
    advances.push(play.batter_to === 'out'
      ? { runner: batter, to: 'out', outType: 'batter_before_first' }
      : { runner: batter, to: toDestination(play.batter_to) as Exclude<Destination, 'out'> });
  }
  commands.push(
    { kind: 'pitch', result: 'in_play' },
    { kind: 'ball_in_play', outcome: play.outcome, trajectory: play.trajectory, fielders: play.fielders.map((fielder) => fielder.position), advances },
  );
  return { ok: true, commands, atBat };
}
