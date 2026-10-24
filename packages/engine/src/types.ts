declare const brand: unique symbol;
type Brand<T, B extends string> = T & { readonly [brand]: B };

export type GameId = Brand<string, 'GameId'>;
export type EventId = Brand<string, 'EventId'>;
export type GroupId = Brand<string, 'GroupId'>;
export type PlayerId = Brand<string, 'PlayerId'>;
export type OpponentId = Brand<string, 'OpponentId'>;
/** One scorer's hold on a game, issued by the server when scoring is taken over. */
export type SessionId = Brand<string, 'SessionId'>;
/** ISO 8601 timestamp. The engine never reads a clock, so all time arrives as data. */
export type Timestamp = Brand<string, 'Timestamp'>;

export type Sport = 'baseball' | 'fastpitch' | 'slowpitch';
export type TeamSide = 'home' | 'away';
export type Half = 'top' | 'bottom';
export type Base = 1 | 2 | 3;
/** `ROVER` is the extra outfielder in 10-fielder divisions such as Moraga Pinto. */
export type Position = 'P' | 'C' | '1B' | '2B' | '3B' | 'SS' | 'LF' | 'CF' | 'RF' | 'ROVER';

export type PlayerRef =
  | { kind: 'player'; id: PlayerId }
  | { kind: 'opponent'; id: OpponentId };

export type RuleSet = {
  sport: Sport;
  innings: number;
  /** Innings after which a called game counts as complete. */
  completeGameInnings: number | null;
  fielders: 9 | 10;
  pitcher: 'kid' | 'coach' | 'machine';
  battingOrder: 'nine' | 'continuous';
  freeSubstitution: boolean;
  /** Whether a pitcher who leaves the mound may pitch again in the same game. */
  pitcherReentry: boolean;
  walks: boolean;
  hitByPitchAwardsFirst: boolean;
  calledStrikes: boolean;
  startingCount: { balls: number; strikes: number };
  /** The batter is out after this many pitches, unless the last one is fouled off. */
  maxPitchesPerBatter: number | null;
  /** Slowpitch: a foul with two strikes is an out. */
  foulWithTwoStrikesIsOut: boolean;
  stealing: 'none' | 'after_pitch_crosses_plate' | 'full';
  stealingHome: 'passed_ball_only' | 'allowed';
  leadoffs: boolean;
  /** What happens when a runner leaves the base before the ball is hit, in divisions without stealing. */
  leavingEarly: 'allowed' | 'team_warning_then_out';
  droppedThirdStrike: boolean;
  infieldFly: boolean;
  balks: boolean;
  bunting: boolean;
  /** Runs allowed per half-inning, through `throughInning`. Later innings have no limit. */
  runLimit: { runs: number; throughInning: number } | null;
  mercy: { afterInning: number; lead: number }[];
  timeLimit: {
    noNewInningAfterMinutes: number;
    extraInningsIfTiedAtLimit: number;
    extraInningsIfTiedBeforeLimit: number;
  } | null;
  pitchCountTable: 'pitch_smart_9_10' | null;
  /** Outs a pitcher may record in one calendar day, across every game that day. */
  pitcherOutsPerDay: number | null;
  minDefensiveInnings: number | null;
  battingOutOfOrder: 'notify_umpire' | 'one_out_penalty';
};

export type PitchResult =
  | 'ball'
  | 'called_strike'
  | 'swinging_strike'
  | 'foul'
  | 'foul_tip'
  | 'hit_by_pitch'
  | 'in_play';

export type BallInPlayOutcome =
  | 'single'
  | 'double'
  | 'ground_rule_double'
  | 'triple'
  | 'home_run'
  | 'out'
  | 'error'
  | 'fielders_choice'
  | 'sacrifice_fly'
  | 'sacrifice_bunt'
  | 'double_play'
  | 'triple_play';

export type Trajectory = 'ground' | 'line' | 'fly' | 'popup' | 'bunt';

export type Destination = Base | 'home' | 'out';

export type OutType = 'force' | 'batter_before_first' | 'non_force';

export type Advance =
  | { runner: PlayerRef; to: Exclude<Destination, 'out'>; outType?: never }
  | { runner: PlayerRef; to: 'out'; outType: OutType };

