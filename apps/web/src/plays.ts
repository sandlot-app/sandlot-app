import { applyGroup, ENGINE_VERSION, EVENT_SCHEMA_VERSION, initialState } from '@sandlot/engine';
import type {
  BallInPlayOutcome,
  Base,
  BatterOutReason,
  Command,
  Destination,
  Event,
  GameControl,
  GameSetup,
  GameState,
  GroupId,
  Half,
  PitchResult,
  Position,
  RunnerEvent,
  Substitution,
  TeamSide,
  Timestamp,
  Trajectory,
} from '@sandlot/engine';
import { playerLabel } from './roster.ts';
import type { Pins } from './snapshot.ts';

export type Score = GameState['score'];

/** Outs and occupied bases right after a play. Three outs means the play ended the half-inning. */
export type Situation = { outs: 0 | 1 | 2 | 3; runners: Base[] };

/** One scorer action, as the family reads it. Position and score are null when this page cannot replay the game. */
export type Play = {
  group: GroupId;
  at: Timestamp;
  text: string;
  scoreAfter: Score | null;
  inning: number | null;
  half: Half | null;
  situation: Situation | null;
  /** Whether something happened on the field that a camera could catch, unlike a lineup or an inning change. */
  onField: boolean;
};

export type Timeline = { plays: Play[]; state: GameState | null };

const POSITION_NAME: Record<Position, string> = {
  P: 'the pitcher',
  C: 'the catcher',
  '1B': 'first',
  '2B': 'second',
  '3B': 'third',
  SS: 'short',
  LF: 'left',
  CF: 'center',
  RF: 'right',
  ROVER: 'the rover',
};

const DESTINATION_NAME: Record<Destination, string> = { 1: '1st', 2: '2nd', 3: '3rd', home: 'home', out: 'out' };

const PITCH_TEXT: Record<PitchResult, string> = {
  ball: 'Ball',
  called_strike: 'Strike looking',
  swinging_strike: 'Strike swinging',
  foul: 'Foul',
  foul_tip: 'Foul tip',
  hit_by_pitch: 'Hit by pitch',
  in_play: 'In play',
};

const AT_BAT_ENDING_PITCH_TEXT: Partial<Record<PitchResult, (batter: string) => string>> = {
  ball: (batter) => `Ball four, ${batter} walks`,
  called_strike: (batter) => `${batter} strikes out looking`,
  swinging_strike: (batter) => `${batter} strikes out swinging`,
  foul_tip: (batter) => `${batter} strikes out on a foul tip`,
  hit_by_pitch: (batter) => `${batter} is hit by a pitch`,
};

const OUT_BY_TRAJECTORY: Record<Trajectory, string> = {
  ground: 'grounds out',
  line: 'lines out',
  fly: 'flies out',
  popup: 'pops out',
  bunt: 'bunts out',
};

const BALL_IN_PLAY_TEXT: Record<BallInPlayOutcome, (trajectory: Trajectory | null) => string> = {
  single: () => 'singles',
  double: () => 'doubles',
  ground_rule_double: () => 'hits a ground-rule double',
  triple: () => 'triples',
  home_run: () => 'hits a home run',
  out: (trajectory) => (trajectory ? OUT_BY_TRAJECTORY[trajectory] : 'is out'),
  error: () => 'reaches on an error',
  fielders_choice: () => "reaches on a fielder's choice",
  sacrifice_fly: () => 'hits a sacrifice fly',
  sacrifice_bunt: () => 'lays down a sacrifice bunt',
  double_play: () => 'hits into a double play',
  triple_play: () => 'hits into a triple play',
};

const BATTER_OUT_TEXT: Record<BatterOutReason, string> = {
  thrown_bat: 'is out for throwing the bat',
  batting_out_of_order: 'is out for batting out of order',
  max_pitches: 'is out at the pitch limit',
};

const END_GAME_TEXT: Record<Extract<GameControl, { kind: 'end_game' }>['reason'], string> = {
  final: 'Game over',
  called: 'Game called',
  time_limit: 'Game ended at the time limit',
};

const moves = (to: Destination): string =>
  to === 'home' ? 'scores' : to === 'out' ? 'is out' : `advances to ${DESTINATION_NAME[to]}`;

