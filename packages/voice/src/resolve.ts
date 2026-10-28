import { applyGroup, replay } from '@sandlot/engine';
import type {
  Advance, Base, BallInPlayOutcome, Command, Destination, Event, GameSetup, GameState, PlayerRef, Position, TeamSide, Trajectory,
} from '@sandlot/engine';
import { closest, entryFor, matches, samePlayer } from './players.ts';
import type { Mention, RosterEntry, Spoken, Target } from './types.ts';

export type PressGame = { setup: GameSetup; events: Event[]; roster: RosterEntry[] };

/** Why a press can't become a reading, before the engine even checks it. */
export type Issue =
  | { kind: 'who_is'; heard: string; choices: RosterEntry[]; clause: number; role: 'batter' | 'runner' }
  | { kind: 'wrong_batter'; due: PlayerRef; named: PlayerRef; clause: number }
  | { kind: 'wrong_side'; player: PlayerRef }
  /** The pitcher named isn't the one in the game. `named` is null when the name matched nobody in the field. */
  | { kind: 'wrong_pitcher'; pitching: PlayerRef | null; named: PlayerRef | null; heard: string }
  /** Someone named in a fielding role, like the pitcher, who is batting this half. */
  | { kind: 'is_batting'; player: PlayerRef }
  | { kind: 'not_on_base'; player: PlayerRef }
  | { kind: 'no_runner'; base: Base | null }
  | { kind: 'not_strike_three'; strike: number }
  | { kind: 'not_ball_four'; ball: number }
  | { kind: 'needs_how' };

/** One way to record the press so far. `starts` marks where each clause's commands begin. */
export type Draft = { commands: Command[]; starts: number[] };

export type Resolution =
  | { kind: 'drafts'; drafts: Draft[]; question: string | null; judgment: boolean }
  /** `clause` is where the issue was found, and `before` holds the commands for the clauses ahead of it. */
  | { kind: 'issue'; issue: Issue; clause: number; before: Command[] };

const batting = (state: GameState): TeamSide => state.half === 'top' ? 'away' : 'home';
const fielding = (state: GameState): TeamSide => state.half === 'top' ? 'home' : 'away';
const dueUp = (state: GameState): PlayerRef | undefined => state.lineups[batting(state)][state.nextBatter[batting(state)]]?.player;

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

const runnersOn = (state: GameState): { base: Base; player: PlayerRef }[] =>
  ([1, 2, 3] as const).flatMap((base) => {
    const player = state.bases[base]?.player;
    return player ? [{ base, player }] : [];
  });

const next = (base: Base): Target => base === 3 ? 'home' : (base + 1) as Base;
const before = (target: Target): Base => target === 'home' ? 3 : (target - 1) as Base;

/** Destinations after the batter reaches `batterTo`: each runner the batter displaces moves one base past the player behind, the rest stay. */
function pushed(state: GameState, batterTo: 1 | 2 | 3): Advance[] {
  const advances: Advance[] = [];
  let behind: number = batterTo;
  for (const { base, player } of runnersOn(state)) {
    if (base > behind) break;
    const to = Math.min(behind + 1, 4);
    advances.push({ runner: player, to: to === 4 ? 'home' : to as Base });
    behind = to;
  }
  return advances;
}

type Expanded =
  | { kind: 'options'; options: Command[][]; replaceFrom?: number; question?: string; judgment?: boolean }
  | { kind: 'issue'; issue: Issue };

const options = (list: Command[][], question?: string): Expanded =>
  question && list.length > 1 ? { kind: 'options', options: list, question } : { kind: 'options', options: list };