export type RunnerEvent =
  | 'stolen_base'
  | 'caught_stealing'
  | 'pickoff'
  | 'wild_pitch'
  | 'passed_ball'
  | 'balk'
  | 'advance_on_error'
  | 'defensive_indifference'
  | 'left_early'
  | 'missed_base';

export type BatterOutReason = 'thrown_bat' | 'batting_out_of_order' | 'max_pitches';

export type Substitution =
  | { kind: 'pinch_hitter' | 'pinch_runner' | 'courtesy_runner'; in: PlayerRef; out: PlayerRef }
  | { kind: 'defensive'; in: PlayerRef; position: Position }
  | { kind: 'pitching_change'; in: PlayerRef }
  | { kind: 'late_arrival'; in: PlayerRef };

export type LineupSlot = { player: PlayerRef; position: Position | null };

export type GameControl =
  | { kind: 'lineup_set'; side: TeamSide; lineup: LineupSlot[] }
  | { kind: 'start'; umpireStart: Timestamp }
  | { kind: 'end_half'; reason: 'manual' | 'time_limit' }
  | { kind: 'end_game'; reason: 'final' | 'called' | 'time_limit' };

export type Command =
  | { kind: 'pitch'; result: PitchResult }
  | {
      kind: 'ball_in_play';
      outcome: BallInPlayOutcome;
      trajectory: Trajectory | null;
      fielders: Position[];
      /** Destinations apply together. Outs follow list order, after any derived batter out. */
      advances: Advance[];
    }
  | { kind: 'runner'; event: RunnerEvent; runner: PlayerRef; to: Destination }
  | { kind: 'batter_out'; reason: BatterOutReason }
  | { kind: 'substitution'; side: TeamSide; change: Substitution }
  | { kind: 'game'; control: GameControl }
  | { kind: 'undo'; target: GroupId }
  | { kind: 'correct'; target: GroupId; replacement: Command[] };

export type Event = {
  id: EventId;
  gameId: GameId;
  /** Order within the game, starting at 1. */
  seq: number;
  /** One voice press or one tap action. Undo and corrections act on whole groups. */
  group: GroupId;
  /** Which scorer session wrote the event. */
  lockEpoch: number;
  source: 'tap' | 'voice';
  /** When the scorer started the action: the tap, or the start of the voice press. Every event in a group shares it. */
  at: Timestamp;
  command: Command;
};

export type GameSetup = {
  rules: RuleSet;
  /** Every player who may appear in the game, per side. The scorer's team are players, the other team opponents. */
  roster: Record<TeamSide, PlayerRef[]>;
  /** Outs each pitcher already recorded earlier on the same calendar day, in other games. */
  pitcherOutsEarlierToday: Partial<Record<PlayerId, number>>;
};

export type Runner = {
  player: PlayerRef;
  /** The pitcher charged if this runner scores. */
  chargedTo: PlayerRef | null;
};

export type Alert =
  | { kind: 'pitch_count_near_limit'; pitcher: PlayerRef; remaining: number }
  | { kind: 'pitch_count_at_limit'; pitcher: PlayerRef }
  | { kind: 'pitcher_outs_today_at_limit'; pitcher: PlayerRef }
  | { kind: 'run_limit_reached' }
  | { kind: 'time_limit_reached' }
  | { kind: 'defensive_innings_short'; player: PlayerRef; played: number };

export type GameState = {
  status: 'pregame' | 'in_progress' | 'final';
  inning: number;
  half: Half;
  outs: 0 | 1 | 2;
  count: { balls: number; strikes: number; pitches: number };
  bases: Partial<Record<Base, Runner>>;
  score: Record<TeamSide, number>;
  runsThisHalf: number;
  lineups: Record<TeamSide, LineupSlot[]>;
  /** Index into the batting side's lineup of the batter due up. */
  nextBatter: Record<TeamSide, number>;
  pitchers: Partial<Record<TeamSide, PlayerRef>>;
  removedPitchers: Record<TeamSide, PlayerRef[]>;
  /** Pitches thrown, keyed by player or opponent ID. */
  pitchCounts: Record<string, number>;
  umpireStart: Timestamp | null;
  alerts: Alert[];
};
