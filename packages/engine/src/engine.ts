import type {
  BallInPlayOutcome,
  Base,
  Command,
  Destination,
  Event,
  GameControl,
  GameSetup,
  GameState,
  LineupSlot,
  PitchResult,
  PlayerRef,
  Runner,
  TeamSide,
} from './types.ts';

export type RejectCode =
  | 'not_implemented'
  | 'unknown_player'
  | 'game_not_started'
  | 'game_already_started'
  | 'no_pitcher'
  | 'ball_in_play_needs_pitch'
  | 'in_play_needs_outcome'
  | 'base_occupied'
  | 'runner_not_on_base'
  | 'duplicate_runner'
  | 'batter_destination_missing'
  | 'outs_dont_match_outcome'
  | 'bunting_not_allowed';

export type ApplyResult =
  | { ok: true; state: GameState }
  | { ok: false; code: RejectCode };

export function initialState(setup: GameSetup): GameState {
  return {
    status: 'pregame',
    inning: 1,
    half: 'top',
    outs: 0,
    count: { ...setup.rules.startingCount, pitches: 0 },
    bases: {},
    score: { home: 0, away: 0 },
    runsThisHalf: 0,
    lineups: { home: [], away: [] },
    nextBatter: { home: 0, away: 0 },
    pitchers: {},
    pitchCounts: {},
    umpireStart: null,
    alerts: [],
  };
}

/** Rebuilds the game from the start by applying each stored play in order. */
export function replay(setup: GameSetup, events: Event[]): ApplyResult {
  return replayFrom(setup, initialState(setup), events);
}

/** Applies one play after the stored events: every command in it, or none of them. */
export function applyGroup(setup: GameSetup, events: Event[], commands: Command[]): ApplyResult {
  return applyGroupFrom(setup, initialState(setup), events, commands);
}

/** `replay` from a given state instead of the start. Fixtures use it to begin mid-game; the app and server never do. */
export function replayFrom(setup: GameSetup, from: GameState, events: Event[]): ApplyResult {
  let state = from;
  for (const play of plays(events)) {
    const result = applyPlay(setup, state, play);
    if (!result.ok) return result;
    state = result.state;
  }
  return { ok: true, state };
}

/** `applyGroup` from a given state instead of the start. Fixtures use it to begin mid-game; the app and server never do. */
export function applyGroupFrom(setup: GameSetup, from: GameState, events: Event[], commands: Command[]): ApplyResult {
  const replayed = replayFrom(setup, from, events);
  return replayed.ok ? applyPlay(setup, replayed.state, commands) : replayed;
}

/** Splits the event log into plays: each run of events sharing a group. */
function plays(events: Event[]): Command[][] {
  const result: Command[][] = [];
  let group: Event['group'] | null = null;
  for (const event of events) {
    if (event.group !== group) result.push([]);
    group = event.group;
    result[result.length - 1]!.push(event.command);
  }
  return result;
}

function applyPlay(setup: GameSetup, state: GameState, commands: Command[]): ApplyResult {
  // Commands change this copy in place. A rejection throws the copy away, so nothing from the play is kept.
  const game = copy(state);
  game.alerts = [];
  let needsOutcome = false;
  for (const command of commands) {
    if (needsOutcome && command.kind !== 'ball_in_play') return { ok: false, code: 'in_play_needs_outcome' };
    if (game.status !== 'pregame' && command.kind === 'ball_in_play' && !needsOutcome) {
      return { ok: false, code: 'ball_in_play_needs_pitch' };
    }
    const code = applyCommand(setup, game, command);
    if (code) return { ok: false, code };
    needsOutcome = command.kind === 'pitch' && command.result === 'in_play';
  }
  if (needsOutcome) return { ok: false, code: 'in_play_needs_outcome' };
  return { ok: true, state: game };
}

function copy(state: GameState): GameState {
  return {
    ...state,
    count: { ...state.count },
    bases: { ...state.bases },
    score: { ...state.score },
    lineups: { home: [...state.lineups.home], away: [...state.lineups.away] },
    nextBatter: { ...state.nextBatter },
    pitchers: { ...state.pitchers },
    pitchCounts: { ...state.pitchCounts },
    alerts: [...state.alerts],
  };
}