/** Finds who a batter clause means, or the issue with it. The batter is always the one due up. */
function batterFor(game: PressGame, state: GameState, who: Mention | undefined, clause: number): PlayerRef | Issue {
  const lineup = state.lineups[batting(state)];
  const due = lineup[state.nextBatter[batting(state)]]?.player;
  if (!due) return { kind: 'no_runner', base: null };
  if (!who) return due;
  const found = who.player ? [entryFor(game.roster, who.player)!] : matches(game.roster, who, batting(state));
  if (found.length > 1) {
    const dueMatch = found.find((entry) => samePlayer(entry.player, due));
    if (dueMatch) return due;
    return { kind: 'who_is', heard: who.name ?? `number ${who.number}`, choices: found, clause, role: 'batter' };
  }
  const named = found[0];
  if (!named) {
    if (who.name && matches(game.roster, who, fielding(state)).length) return { kind: 'wrong_side', player: matches(game.roster, who, fielding(state))[0]!.player };
    const lineupEntries = lineup.flatMap(({ player }) => entryFor(game.roster, player) ?? []);
    const dueEntry = entryFor(game.roster, due);
    const choices = [...new Set([...(dueEntry ? [dueEntry] : []), ...closest(lineupEntries, who.name ?? `#${who.number}`)])].slice(0, 2);
    return { kind: 'who_is', heard: who.name ?? `number ${who.number}`, choices, clause, role: 'batter' };
  }
  if (named.side !== batting(state)) return { kind: 'wrong_side', player: named.player };
  return samePlayer(named.player, due) ? due : { kind: 'wrong_batter', due, named: named.player, clause };
}

/** Checks the pitcher a call names against the one in the game. Only a pitcher named by role or pronoun goes unchecked. */
function pitcherIssue(game: PressGame, state: GameState, who: Mention | undefined): Issue | null {
  if (!who) return null;
  const pitching = state.pitchers[fielding(state)] ?? null;
  const heard = who.name ?? `number ${who.number}`;
  const found = who.player ? [entryFor(game.roster, who.player)!] : matches(game.roster, who, fielding(state));
  if (pitching && found.some((entry) => samePlayer(entry.player, pitching))) return null;
  const inField = found.find((entry) => entry.side === fielding(state));
  if (inField) return { kind: 'wrong_pitcher', pitching, named: inField.player, heard };
  if (found[0]) return { kind: 'is_batting', player: found[0].player };
  return { kind: 'wrong_pitcher', pitching, named: null, heard };
}

/** Finds which runner a clause means, among the runners on base, or the issue with it. */
function runnerFor(game: PressGame, state: GameState, who: Mention, clause: number): PlayerRef | Issue {
  if (who.base) return state.bases[who.base]?.player ?? { kind: 'no_runner', base: who.base };
  if (!runnersOn(state).length) return { kind: 'no_runner', base: null };
  const found = who.player ? [entryFor(game.roster, who.player)!] : matches(game.roster, who, batting(state));
  const onBase = found.filter((entry) => baseOf(state, entry.player));
  if (onBase.length > 1) return { kind: 'who_is', heard: who.name ?? `number ${who.number}`, choices: onBase, clause, role: 'runner' };
  const named = onBase[0] ?? found[0];
  if (!named) {
    if (who.name && matches(game.roster, who, fielding(state)).length) return { kind: 'wrong_side', player: matches(game.roster, who, fielding(state))[0]!.player };
    const onBase = runnersOn(state).flatMap(({ player }) => entryFor(game.roster, player) ?? []);
    return { kind: 'who_is', heard: who.name ?? `number ${who.number}`, choices: closest(onBase, who.name ?? `#${who.number}`), clause, role: 'runner' };
  }
  if (named.side !== batting(state)) return { kind: 'wrong_side', player: named.player };
  return baseOf(state, named.player) ? named.player : { kind: 'not_on_base', player: named.player };
}

const isIssue = (value: PlayerRef | Issue): value is Issue => !('id' in value);

function battedBall(outcome: BallInPlayOutcome, trajectory: Trajectory | null, fielder: Position | undefined, advances: Advance[]): Command[] {
  return [
    { kind: 'pitch', result: 'in_play' },
    { kind: 'ball_in_play', outcome, trajectory, fielders: fielder ? [fielder] : [], advances },
  ];
}

const hitOutcome: Record<1 | 2 | 3 | 4, BallInPlayOutcome> = { 1: 'single', 2: 'double', 3: 'triple', 4: 'home_run' };