const RUNNER_TEXT: Record<RunnerEvent, (runner: string, to: Destination) => string> = {
  stolen_base: (runner, to) => `${runner} steals ${DESTINATION_NAME[to]}`,
  caught_stealing: (runner) => `${runner} is caught stealing`,
  pickoff: (runner) => `${runner} is picked off`,
  wild_pitch: (runner, to) => `${runner} ${moves(to)} on a wild pitch`,
  passed_ball: (runner, to) => `${runner} ${moves(to)} on a passed ball`,
  balk: (runner, to) => `${runner} ${moves(to)} on a balk`,
  advance_on_error: (runner, to) => `${runner} ${moves(to)} on an error`,
  defensive_indifference: (runner, to) => `${runner} ${moves(to)} on defensive indifference`,
  left_early: (runner) => `${runner} left the base early`,
  missed_base: (runner) => `${runner} missed a base`,
};

/** What one command's wording depends on: who was up when it happened, and whether it ended that at-bat. */
type CommandContext = { batter: string | null; endsAtBat: boolean };

const NO_CONTEXT: CommandContext = { batter: null, endsAtBat: false };

function fielderText(fielders: Position[]): string {
  const [first, ...rest] = fielders;
  if (!first) return '';
  return rest.length === 0 ? ` to ${POSITION_NAME[first]} (${first})` : `, ${fielders.join(' to ')}`;
}

function substitutionText(side: TeamSide, change: Substitution): string {
  switch (change.kind) {
    case 'pinch_hitter':
      return `${playerLabel(change.in.id)} pinch hits for ${playerLabel(change.out.id)}`;
    case 'pinch_runner':
      return `${playerLabel(change.in.id)} pinch runs for ${playerLabel(change.out.id)}`;
    case 'courtesy_runner':
      return `${playerLabel(change.in.id)} runs for ${playerLabel(change.out.id)}`;
    case 'defensive':
      return `${playerLabel(change.in.id)} enters at ${change.position}`;
    case 'pitching_change':
      return `${playerLabel(change.in.id)} now pitching (${side})`;
    case 'late_arrival':
      return `${playerLabel(change.in.id)} added to the lineup (${side})`;
  }
}

function controlText(control: GameControl): string {
  switch (control.kind) {
    case 'lineup_set':
      return `Lineup set (${control.side})`;
    case 'start':
      return 'Game started';
    case 'end_half':
      return 'Half-inning ended';
    case 'end_game':
      return END_GAME_TEXT[control.reason];
  }
}

function commandText(command: Command, { batter, endsAtBat }: CommandContext): string {
  const who = batter ?? 'Batter';
  switch (command.kind) {
    case 'pitch': {
      const endingText = endsAtBat ? AT_BAT_ENDING_PITCH_TEXT[command.result] : undefined;
      return endingText ? endingText(who) : PITCH_TEXT[command.result];
    }
    case 'ball_in_play':
      return `${who} ${BALL_IN_PLAY_TEXT[command.outcome](command.trajectory)}${fielderText(command.fielders)}`;
    case 'runner':
      return RUNNER_TEXT[command.event](playerLabel(command.runner.id), command.to);
    case 'batter_out':
      return `${who} ${BATTER_OUT_TEXT[command.reason]}`;
    case 'substitution':
      return substitutionText(command.side, command.change);
    case 'game':
      return controlText(command.control);
    case 'undo':
      return 'Undo';
    case 'correct':
      return 'Correction';
  }
}

/** The pitch that precedes a ball in play adds nothing to what the ball in play says. */
function groupText(commands: Command[], contexts: CommandContext[]): string {
  const hasBallInPlay = commands.some((command) => command.kind === 'ball_in_play');
  return commands
    .flatMap((command, i) =>
      hasBallInPlay && command.kind === 'pitch' && command.result === 'in_play' ? [] : [commandText(command, contexts[i] ?? NO_CONTEXT)],
    )
    .join('. ');
}

function safeGroupText(commands: Command[], contexts: CommandContext[]): string {
  try {
    return groupText(commands, contexts) || 'Play';
  } catch {
    // A game recorded by a newer version can hold commands this page has no wording for.
    return 'Play';
  }
}

type Group = { id: GroupId; at: Timestamp; commands: Command[]; start: number };

const ON_FIELD: ReadonlySet<Command['kind']> = new Set(['pitch', 'ball_in_play', 'runner']);

