import type {
  Command,
  Event,
  GameControl,
  GameSetup,
  GameState,
  GroupId,
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
  | 'undo_not_latest'
  | 'cannot_undo_undo'
  | 'nothing_to_undo'
  | 'game_over'
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
  return foldHistory(setup, from, events);
}

/** `applyGroup` from a given state instead of the start. Fixtures use it to begin mid-game; the app and server never do. */
export function applyGroupFrom(setup: GameSetup, from: GameState, events: Event[], commands: Command[]): ApplyResult {
  return foldHistory(setup, from, events, commands);
}

type StoredPlay = { id: GroupId; commands: Command[] };

/** Splits the event log into plays: each run of events sharing a group. */
function plays(events: Event[]): StoredPlay[] {
  const result: StoredPlay[] = [];
  let group: Event['group'] | null = null;
  for (const event of events) {
    if (event.group !== group) result.push({ id: event.group, commands: [] });
    group = event.group;
    result[result.length - 1]!.commands.push(event.command);
  }
  return result;
}

function foldHistory(setup: GameSetup, from: GameState, events: Event[], pending?: Command[]): ApplyResult {
  let state = from;
  const active: StoredPlay[] = [];
  const undoGroups = new Set<GroupId>();

  function next(commands: Command[]): ApplyResult {
    const undo = commands.find((command) => command.kind === 'undo');
    if (!undo) return applyPlay(setup, state, commands);
    if (commands.length !== 1) return { ok: false, code: 'undo_not_latest' };
    if (state.status === 'pregame') return { ok: false, code: 'game_not_started' };
    if (undoGroups.has(undo.target)) return { ok: false, code: 'cannot_undo_undo' };
    const latest = active.at(-1);
    if (!latest) return { ok: false, code: 'nothing_to_undo' };
    if (latest.id !== undo.target) return { ok: false, code: 'undo_not_latest' };
    active.pop();
    let restored = from;
    for (const play of active) {
      const result = applyPlay(setup, restored, play.commands);
      if (!result.ok) return result;
      restored = result.state;
    }
    return { ok: true, state: restored };
  }

  for (const play of plays(events)) {
    const result = next(play.commands);
    if (!result.ok) return result;
    state = result.state;
    if (play.commands[0]?.kind === 'undo') undoGroups.add(play.id);
    else active.push(play);
  }
  return pending ? next(pending) : { ok: true, state };
}

function applyPlay(setup: GameSetup, state: GameState, commands: Command[]): ApplyResult {
  // Commands change this copy in place. A rejection throws the copy away, so nothing from the play is kept.
  const game = copy(state);
  game.alerts = [];
  for (const command of commands) {
    const code = applyCommand(setup, game, command);
    if (code) return { ok: false, code };
    if (game.status === 'in_progress' && game.half === 'bottom' && game.inning >= setup.rules.innings && game.score.home > game.score.away) {
      game.status = 'final';
    }
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
    pitchCounts: { ...state.pitchCounts },
    alerts: [...state.alerts],
  };
}

function applyCommand(setup: GameSetup, game: GameState, command: Command): RejectCode | null {
  if (game.status === 'final') return 'game_over';
  if (!namedPlayers(command).every(({ player, side }) => onRoster(setup, player, side))) return 'unknown_player';
  if (command.kind === 'game') return applyControl(setup, game, command.control);
  if (game.status === 'pregame') return 'game_not_started';
  switch (command.kind) {
    case 'pitch':
      return pitch(setup, game, command.result);
    default:
      return 'not_implemented';
  }
}

function applyControl(setup: GameSetup, game: GameState, control: GameControl): RejectCode | null {
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
    case 'end_half':
      if (game.status === 'pregame') return 'game_not_started';
      endHalf(setup, game);
      return null;
    case 'end_game':
      if (game.status === 'pregame') return 'game_not_started';
      game.status = 'final';
      return null;
  }
}

function pitch(setup: GameSetup, game: GameState, result: PitchResult): RejectCode | null {
  if (result === 'in_play') return 'not_implemented';
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
  game.count = { ...setup.rules.startingCount, pitches: 0 };
  game.bases = {};
  game.runsThisHalf = 0;
  if (game.inning >= setup.rules.innings) {
    const homeLeads = game.score.home > game.score.away;
    const tied = game.score.home === game.score.away;
    const lastInning = setup.rules.innings + (setup.rules.timeLimit?.extraInningsIfTiedBeforeLimit ?? 0);
    if ((game.half === 'top' && homeLeads) || (game.half === 'bottom' && (!tied || game.inning >= lastInning))) {
      game.status = 'final';
      return;
    }
  }
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
