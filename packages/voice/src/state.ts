import { applyGroup, replay } from '@sandlot/engine';
import type { BallInPlayOutcome, Base, Command, Destination, Event, GameSetup, GameState, PlayerRef, TeamSide } from '@sandlot/engine';
import { samePlayer } from './players.ts';

/** A player the scorer can name. The app passes these in with each press; they never reach events, stats or logs. */
export type RosterEntry = { player: PlayerRef; side: TeamSide; number: string; name: string };

/** The game a press is read against: the setup, the saved events, and who's who. */
export type PressGame = { setup: GameSetup; events: Event[]; roster: RosterEntry[] };

export const batting = (state: GameState): TeamSide => state.half === 'top' ? 'away' : 'home';
export const fielding = (state: GameState): TeamSide => state.half === 'top' ? 'home' : 'away';

/** The state after `commands` are added to the game, or null when the engine refuses them. */
export function stateAfter(game: PressGame, commands: Command[]): GameState | null {
  const result = commands.length ? applyGroup(game.setup, game.events, commands) : replay(game.setup, game.events);
  return result.ok ? result.state : null;
}

export function baseOf(state: GameState, player: PlayerRef): Base | null {
  return ([1, 2, 3] as const).find((base) => {
    const runner = state.bases[base]?.player;
    return runner !== undefined && samePlayer(runner, player);
  }) ?? null;
}

export const runnersOn = (state: GameState): { base: Base; player: PlayerRef }[] =>
  ([1, 2, 3] as const).flatMap((base) => {
    const player = state.bases[base]?.player;
    return player ? [{ base, player }] : [];
  });

/**
 * Where each outcome leaves the batter when the play doesn't say: the engine's own defaults. A double or triple play
 * has none, because the engine needs the batter's destination said.
 */
export const batterDefault: Record<BallInPlayOutcome, Destination | null> = {
  single: 1, double: 2, ground_rule_double: 2, triple: 3, home_run: 'home', error: 1, fielders_choice: 1,
  out: 'out', sacrifice_fly: 'out', sacrifice_bunt: 'out', double_play: null, triple_play: null,
};

/** The batter due up. */
export const batterUp = (state: GameState): PlayerRef | undefined => state.lineups[batting(state)][state.nextBatter[batting(state)]]?.player;

/** Splits commands into units the engine applies on their own: an in-play pitch with its ball in play, a run of runner moves, or one command. */
export function units(commands: Command[]): [number, number][] {
  const result: [number, number][] = [];
  let index = 0;
  while (index < commands.length) {
    const command = commands[index]!;
    let end = index + 1;
    if (command.kind === 'pitch' && command.result === 'in_play' && commands[end]?.kind === 'ball_in_play') end += 1;
    else if (command.kind === 'runner') {
      while (commands[end]?.kind === 'runner' && (commands[end] as typeof command).event === command.event) end += 1;
    }
    result.push([index, end]);
    index = end;
  }
  return result;
}

const rank = (to: Destination): number | null => to === 'out' ? null : to === 'home' ? 4 : to;

/**
 * True when a runner ends up ahead of a runner who started in front of them, which can't happen on one play. The
 * engine refuses it too (`runner_passed`), so this is a second check that gives the same words. On a ball in play the
 * batter counts too, starting behind everyone.
 */
export function passesRunner(game: PressGame, commands: Command[]): boolean {
  return units(commands).some(([start, end]) => {
    const state = stateAfter(game, commands.slice(0, start));
    if (!state) return false;
    const play = commands.slice(start, end).find((command) => command.kind === 'ball_in_play');
    const moves = commands.slice(start, end).flatMap((command): { runner: PlayerRef; to: Destination }[] =>
      command.kind === 'runner' ? [command] : command.kind === 'ball_in_play' ? command.advances : []);
    const batter = batterUp(state);
    const batterEnd = (): number | null => {
      if (play?.kind !== 'ball_in_play' || !batter) return null;
      const own = moves.find((move) => samePlayer(move.runner, batter));
      const to = own ? own.to : batterDefault[play.outcome];
      return to === null ? null : rank(to);
    };
    const ends = [batterEnd(), ...runnersOn(state).map(({ base, player }) => {
      const moved = moves.find((move) => samePlayer(move.runner, player));
      return moved ? rank(moved.to) : base;
    })];
    return ends.some((behind, index) => ends.slice(index + 1).some((ahead) => behind !== null && ahead !== null && behind > ahead));
  });
}