/** Runner moves for steals, wild pitches and the like, when the clause names a runner or a base, or neither. */
function runnerMoves(game: PressGame, state: GameState, event: 'stolen_base' | 'caught_stealing' | 'wild_pitch' | 'passed_ball',
  who: Mention | undefined, to: Target | undefined, clause: number): Expanded {
  const out = event === 'caught_stealing';
  const command = (runner: PlayerRef, from: Base, target: Target | undefined): Command =>
    ({ kind: 'runner', event, runner, to: out ? 'out' : (target ?? next(from)) as Destination });
  if (who) {
    const runner = runnerFor(game, state, who, clause);
    if (isIssue(runner)) return { kind: 'issue', issue: runner };
    return options([[command(runner, baseOf(state, runner)!, to)]]);
  }
  if (to) {
    const from = before(to);
    const runner = state.bases[from]?.player;
    return runner ? options([[command(runner, from, to)]]) : { kind: 'issue', issue: { kind: 'no_runner', base: from } };
  }
  const runners = [...runnersOn(state)].reverse();
  if (!runners.length) return { kind: 'issue', issue: { kind: 'no_runner', base: null } };
  const single = runners.map(({ base, player }) => [command(player, base, undefined)]);
  const everyone = runners.map(({ base, player }) => command(player, base, undefined));
  return options(runners.length > 1 && !out && event !== 'stolen_base' ? [...single, everyone] : single, 'Which runner?');
}

/**
 * True when the play just named already put `runner` at `to`, so a call saying so only repeats it: "Ruiz takes first"
 * after he's hit, or "Soto scores" after his home run. A runner a hit left in place isn't one: saying where they are
 * is recorded on the hit, so they don't count as a runner held.
 */
function putThere(prior: GameState, now: GameState, context: Command[], runner: PlayerRef, to: Target): boolean {
  const play = context.find((command) => command.kind === 'ball_in_play');
  const due = dueUp(prior);
  const wasBatting = due !== undefined && samePlayer(due, runner);
  if (to !== 'home') return baseOf(now, runner) === to && !(play && baseOf(prior, runner) === to);
  if (play?.kind === 'ball_in_play') {
    const own = play.advances.find((advance) => samePlayer(advance.runner, runner));
    return own ? own.to === 'home' : wasBatting && play.outcome === 'home_run';
  }
  if (context.some((command) => command.kind === 'runner' && samePlayer(command.runner, runner))) {
    return context.some((command) => command.kind === 'runner' && samePlayer(command.runner, runner) && command.to === 'home');
  }
  // A walk or hit batter with the bases loaded puts the batter on first and forces the runner on third home.
  return context.every((command) => command.kind === 'pitch') && due !== undefined && baseOf(now, due) === 1
    && baseOf(prior, runner) === 3 && baseOf(now, runner) === null;
}

/** Everyone the call could mean whom the play just named already put at `to`, so the call is absorbed into that play. */
function absorbed(game: PressGame, prior: GameState, now: GameState, context: Command[], who: Mention | undefined, to: Target): PlayerRef[] {
  const side = batting(prior);
  const due = dueUp(prior);
  const involved = [...(due ? [due] : []), ...runnersOn(prior).map(({ player }) => player)];
  const named = !who ? involved
    : who.player ? involved.filter((player) => samePlayer(player, who.player!))
    : who.base ? involved.filter((player) => baseOf(prior, player) === who.base)
    : involved.filter((player) => matches(game.roster, who, side).some((entry) => samePlayer(entry.player, player)));
  return named.filter((player) => putThere(prior, now, context, player, to));
}