function applyCommand(setup: GameSetup, game: GameState, command: Command): RejectCode | null {
  if (!namedPlayers(command).every(({ player, side }) => onRoster(setup, player, side))) return 'unknown_player';
  if (command.kind === 'game') return applyControl(game, command.control);
  if (game.status === 'pregame') return 'game_not_started';
  switch (command.kind) {
    case 'pitch':
      return pitch(setup, game, command.result);
    case 'ball_in_play':
      return ballInPlay(setup, game, command);
    default:
      return 'not_implemented';
  }
}

function applyControl(game: GameState, control: GameControl): RejectCode | null {
  switch (control.kind) {
    case 'lineup_set':
      if (game.status !== 'pregame') return 'game_already_started';
      game.lineups[control.side] = control.lineup;
      return null;
    case 'start': {
      if (game.status !== 'pregame') return 'game_already_started';
      const home = pitcherIn(game.lineups.home);
      const away = pitcherIn(game.lineups.away);
      if (!home || !away) return 'no_pitcher';
      game.status = 'in_progress';
      game.umpireStart = control.umpireStart;
      game.pitchers = { home, away };
      game.pitchCounts[home.id] ??= 0;
      game.pitchCounts[away.id] ??= 0;
      return null;
    }
    default:
      return game.status === 'pregame' ? 'game_not_started' : 'not_implemented';
  }
}

function pitch(setup: GameSetup, game: GameState, result: PitchResult): RejectCode | null {
  const pitcher = game.pitchers[fielding(game)];
  if (!pitcher) return 'no_pitcher';
  game.pitchCounts[pitcher.id] = (game.pitchCounts[pitcher.id] ?? 0) + 1;
  game.count.pitches += 1;
  switch (result) {
    case 'ball':
      game.count.balls += 1;
      if (game.count.balls === 4) awardFirst(setup, game, pitcher);
      break;
    case 'called_strike':
    case 'swinging_strike':
    case 'foul_tip':
      strike(setup, game);
      break;
    case 'foul':
      if (game.count.strikes < 2) game.count.strikes += 1;
      break;
    case 'hit_by_pitch':
      awardFirst(setup, game, pitcher);
      break;
  }
  return null;
}

function strike(setup: GameSetup, game: GameState) {
  game.count.strikes += 1;
  if (game.count.strikes === 3) batterOut(setup, game);
}

const batterDestinations: Record<BallInPlayOutcome, Destination | null> = {
  single: 1,
  double: 2,
  ground_rule_double: 2,
  triple: 3,
  home_run: 'home',
  out: 'out',
  sacrifice_fly: 'out',
  sacrifice_bunt: 'out',
  error: 1,
  fielders_choice: 1,
  double_play: null,
  triple_play: null,
};

function ballInPlay(setup: GameSetup, game: GameState, command: Extract<Command, { kind: 'ball_in_play' }>): RejectCode | null {
  if (!setup.rules.bunting && (command.trajectory === 'bunt' || command.outcome === 'sacrifice_bunt')) return 'bunting_not_allowed';
  const batter: Runner = { player: batterUp(game), chargedTo: game.pitchers[fielding(game)]! };
  const active: { from: 0 | Base; runner: Runner }[] = [{ from: 0, runner: batter }];
  for (const from of [1, 2, 3] as const) {
    const runner = game.bases[from];
    if (runner) active.push({ from, runner });
  }
  const destinations: { from: 0 | Base; runner: Runner; to: Destination }[] = [];
  if (!command.advances.some((advance) => samePlayer(advance.runner, batter.player))) {
    const to = batterDestinations[command.outcome];
    if (to === null) return 'batter_destination_missing';
    destinations.push({ from: 0, runner: batter, to });
  }
  const seen = new Set<string>();
  for (const advance of command.advances) {
    const key = `${advance.runner.kind}:${advance.runner.id}`;
    if (seen.has(key)) return 'duplicate_runner';
    seen.add(key);
    const source = active.find(({ runner }) => samePlayer(runner.player, advance.runner));
    if (!source) return 'runner_not_on_base';
    destinations.push({ ...source, to: advance.to });
  }
  const recordedOuts = destinations.filter(({ to }) => to === 'out').length;
  const expectedOuts = command.outcome === 'double_play' ? 2 : command.outcome === 'triple_play' ? 3 : null;
  if (expectedOuts !== null && recordedOuts !== expectedOuts) return 'outs_dont_match_outcome';
  const bases = { ...game.bases };
  for (const { from } of destinations) {
    if (from !== 0) delete bases[from];
  }
  for (const { runner, to } of destinations) {
    if (typeof to === 'number') {
      if (bases[to]) return 'base_occupied';
      bases[to] = runner;
    }
  }
  let forceThrough = 0;
  for (const base of [1, 2, 3] as const) {
    if (!game.bases[base]) break;
    forceThrough = base;
  }
  let outs: number = game.outs;
  let thirdOutPreventsRuns = false;
  const hitRecorded = ['single', 'double', 'ground_rule_double', 'triple', 'home_run'].includes(command.outcome);
  for (const { from, to } of destinations) {
    if (to !== 'out') continue;
    outs += 1;
    if (outs === 3) thirdOutPreventsRuns = !hitRecorded && from <= forceThrough;
    forceThrough = Math.min(forceThrough, from - 1);
  }
  game.bases = bases;
  if (!thirdOutPreventsRuns) {
    for (const { to } of destinations) {
      if (to === 'home') scoreRun(game);
    }
  }
  endAtBat(setup, game);
  if (outs >= 3) endHalf(game);
  else game.outs = outs as GameState['outs'];
  return null;
}

