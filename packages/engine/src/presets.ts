import type { RuleSet } from './types.ts';

// Moraga Baseball Association local rules over PONY.
// Source: https://www.moragabaseball.org/pony-rules/ (Mustang revised 2/2024, Pinto revised 4/2025).

const moragaMustang = {
  sport: 'baseball',
  innings: 6,
  completeGameInnings: 4,
  fielders: 9,
  pitcher: 'kid',
  battingOrder: 'continuous',
  freeSubstitution: true,
  pitcherReentry: false,
  walks: true,
  hitByPitchAwardsFirst: true,
  calledStrikes: true,
  startingCount: { balls: 0, strikes: 0 },
  maxPitchesPerBatter: null,
  foulWithTwoStrikesIsOut: false,
  stealing: 'after_pitch_crosses_plate',
  leadoffs: false,
  leavingEarly: 'allowed',
  droppedThirdStrike: false,
  infieldFly: false,
  balks: false,
  bunting: false,
  runLimit: null,
  mercy: [],
  timeLimit: { noNewInningAfterMinutes: 120, extraInningsIfTiedAtLimit: 1, extraInningsIfTiedBeforeLimit: 1 },
  pitchCountTable: 'pitch_smart_9_10',
  pitcherOutsPerDay: 6,
  minDefensiveInnings: 4,
  battingOutOfOrder: 'notify_umpire',
} as const satisfies RuleSet;

export const presets = {
  'moraga-mustang-first-half': moragaMustang,
  // Leadoffs and full stealing apply only if most coaches agreed before the season.
  'moraga-mustang-second-half': {
    ...moragaMustang,
    stealing: 'full',
    leadoffs: true,
    pitcherOutsPerDay: 9,
  },
  'moraga-pinto': {
    sport: 'baseball',
    innings: 6,
    completeGameInnings: null,
    fielders: 10,
    pitcher: 'coach',
    battingOrder: 'continuous',
    freeSubstitution: true,
    pitcherReentry: true,
    walks: false,
    hitByPitchAwardsFirst: false,
    calledStrikes: false,
    startingCount: { balls: 0, strikes: 0 },
    maxPitchesPerBatter: 6,
    foulWithTwoStrikesIsOut: false,
    stealing: 'none',
    leadoffs: false,
    leavingEarly: 'team_warning_then_out',
    droppedThirdStrike: false,
    infieldFly: false,
    balks: false,
    bunting: false,
    runLimit: { runs: 5, throughInning: 5 },
    mercy: [],
    timeLimit: { noNewInningAfterMinutes: 120, extraInningsIfTiedAtLimit: 1, extraInningsIfTiedBeforeLimit: 3 },
    pitchCountTable: null,
    pitcherOutsPerDay: null,
    minDefensiveInnings: null,
    battingOutOfOrder: 'one_out_penalty',
  },
} as const satisfies Record<string, RuleSet>;

export type PresetKey = keyof typeof presets;
