import type {
  BallInPlayOutcome,
  Base,
  Command,
  Destination,
  Event,
  GameControl,
  GameSetup,
  GameState,
  GroupId,
  LineupSlot,
  OutType,
  PitchResult,
  PlayerRef,
  Runner,
  TeamSide,
} from './types.ts';

/** Every reason the engine rejects a play. `docs/contract.md` lists each one, because the server returns it as `reason`. */
export const REJECT_CODES = [
  'not_implemented',
  'unknown_player',
  'game_not_started',
  'game_already_started',
  'no_pitcher',
  'ball_in_play_needs_pitch',
  'in_play_needs_outcome',
  'base_occupied',
  'runner_not_on_base',
  'duplicate_runner',
  'batter_destination_missing',
  'outs_dont_match_outcome',
  'too_many_outs',
  'invalid_out_type',
  'undo_not_latest',
  'undo_must_be_alone',
  'cannot_undo_undo',
  'nothing_to_undo',
  'game_over',
  'invalid_runner_destination',
  'stealing_home_not_allowed',
  'balks_not_allowed',
  'pitcher_reentry_not_allowed',
  'bunting_not_allowed',
  'runner_passed',
] as const;

export type RejectCode = (typeof REJECT_CODES)[number];

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
    if (commands.length !== 1) return { ok: false, code: 'undo_must_be_alone' };
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
  let needsOutcome = false;
  for (const step of steps(commands)) {
    const kind = Array.isArray(step) ? 'runner' : step.kind;
    if (needsOutcome && kind !== 'ball_in_play') return { ok: false, code: 'in_play_needs_outcome' };
    if (game.status === 'in_progress' && kind === 'ball_in_play' && !needsOutcome) {
      return { ok: false, code: 'ball_in_play_needs_pitch' };
    }
    const code = applyCommand(setup, game, step);
    if (code) return { ok: false, code };
    needsOutcome = !Array.isArray(step) && step.kind === 'pitch' && step.result === 'in_play';
    if (game.status === 'in_progress' && game.half === 'bottom' && game.inning >= setup.rules.innings && game.score.home > game.score.away) {
      game.status = 'final';
    }
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
    removedPitchers: { home: [...state.removedPitchers.home], away: [...state.removedPitchers.away] },
    pitchCounts: { ...state.pitchCounts },
    alerts: [...state.alerts],
  };
}

type RunnerCommand = Extract<Command, { kind: 'runner' }>;

/** One command, or the runner commands next to each other in a play, which all happen on the same play. */
type Step = Command | RunnerCommand[];

function steps(commands: Command[]): Step[] {
  const result: Step[] = [];
  for (const command of commands) {
    const last = result.at(-1);
    if (command.kind === 'runner' && Array.isArray(last)) last.push(command);
    else result.push(command.kind === 'runner' ? [command] : command);
  }
  return result;
}

