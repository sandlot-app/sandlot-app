import { applyGroup } from '@sandlot/engine';
import type { Advance, Base, Command, Destination, GameState, PlayerRef, RejectCode } from '@sandlot/engine';
import type { AnswerReading, BaseKey, DestinationKey } from './answer.ts';
import { samePlayer } from './players.ts';
import { baseOf, batterDefault, batterUp, type PressGame } from './state.ts';

// One reading of the answer as engine commands. Runners are looked up by the base they were on when the press began,
// the batter comes from the game, and the engine still decides whether the whole thing is legal (rule 6).

export type Mapped =
  | {
      ok: true;
      commands: Command[];
      /** The game as it stood for the pitch that ended the last at-bat, so its batter is the one the press was about. */
      atBat: GameState;
      /** The batters of earlier at-bats the press's pitches ended, in order. */
      earlier: PlayerRef[];
      /** The game right after the ball in play, where events after it find their runners. Null with no ball in play. */
      afterPlay: GameState | null;
    }
  /** `unusable`: the reading contradicts itself, such as a runner forced along with no walk or hit by pitch. */
  | { ok: false; why: { kind: 'no_runner'; base: Base } | { kind: 'engine'; code: RejectCode } | { kind: 'unusable' } };

const hits = new Set(['single', 'double', 'ground_rule_double', 'triple', 'home_run']);
/** Outcomes where a ball in the air was caught for an out. */
const outs = new Set(['out', 'sacrifice_fly', 'double_play', 'triple_play']);

/**
 * A runner is forced along only when the press ends on ball four or a hit by pitch, and only off a base that every
 * base behind it was full for. Anything else in `forced_runners` would hide a name in a slot that records nothing.
 */
function forcedAlong(reading: AnswerReading, upForLast: GameState, after: GameState): boolean {
  const last = reading.pitches.at(-1);
  if (reading.ball_in_play || (last !== 'ball' && last !== 'hit_by_pitch')) return false;
  const up = batterUp(upForLast);
  const next = batterUp(after);
  if (!up || (next && samePlayer(up, next) && after.half === upForLast.half)) return false;
  let full = 0;
  for (const base of [1, 2, 3] as const) { if (!upForLast.bases[base]) break; full = base; }
  return reading.forced_runners.every((move) => Number(move.from) <= full);
}
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
  // Who was up for each pitch, so a press that ends more than one at-bat knows each batter.
  let atBat = commands.length ? applyGroup(game.setup, game.events, commands) : { ok: true as const, state: before };
  if (!atBat.ok) return { ok: false, why: { kind: 'engine', code: atBat.code } };
  const upForPitch: GameState[] = [];
  for (const pitch of reading.pitches) {
    upForPitch.push(atBat.state);
    commands.push({ kind: 'pitch', result: pitch });
    atBat = applyGroup(game.setup, game.events, commands);
    if (!atBat.ok) return { ok: false, why: { kind: 'engine', code: atBat.code } };
  }
  const play = reading.ball_in_play;
  // The last at-bat's batter is up for the ball in play, or for the last pitch when there is none.
  const states = play ? [...upForPitch, atBat.state] : upForPitch.length ? upForPitch : [before];
  const ups = states.map(batterUp);
  const earlier = ups.filter((player, index): player is PlayerRef =>
    player !== undefined && index < ups.length - 1 && !samePlayer(player, ups[index + 1] ?? player));
  if (reading.forced_runners.length && !forcedAlong(reading, states.at(-1)!, atBat.state)) return { ok: false, why: { kind: 'unusable' } };
  if (!play) return { ok: true, commands, atBat: states.at(-1)!, earlier, afterPlay: null };

  const pre = atBat.state;
  const batter = batterUp(pre);
  if (!batter) return { ok: false, why: { kind: 'engine', code: 'game_over' } };
  const hit = hits.has(play.outcome);
  // A ball caught in the air removes every force. A line drive on a fielder's choice or an error wasn't caught.
  const caught = (play.trajectory === 'fly' || play.trajectory === 'line' || play.trajectory === 'popup') && outs.has(play.outcome);
  // A runner can be forced only while every base behind them is full. A batter out that comes first ends every force:
  // the engine puts a derived one first, and a listed one goes first when the answer says the batter was out first.
  let forceThrough = 0;
  for (const base of [1, 2, 3] as const) { if (!pre.bases[base]) break; forceThrough = base; }
  const defaultTo = batterDefault[play.outcome];
  // An out, sacrifice fly or sacrifice bunt leaves the batter out: an answer that has them safe contradicts itself.
  if (defaultTo === 'out' && play.batter_to !== 'out') return { ok: false, why: { kind: 'unusable' } };
  const batterOut: Advance = { runner: batter, to: 'out', outType: 'batter_before_first' };
  const listsBatter = toDestination(play.batter_to) !== defaultTo;
  const batterFirst = play.batter_to === 'out' && (defaultTo === 'out' || play.batter_out_first);
  if (batterFirst) forceThrough = -1;
  const advances: Advance[] = listsBatter && batterFirst ? [batterOut] : [];
  for (const move of leadFirst(play.runners)) {
    const runner = runnerOn(move.from);
    if (!runner) return { ok: false, why: { kind: 'no_runner', base: toBase(move.from) } };
    const from = baseOf(pre, runner);
    // A runner never ends a play on a base behind the one they started on.
    if (from !== null && move.to !== 'out' && move.to !== 'home' && toBase(move.to) < from) return { ok: false, why: { kind: 'unusable' } };
    if (move.to === 'out') {
      const forced = !hit && !caught && from !== null && from <= forceThrough;
      advances.push({ runner, to: 'out', outType: forced ? 'force' : 'non_force' });
      forceThrough = Math.min(forceThrough, (from ?? 1) - 1);
    } else if (from === null || toDestination(move.to) !== from) {
      advances.push({ runner, to: toDestination(move.to) as Exclude<Destination, 'out'> });
    }
  }
  // The batter's base comes from the outcome. Only an answer that says otherwise gives the batter an advance, after
  // the runners unless the batter was out first.
  if (listsBatter && !batterFirst) {
    advances.push(play.batter_to === 'out' ? batterOut : { runner: batter, to: toDestination(play.batter_to) as Exclude<Destination, 'out'> });
  }
  commands.push(
    { kind: 'pitch', result: 'in_play' },
    { kind: 'ball_in_play', outcome: play.outcome, trajectory: play.trajectory, fielders: play.fielders.map((fielder) => fielder.position), advances },
  );
  // Events after the ball in play find their runners where the play left them.
  const played = applyGroup(game.setup, game.events, commands);
  if (!played.ok) return { ok: false, why: { kind: 'engine', code: played.code } };
  for (const event of leadFirst(reading.runner_events_after)) {
    const runner = played.state.bases[toBase(event.from)]?.player;
    if (!runner) return { ok: false, why: { kind: 'no_runner', base: toBase(event.from) } };
    commands.push({ kind: 'runner', event: event.event, runner, to: toDestination(event.to) });
  }
  return { ok: true, commands, atBat: pre, earlier, afterPlay: played.state };
}
