import type { Base, Command, PlayerRef, Position, TeamSide } from '@sandlot/engine';

/** A player the scorer can name. The app passes these in with each press; they never reach events, stats or logs. */
export type RosterEntry = { player: PlayerRef; side: TeamSide; number: string; name: string };

/** How a clause names a player: by name, jersey number or base, or not at all. `player` is set once a "Who is …?" button picks one. */
export type Mention = { name?: string; number?: string; base?: Base; player?: PlayerRef };

export type Target = Base | 'home';

/** What one clause of a press says, before it's tied to the players on the field. */
export type Spoken =
  /** `batter` is set only when a name came with it, like "Moss hit by pitch". */
  | { kind: 'pitch'; result: 'ball' | 'strike' | 'called_strike' | 'swinging_strike' | 'foul' | 'foul_tip' | 'hit_by_pitch'; batter?: Mention }
  | { kind: 'strikeout'; looking?: boolean; batter?: Mention }
  | { kind: 'walk'; batter?: Mention }
  | { kind: 'hit'; bases: 1 | 2 | 3 | 4; batter?: Mention; fielder?: Position }
  | { kind: 'out'; trajectory: 'ground' | 'fly' | 'line' | 'popup'; batter?: Mention; fielder?: Position }
  | { kind: 'error'; batter?: Mention; fielder?: Position }
  /** "Safe at first": hit or error is the scorer's call (C4). */
  | { kind: 'reached'; batter?: Mention; fielder?: Position }
  | { kind: 'steal'; runner?: Mention; to?: Target }
  | { kind: 'caught_stealing'; runner?: Mention; at?: Target }
  | { kind: 'pickoff'; runner?: Mention; at?: Base }
  | { kind: 'advance'; event: 'wild_pitch' | 'passed_ball'; runner?: Mention; to?: Target }
  /** A runner's destination on the play just named, like "Ruiz to third" after a single. */
  | { kind: 'moves'; runner?: Mention; to: Target }
  | { kind: 'scores'; runner?: Mention }
  | { kind: 'undo' };

export type ParseResult =
  /** `parts` holds the words each play came from, for messages like `Couldn't record "steals third"`. */
  | { kind: 'plays'; plays: Spoken[]; parts: string[] }
  | { kind: 'not_a_command'; question: boolean }
  | { kind: 'unclear' };

/** One way to record a press: the commands to save, and what the banner reads back. */
export type Reading = { commands: Command[]; readBack: string };

/** `runner_held`: a hit left a runner where they were, which the scorer confirms rather than the app assuming it. */
export type ConfirmReason = 'complex' | 'runner_held' | 'echo' | 'duplicate' | 'confirm_everything';

/** What the app does with a press, in the spec's section 3 order. */
export type Decision =
  | { kind: 'didnt_catch' }
  | { kind: 'no_play'; question: boolean }
  | { kind: 'unknown_phrase'; message: string }
  | { kind: 'undo' }
  | { kind: 'reject'; message: string; savePart?: Reading }
  | { kind: 'ask'; prompt: string; options: Reading[] }
  | { kind: 'confirm'; reading: Reading; reasons: ConfirmReason[] }
  | { kind: 'save'; reading: Reading };