function applyCommand(setup: GameSetup, game: GameState, step: Step): RejectCode | null {
  if (game.status === 'final') return 'game_over';
  const commands = Array.isArray(step) ? step : [step];
  if (!commands.flatMap(namedPlayers).every(({ player, side }) => onRoster(setup, player, side))) return 'unknown_player';
  if (!Array.isArray(step) && step.kind === 'game') return applyControl(setup, game, step.control);
  if (game.status === 'pregame') return 'game_not_started';
  if (Array.isArray(step)) return moveRunners(setup, game, step);
  const command = step;
  switch (command.kind) {
    case 'pitch':
      return pitch(setup, game, command.result);
    case 'ball_in_play':
      return ballInPlay(setup, game, command);
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

/**
 * Moves every runner on one play before the play's outs and runs count, so the third out or a winning run
 * ends the half only after all of them.
 */
function moveRunners(setup: GameSetup, game: GameState, commands: RunnerCommand[]): RejectCode | null {
  const outs = game.outs + commands.filter(({ to }) => to === 'out').length;
  if (outs > 3) return 'too_many_outs';
  const started = ([1, 2, 3] as const).flatMap((from) => {
    const runner = game.bases[from];
    return runner ? [{ from, player: runner.player }] : [];
  });
  for (const command of commands) {
    const code = moveRunner(setup, game, command);
    if (code) return code;
  }
  const finishes = started.map(({ from, player }) => ({
    from,
    to: commands.filter(({ runner }) => samePlayer(runner, player)).at(-1)?.to ?? from,
  }));
  if (passesRunner(finishes)) return 'runner_passed';
  // A runner event never makes a force out, so its runs count even when the play makes the third out (OBR 5.08(a)).
  const scored = commands.filter(({ to }) => to === 'home').length;
  const runs = game.half === 'bottom' && game.inning >= setup.rules.innings
    ? Math.min(scored, game.score.away - game.score.home + 1)
    : scored;
  for (let run = 0; run < runs; run++) scoreRun(game);
  if (outs === 3) endHalf(setup, game);
  else game.outs = outs as GameState['outs'];
  return null;
}

function moveRunner(setup: GameSetup, game: GameState, command: RunnerCommand): RejectCode | null {
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
  if (typeof to === 'number') game.bases[to] = runner;
  return null;
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
  const pitcher = game.pitchers[fielding(game)];
  if (!pitcher) return 'no_pitcher';
  game.pitchCounts[pitcher.id] = (game.pitchCounts[pitcher.id] ?? 0) + 1;
  game.count.pitches += 1;
  const limits = setup.rules.pitchCountLimits;
  const thrown = game.pitchCounts[pitcher.id];
  if (limits && thrown === limits.warnAt) {
    game.alerts.push({ kind: 'pitch_count_near_limit', pitcher, remaining: limits.limit - limits.warnAt });
  }
  if (limits && thrown === limits.limit) game.alerts.push({ kind: 'pitch_count_at_limit', pitcher });
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

type PlannedAdvance = { from: 0 | Base; runner: Runner } & (
  | { to: Exclude<Destination, 'out'>; outType?: never }
  | { to: 'out'; outType: OutType }
);

type BallInPlayPlan = { bases: GameState['bases']; runs: number; totalOuts: number };

function ballInPlay(setup: GameSetup, game: GameState, command: Extract<Command, { kind: 'ball_in_play' }>): RejectCode | null {
  if (!setup.rules.bunting && (command.trajectory === 'bunt' || command.outcome === 'sacrifice_bunt')) return 'bunting_not_allowed';
  const plan = planBallInPlay(game, command);
  if (typeof plan === 'string') return plan;
  game.bases = plan.bases;
  const runs = game.half === 'bottom' && game.inning >= setup.rules.innings && command.outcome !== 'home_run'
    ? Math.min(plan.runs, game.score.away - game.score.home + 1)
    : plan.runs;
  for (let run = 0; run < runs; run++) scoreRun(game);
  endAtBat(setup, game);
  if (plan.totalOuts >= 3) endHalf(setup, game);
  else game.outs = plan.totalOuts as GameState['outs'];
  return null;
}

function planBallInPlay(game: GameState, command: Extract<Command, { kind: 'ball_in_play' }>): BallInPlayPlan | RejectCode {
  const batter: Runner = { player: batterUp(game), chargedTo: game.pitchers[fielding(game)]! };
  const active: { from: 0 | Base; runner: Runner }[] = [{ from: 0, runner: batter }];
  for (const from of [1, 2, 3] as const) {
    const runner = game.bases[from];
    if (runner) active.push({ from, runner });
  }
  const destinations: PlannedAdvance[] = [];
  if (!command.advances.some((advance) => samePlayer(advance.runner, batter.player))) {
    const to = batterDestinations[command.outcome];
    if (to === null) return 'batter_destination_missing';
    destinations.push(to === 'out'
      ? { from: 0, runner: batter, to, outType: 'batter_before_first' }
      : { from: 0, runner: batter, to });
  }
  const seen = new Set<string>();
  for (const advance of command.advances) {
    const key = `${advance.runner.kind}:${advance.runner.id}`;
    if (seen.has(key)) return 'duplicate_runner';
    seen.add(key);
    const source = active.find(({ runner }) => samePlayer(runner.player, advance.runner));
    if (!source) return 'runner_not_on_base';
    destinations.push({ ...advance, ...source });
  }
  const recordedOuts = destinations.filter(({ to }) => to === 'out').length;
  const expectedOuts = command.outcome === 'double_play' ? 2 : command.outcome === 'triple_play' ? 3 : null;
  if (expectedOuts !== null && recordedOuts !== expectedOuts) return 'outs_dont_match_outcome';
  if (game.outs + recordedOuts > 3) return 'too_many_outs';
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
  const finishes = active.map(({ from }) => ({
    from,
    to: destinations.find((advance) => advance.from === from)?.to ?? from,
  }));
  if (passesRunner(finishes)) return 'runner_passed';
  let forceThrough = 0;
  for (const base of [1, 2, 3] as const) {
    if (!game.bases[base]) break;
    forceThrough = base;
  }
  let totalOuts: number = game.outs;
  let thirdOutPreventsRuns = false;
  const hitRecorded = ['single', 'double', 'ground_rule_double', 'triple', 'home_run'].includes(command.outcome);
  for (const advance of destinations) {
    if (advance.to !== 'out') continue;
    const { from, outType } = advance;
    if ((outType === 'batter_before_first' && from !== 0) ||
      (outType === 'force' && (from === 0 || from > forceThrough)) ||
      (hitRecorded && outType !== 'non_force')) return 'invalid_out_type';
    totalOuts += 1;
    if (totalOuts === 3) thirdOutPreventsRuns = outType !== 'non_force';
    forceThrough = Math.min(forceThrough, from - 1);
  }
  const runs = thirdOutPreventsRuns ? 0 : destinations.filter(({ to }) => to === 'home').length;
  return { bases, runs, totalOuts };
}

/** A runner who passes a runner ahead of them, before that runner is out, is out (OBR 5.09(b)(9)), so the play as recorded can't stand. */
function passesRunner(finishes: { from: 0 | Base; to: Destination | 0 }[]): boolean {
  const safe = finishes.flatMap(({ from, to }) => (to === 'out' ? [] : [{ from, at: to === 'home' ? 4 : to }]));
  return safe.some((trailing) => safe.some((lead) => lead.from > trailing.from && trailing.at > lead.at));
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