function splitGroups(events: Event[]): Group[] {
  const groups: Group[] = [];
  events.forEach((event, start) => {
    const last = groups.at(-1);
    if (last && last.id === event.group) last.commands.push(event.command);
    else groups.push({ id: event.group, at: event.at, commands: [event.command], start });
  });
  return groups;
}

type Replayed = { setup: GameSetup; initial: GameState; after: GameState[] };

function replayEachGroup(pins: Pins, events: Event[], groups: Group[]): Replayed | null {
  if (pins.engineVersion !== ENGINE_VERSION || pins.schemaVersion !== EVENT_SCHEMA_VERSION) return null;
  const setup: GameSetup = { ...pins.setup, rules: pins.rules };
  const after: GameState[] = [];
  for (const group of groups) {
    const result = applyGroup(setup, events.slice(0, group.start), group.commands);
    if (!result.ok) return null;
    after.push(result.state);
  }
  return { setup, initial: initialState(setup), after };
}

function undoTarget(group: Group): GroupId | null {
  const first = group.commands[0];
  return first?.kind === 'undo' ? first.target : null;
}

const battingSide = (half: Half): TeamSide => (half === 'top' ? 'away' : 'home');

const BASES: Base[] = [1, 2, 3];

function situationAfter(before: GameState, after: GameState): Situation {
  if (after.half !== before.half || after.inning !== before.inning) return { outs: 3, runners: [] };
  return { outs: after.outs, runners: BASES.filter((base) => after.bases[base]) };
}

function batterUp(state: GameState): string | null {
  const side = battingSide(state.half);
  const batter = state.lineups[side][state.nextBatter[side]]?.player;
  return batter ? playerLabel(batter.id) : null;
}

/** The count also resets when a runner makes the third out or the half ends, so only a new batter means the at-bat ended. */
function atBatEnded(before: GameState, after: GameState): boolean {
  const side = battingSide(before.half);
  return after.nextBatter[side] !== before.nextBatter[side];
}

/**
 * A play can hold several pitches, even more than one at-bat, so each command is judged against the state just before
 * it, found by replaying the play up to that command.
 */
function commandContexts(
  { setup }: Replayed,
  events: Event[],
  group: Group,
  before: GameState,
  after: GameState,
): CommandContext[] {
  const history = events.slice(0, group.start);
  const stateThrough = (i: number): GameState | null => {
    if (i === group.commands.length - 1) return after;
    const command = group.commands[i]!;
    // A pitch put in play has no state of its own until its outcome, which is judged against the state before it.
    if (command.kind === 'pitch' && command.result === 'in_play') return null;
    const result = applyGroup(setup, history, group.commands.slice(0, i + 1));
    return result.ok ? result.state : null;
  };
  let state = before;
  return group.commands.map((_, i) => {
    const batter = batterUp(state);
    const next = stateThrough(i);
    if (!next) return { batter, endsAtBat: false };
    const endsAtBat = atBatEnded(state, next);
    state = next;
    return { batter, endsAtBat };
  });
}

/**
 * Turns the stored events into the play list and the current state. The engine replays each play so the list can
 * show the score after it. When the page cannot replay the game, the server's cached state stands in and plays
 * carry text only.
 */
export function buildTimeline(pins: Pins, events: Event[], serverState: GameState | null): Timeline {
  const groups = splitGroups(events);
  const replayed = replayEachGroup(pins, events, groups);
  const undone = new Set(groups.flatMap((group) => undoTarget(group) ?? []));
  const plays = groups.flatMap((group, index): Play[] => {
    if (undone.has(group.id)) return [];
    const before = replayed ? (index === 0 ? replayed.initial : replayed.after[index - 1]) : undefined;
    const after = replayed?.after[index];
    const contexts = replayed && before && after ? commandContexts(replayed, events, group, before, after) : [];
    return [
      {
        group: group.id,
        at: group.at,
        text: safeGroupText(group.commands, contexts),
        scoreAfter: after ? after.score : null,
        inning: before ? before.inning : null,
        half: before ? before.half : null,
        situation: before && after ? situationAfter(before, after) : null,
        onField: group.commands.some((command) => ON_FIELD.has(command.kind)),
      },
    ];
  });
  return { plays, state: replayed ? (replayed.after.at(-1) ?? replayed.initial) : serverState };
}
