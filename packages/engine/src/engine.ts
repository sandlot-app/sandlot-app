import type { Command, GameSetup, GameState } from './types.ts';

export type RejectCode = 'not_implemented' | 'bunting_not_allowed';

export type ApplyResult =
  | { ok: true; state: GameState }
  | { ok: false; code: RejectCode };

export function initialState(_setup: GameSetup): GameState {
  return {
    status: 'pregame',
    inning: 1,
    half: 'top',
    outs: 0,
    count: { balls: 0, strikes: 0, pitches: 0 },
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

export function apply(_setup: GameSetup, _state: GameState, _command: Command): ApplyResult {
  return { ok: false, code: 'not_implemented' };
}