/** A runner's destination on the play just named: it edits that play rather than adding a new one, or adds nothing when it only repeats it. */
function destination(game: PressGame, draft: Draft, who: Mention | undefined, to: Target, clause: number): Expanded {
  const start = draft.starts.at(-1);
  if (start === undefined) return { kind: 'issue', issue: { kind: 'needs_how' } };
  const context = draft.commands.slice(start);
  const prior = stateAfter(game, draft.commands.slice(0, start));
  if (!prior) return { kind: 'issue', issue: { kind: 'needs_how' } };
  const now = stateAfter(game, draft.commands);
  if (now && absorbed(game, prior, now, context, who, to).length) return { kind: 'options', options: [context], replaceFrom: start };
  const play = context.find((command) => command.kind === 'ball_in_play');
  const runnerEvent = context.find((command) => command.kind === 'runner');
  if (!play && !runnerEvent) return { kind: 'issue', issue: { kind: 'needs_how' } };
  const already = (player: PlayerRef) => play?.kind === 'ball_in_play'
    ? play.advances.some((advance) => samePlayer(advance.runner, player) && advance.to === to)
    : context.some((command) => command.kind === 'runner' && samePlayer(command.runner, player) && command.to === to);
  let runners: PlayerRef[];
  if (who) {
    const runner = runnerFor(game, prior, who, clause);
    if (isIssue(runner)) return { kind: 'issue', issue: runner };
    runners = [runner];
  } else {
    const onBase = [...runnersOn(prior)].reverse().map(({ player }) => player);
    runners = onBase.filter((player) => !already(player));
    if (!runners.length) runners = onBase;
    if (!runners.length) return { kind: 'issue', issue: { kind: 'no_runner', base: null } };
  }
  const edit = (moved: PlayerRef[]): Command[] => {
    if (play?.kind === 'ball_in_play') {
      const kept = play.advances.filter((advance) => !moved.some((player) => samePlayer(player, advance.runner)));
      const added = moved.map((runner): Advance => ({ runner, to: to as Exclude<Destination, 'out'> }));
      return context.map((command) => command === play ? { ...play, advances: [...kept, ...added] } : command);
    }
    const event = runnerEvent!.kind === 'runner' ? runnerEvent!.event : 'wild_pitch';
    const kept = context.filter((command) => !(command.kind === 'runner' && moved.some((player) => samePlayer(player, command.runner))));
    const added = moved.map((runner): Command => ({ kind: 'runner', event, runner, to }));
    return [...kept, ...added].sort((a, b) => leadFirst(prior, a, b));
  };
  const choices = runners.length > 1 && !who ? [...runners.map((runner) => edit([runner])), edit(runners)] : [edit(runners)];
  return { kind: 'options', options: choices, replaceFrom: start, ...(choices.length > 1 ? { question: 'Which runner?' } : {}) };
}

/** Lead runner first, because the engine checks each runner's base as it moves them. */
function leadFirst(state: GameState, a: Command, b: Command): number {
  const base = (command: Command) => command.kind === 'runner' ? baseOf(state, command.runner) ?? 0 : 0;
  return base(b) - base(a);
}

