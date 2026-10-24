import type {
  Command,
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
  | 'runner_not_on_base'
  | 'base_occupied'
  | 'invalid_runner_destination'
  | 'stealing_home_not_allowed'
  | 'balks_not_allowed'
  | 'pitcher_reentry_not_allowed'
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
    removedPitchers: { home: [], away: [] },
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
  for (const command of commands) {
    const code = applyCommand(setup, game, command);
    if (code) return { ok: false, code };
  }
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
    removedPitchers: { home: [...state.removedPitchers.home], away: [...state.removedPitchers.away] },
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
    case 'runner':
      return moveRunner(setup, game, command);
    case 'substitution':
      return command.change.kind === 'pitching_change'
        ? changePitcher(setup, game, command.side, command.change.in)
        : 'not_implemented';
    default:
      return 'not_implemented';
  }
}

function changePitcher(setup: GameSetup, game: GameState, side: TeamSide, incoming: PlayerRef): RejectCode | null {
  const current = game.pitchers[side];
  if (current?.kind === incoming.kind && current.id === incoming.id) return null;
  if (!setup.rules.pitcherReentry && game.removedPitchers[side].some((player) => player.kind === incoming.kind && player.id === incoming.id)) {
    return 'pitcher_reentry_not_allowed';
  }
  if (current) game.removedPitchers[side].push(current);
  game.pitchers[side] = incoming;
  game.pitchCounts[incoming.id] ??= 0;
  return null;
}

function moveRunner(setup: GameSetup, game: GameState, command: Extract<Command, { kind: 'runner' }>): RejectCode | null {
  if (command.event === 'balk' && !setup.rules.balks) return 'balks_not_allowed';
  if (!['stolen_base', 'caught_stealing', 'pickoff', 'wild_pitch', 'passed_ball', 'advance_on_error'].includes(command.event)) {
    return 'not_implemented';
  }
  const from = ([1, 2, 3] as const).find((base) => {
    const player = game.bases[base]?.player;
    return player?.kind === command.runner.kind && player.id === command.runner.id;
  });
  if (!from) return 'runner_not_on_base';
  const { to } = command;
  if (command.event === 'stolen_base' && to === 'home' && setup.rules.stealingHome === 'passed_ball_only') {
    return 'stealing_home_not_allowed';
  }
  if ((command.event === 'caught_stealing' || command.event === 'pickoff') && to !== 'out') return 'invalid_runner_destination';
  if (command.event === 'stolen_base' && to === 'out') return 'invalid_runner_destination';
  if (typeof to === 'number' && to <= from) return 'invalid_runner_destination';
  if (typeof to === 'number' && game.bases[to]) return 'base_occupied';
  const runner = game.bases[from]!;
  delete game.bases[from];
  if (to === 'out') {
    if (game.outs === 2) endHalf(setup, game);
    else game.outs += 1;
  } else if (to === 'home') scoreRun(game);
  else game.bases[to] = runner;
  return null;
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
  if (result === 'in_play') return 'not_implemented';
  const pitcher = game.pitchers[fielding(game)];
  if (!pitcher) return 'no_pitcher';
  game.pitchCounts[pitcher.id] = (game.pitchCounts[pitcher.id] ?? 0) + 1;
  game.count.pitches += 1;
  if (setup.rules.pitchCountTable === 'pitch_smart_9_10' && game.pitchCounts[pitcher.id] === 65) {
    game.alerts.push({ kind: 'pitch_count_near_limit', pitcher, remaining: 10 });
  }
  if (setup.rules.pitchCountTable === 'pitch_smart_9_10' && game.pitchCounts[pitcher.id] === 75) {
    game.alerts.push({ kind: 'pitch_count_at_limit', pitcher });
  }
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
    endHalf(setup, game);
  } else {
    game.outs += 1;
  }
}

function endAtBat(setup: GameSetup, game: GameState) {
  const side = batting(game);
  game.nextBatter[side] = (game.nextBatter[side] + 1) % game.lineups[side].length;
  game.count = { ...setup.rules.startingCount, pitches: 0 };
}

function endHalf(setup: GameSetup, game: GameState) {
  game.outs = 0;
  game.bases = {};
  game.runsThisHalf = 0;
  game.count = { ...setup.rules.startingCount, pitches: 0 };
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