function samePlayer(a: PlayerRef, b: PlayerRef): boolean {
  return a.kind === b.kind && a.id === b.id;
}

/** Puts the batter on first. Each runner forced off a base moves up one, and a runner forced off third scores. */
function awardFirst(setup: GameSetup, game: GameState, pitcher: PlayerRef) {
  const { bases } = game;
  if (bases[1]) {
    if (bases[2]) {
      if (bases[3]) scoreRun(game);
      bases[3] = bases[2];
    }
    bases[2] = bases[1];
  }
  bases[1] = { player: batterUp(game), chargedTo: pitcher } satisfies Runner;
  endAtBat(setup, game);
}

function batterOut(setup: GameSetup, game: GameState) {
  endAtBat(setup, game);
  if (game.outs === 2) {
    endHalf(game);
  } else {
    game.outs += 1;
  }
}

function endAtBat(setup: GameSetup, game: GameState) {
  const side = batting(game);
  game.nextBatter[side] = (game.nextBatter[side] + 1) % game.lineups[side].length;
  game.count = { ...setup.rules.startingCount, pitches: 0 };
}

function endHalf(game: GameState) {
  game.outs = 0;
  game.bases = {};
  game.runsThisHalf = 0;
  if (game.half === 'top') {
    game.half = 'bottom';
  } else {
    game.half = 'top';
    game.inning += 1;
  }
}

function scoreRun(game: GameState) {
  game.score[batting(game)] += 1;
  game.runsThisHalf += 1;
}

function batting(game: GameState): TeamSide {
  return game.half === 'top' ? 'away' : 'home';
}

function fielding(game: GameState): TeamSide {
  return game.half === 'top' ? 'home' : 'away';
}

function batterUp(game: GameState): PlayerRef {
  const side = batting(game);
  return game.lineups[side][game.nextBatter[side]]!.player;
}

function pitcherIn(lineup: LineupSlot[]): PlayerRef | undefined {
  return lineup.find((slot) => slot.position === 'P')?.player;
}

/** Every player a command names, with the side whose roster they must be on when the command says. */
function namedPlayers(command: Command): { player: PlayerRef; side: TeamSide | null }[] {
  switch (command.kind) {
    case 'game': {
      const { control } = command;
      return control.kind === 'lineup_set' ? control.lineup.map((slot) => ({ player: slot.player, side: control.side })) : [];
    }
    case 'runner':
      return [{ player: command.runner, side: null }];
    case 'ball_in_play':
      return command.advances.map((advance) => ({ player: advance.runner, side: null }));
    case 'substitution': {
      const { change, side } = command;
      const players = 'out' in change ? [change.in, change.out] : [change.in];
      return players.map((player) => ({ player, side }));
    }
    case 'correct':
      return command.replacement.flatMap(namedPlayers);
    case 'pitch':
    case 'batter_out':
    case 'undo':
      return [];
  }
}

function onRoster(setup: GameSetup, player: PlayerRef, side: TeamSide | null): boolean {
  const lists = side ? [setup.roster[side]] : [setup.roster.home, setup.roster.away];
  return lists.some((list) => list.some((p) => p.kind === player.kind && p.id === player.id));
}