function expand(game: PressGame, state: GameState, draft: Draft, play: Spoken, clause: number): Expanded {
  if (play.kind === 'pitch' || play.kind === 'walk' || play.kind === 'strikeout') {
    const pitcher = pitcherIssue(game, state, play.pitcher);
    if (pitcher) return { kind: 'issue', issue: pitcher };
    const batter = play.batter && batterFor(game, state, play.batter, clause);
    if (batter && isIssue(batter)) return { kind: 'issue', issue: batter };
  }
  switch (play.kind) {
    case 'pitch':
      if (play.result === 'strike') {
        return options([[{ kind: 'pitch', result: 'called_strike' }], [{ kind: 'pitch', result: 'swinging_strike' }]], 'Looking or swinging?');
      }
      return options([[{ kind: 'pitch', result: play.result }]]);
    case 'strikeout': {
      if (state.count.strikes !== 2) return { kind: 'issue', issue: { kind: 'not_strike_three', strike: state.count.strikes + 1 } };
      if (play.looking !== undefined) return options([[{ kind: 'pitch', result: play.looking ? 'called_strike' : 'swinging_strike' }]]);
      return options([[{ kind: 'pitch', result: 'called_strike' }], [{ kind: 'pitch', result: 'swinging_strike' }]], 'Looking or swinging?');
    }
    case 'walk':
      if (state.count.balls !== 3) return { kind: 'issue', issue: { kind: 'not_ball_four', ball: state.count.balls + 1 } };
      return options([[{ kind: 'pitch', result: 'ball' }]]);
    case 'hit':
    case 'out':
    case 'error':
    case 'reached': {
      const batter = batterFor(game, state, play.batter, clause);
      if (isIssue(batter)) return { kind: 'issue', issue: batter };
      if (play.kind === 'hit') {
        const runners = play.bases === 4
          ? runnersOn(state).map(({ player }): Advance => ({ runner: player, to: 'home' }))
          : pushed(state, play.bases);
        return options([battedBall(hitOutcome[play.bases], null, play.fielder, runners)]);
      }
      if (play.kind === 'out') return options([battedBall('out', play.trajectory, play.fielder, [])]);
      const asError = battedBall('error', null, play.fielder, pushed(state, 1));
      if (play.kind === 'error') return options([asError]);
      return { kind: 'options', options: [battedBall('single', null, play.fielder, pushed(state, 1)), asError], question: 'Hit or error?', judgment: true };
    }
    case 'steal':
      return runnerMoves(game, state, 'stolen_base', play.runner, play.to, clause);
    case 'caught_stealing':
      return runnerMoves(game, state, 'caught_stealing', play.runner, play.at, clause);
    case 'advance':
      return runnerMoves(game, state, play.event, play.runner, play.to, clause);
    case 'pickoff': {
      const pickoff = (runner: PlayerRef): Command[] => [{ kind: 'runner', event: 'pickoff', runner, to: 'out' }];
      if (!play.runner && !play.at) {
        const runners = [...runnersOn(state)].reverse();
        if (!runners.length) return { kind: 'issue', issue: { kind: 'no_runner', base: null } };
        return options(runners.map(({ player }) => pickoff(player)), 'Which runner?');
      }
      const runner = play.runner ? runnerFor(game, state, play.runner, clause)
        : state.bases[play.at!]?.player ?? { kind: 'no_runner' as const, base: play.at! };
      if (isIssue(runner)) return { kind: 'issue', issue: runner };
      return options([pickoff(runner)]);
    }
    case 'moves':
      return destination(game, draft, play.runner, play.to, clause);
    case 'scores':
      return destination(game, draft, play.runner, 'home', clause);
    case 'undo':
      return options([[]]);
  }
}

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

/** True when a runner ends up ahead of a runner who started in front of them, which can't happen on one play (the engine doesn't check it). */
export function passesRunner(game: PressGame, commands: Command[]): boolean {
  return units(commands).some(([start, end]) => {
    const state = stateAfter(game, commands.slice(0, start));
    if (!state) return false;
    const moves = commands.slice(start, end).flatMap((command): { runner: PlayerRef; to: Destination }[] =>
      command.kind === 'runner' ? [command] : command.kind === 'ball_in_play' ? command.advances : []);
    const ends = runnersOn(state).map(({ base, player }) => {
      const moved = moves.find((move) => samePlayer(move.runner, player));
      return moved ? rank(moved.to) : base;
    });
    return ends.some((behind, index) => ends.slice(index + 1).some((ahead) => behind !== null && ahead !== null && behind > ahead));
  });
}

/** Turns the clauses of a press into every way to record it. The engine still decides which of them are legal. */
export function resolve(game: PressGame, plays: Spoken[]): Resolution {
  let drafts: Draft[] = [{ commands: [], starts: [] }];
  let question: string | null = null;
  let judgment = false;
  for (const [clause, play] of plays.entries()) {
    const nextDrafts: Draft[] = [];
    for (const draft of drafts) {
      const state = stateAfter(game, draft.commands);
      if (!state) { nextDrafts.push(draft); continue; }
      const expanded = expand(game, state, draft, play, clause);
      if (expanded.kind === 'issue') return { kind: 'issue', issue: expanded.issue, clause, before: draft.commands };
      question ??= expanded.question ?? null;
      judgment ||= expanded.judgment ?? false;
      for (const option of expanded.options) {
        if (expanded.replaceFrom !== undefined) {
          nextDrafts.push({ commands: [...draft.commands.slice(0, expanded.replaceFrom), ...option], starts: [...draft.starts] });
        } else {
          nextDrafts.push({ commands: [...draft.commands, ...option], starts: [...draft.starts, draft.commands.length] });
        }
      }
    }
    drafts = nextDrafts;
  }
  return { kind: 'drafts', drafts, question, judgment };
}

export { batting, fielding };
