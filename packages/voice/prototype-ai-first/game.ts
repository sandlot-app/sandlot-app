// PROTOTYPE, THROWAWAY. Not production code. See run.ts for the question this answers.
// Builds a game situation from explicit engine commands, and summarizes how a press ended (the "end state" we compare).

import { applyGroup, replay } from '@sandlot/engine';
import type { Command, Event, GameState, LineupSlot, Position, TeamSide } from '@sandlot/engine';
import { nameOf } from '../src/players.ts';
import type { PressGame } from '../src/index.ts';
import type { RosterEntry } from '../src/types.ts';
import { roster, setupFor } from '../test/game.ts';

const positions: Position[] = ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'];

/** A starting situation. `up` is the batter due up; `next` are the batters after him, in order; `on` maps base to runner. */
export type Sit = {
  half?: 'top' | 'bottom';
  outs?: 0 | 1 | 2;
  /** "balls-strikes", like "3-2". */
  count?: string;
  on?: Partial<Record<'1' | '2' | '3', string>>;
  up: string;
  next?: string[];
};

export const entryByName = (name: string): RosterEntry => {
  const found = roster.find((entry) => entry.name === name);
  if (!found) throw new Error(`No player named ${name} on the sample roster`);
  return found;
};

/** Adds one play to the log, checked by the engine. A setup play that is rejected is a bug in a case, so it throws. */
export function append(game: PressGame, group: string, commands: Command[]): PressGame {
  const result = applyGroup(game.setup, game.events, commands);
  if (!result.ok) throw new Error(`Play ${group} was rejected: ${result.code}`);
  const events = [...game.events];
  for (const command of commands) {
    events.push({
      id: `event-${events.length + 1}`, gameId: 'game-1', seq: events.length + 1, group, lockEpoch: 1, source: 'voice',
      at: '2026-10-26T17:00:00.000Z', command,
    } as Event);
  }
  return { ...game, events };
}

export const stateOf = (game: PressGame): GameState => {
  const result = replay(game.setup, game.events);
  if (!result.ok) throw new Error(`Game doesn't replay: ${result.code}`);
  return result.state;
};

const lineupFor = (side: TeamSide, order?: RosterEntry[]): LineupSlot[] => {
  const natural = roster.filter((entry) => entry.side === side);
  return (order ?? natural).map((entry) => ({ player: entry.player, position: positions[natural.indexOf(entry)]! }));
};

const strikeout: Command[] = [1, 2, 3].map(() => ({ kind: 'pitch', result: 'swinging_strike' }) as Command);
const hit = (outcome: 'single' | 'double' | 'triple'): Command[] => [
  { kind: 'pitch', result: 'in_play' },
  { kind: 'ball_in_play', outcome, trajectory: null, fielders: [], advances: [] },
];

/**
 * A started game, in the situation `sit` describes. The batting side's lineup is ordered so that the plays that put outs
 * and runners on base come first and `up` is due next. The runners get on with hits that move only the batter.
 */
export function buildGame(sit: Sit): PressGame {
  const half = sit.half ?? 'top';
  const batting: TeamSide = half === 'top' ? 'away' : 'home';
  const mine = roster.filter((entry) => entry.side === batting);
  const up = entryByName(sit.up);
  const next = (sit.next ?? []).map(entryByName);
  const runners = (['3', '2', '1'] as const).flatMap((base) => sit.on?.[base] ? [{ base: Number(base) as 1 | 2 | 3, entry: entryByName(sit.on[base]) }] : []);
  const named = [up, ...next, ...runners.map(({ entry }) => entry)];
  if (named.some((entry) => entry.side !== batting) || new Set(named).size !== named.length) {
    throw new Error(`Situation names players not batting, or twice: ${JSON.stringify(sit)}`);
  }
  const free = mine.filter((entry) => !named.includes(entry));
  const outs = sit.outs ?? 0;
  const outBatters = free.slice(0, outs);
  const order = [...outBatters, ...runners.map(({ entry }) => entry), up, ...next, ...free.slice(outs)];

  let game: PressGame = { setup: setupFor(), events: [], roster };
  game = append(game, 'setup', [
    { kind: 'game', control: { kind: 'lineup_set', side: 'away', lineup: lineupFor('away', batting === 'away' ? order : undefined) } },
    { kind: 'game', control: { kind: 'lineup_set', side: 'home', lineup: lineupFor('home', batting === 'home' ? order : undefined) } },
    { kind: 'game', control: { kind: 'start', umpireStart: '2026-10-26T17:00:00.000Z' as never } },
  ]);
  if (half === 'bottom') for (const index of [1, 2, 3]) game = append(game, `top-out-${index}`, strikeout);
  outBatters.forEach((_, index) => { game = append(game, `out-${index + 1}`, strikeout); });
  for (const { base } of runners) game = append(game, `runner-${base}`, hit(base === 3 ? 'triple' : base === 2 ? 'double' : 'single'));
  const [balls, strikes] = (sit.count ?? '0-0').split('-').map(Number) as [number, number];
  if (balls > 3 || strikes > 2) throw new Error(`Bad count ${sit.count}`);
  const pitches: Command[] = [...Array(balls).fill({ kind: 'pitch', result: 'ball' }), ...Array(strikes).fill({ kind: 'pitch', result: 'called_strike' })];
  if (pitches.length) game = append(game, 'count', pitches);

  const state = stateOf(game);
  const due = state.lineups[batting][state.nextBatter[batting]]!.player;
  if (due.id !== up.player.id || state.outs !== outs || state.half !== half) throw new Error(`Situation didn't build: ${JSON.stringify(sit)}`);
  return game;
}

/** How a press ended, from the state before it to the state after. `runs` is the net change in the batting side's score. */
export type End = { runs: number; bases: Record<'1' | '2' | '3', string | null>; outs: number; count: string };

export function endState(game: PressGame, before: GameState, after: GameState): End {
  const batting: TeamSide = before.half === 'top' ? 'away' : 'home';
  const ended = after.half !== before.half || after.inning !== before.inning || after.status === 'final';
  const at = (base: 1 | 2 | 3) => {
    const player = after.bases[base]?.player;
    return player ? nameOf(game.roster, player) : null;
  };
  return {
    runs: after.score[batting] - before.score[batting],
    bases: { 1: at(1), 2: at(2), 3: at(3) },
    outs: ended ? 3 : after.outs,
    count: `${after.count.balls}-${after.count.strikes}`,
  };
}

export type Expect =
  | { do: 'save'; runs?: number; bases?: Partial<Record<'1' | '2' | '3', string>>; outs: number; count?: string }
  | { do: 'no_play' }
  | { do: 'ask' };

export function sameEnd(end: End, expect: Extract<Expect, { do: 'save' }>): boolean {
  return end.runs === (expect.runs ?? 0) && end.outs === expect.outs && end.count === (expect.count ?? '0-0') &&
    (['1', '2', '3'] as const).every((base) => end.bases[base] === (expect.bases?.[base] ?? null));
}

export const showEnd = (end: End) =>
  `runs ${end.runs}, 1st ${end.bases[1] ?? '-'}, 2nd ${end.bases[2] ?? '-'}, 3rd ${end.bases[3] ?? '-'}, outs ${end.outs}, count ${end.count}`;

export const showExpect = (expect: Expect) => expect.do === 'save'
  ? showEnd({ runs: expect.runs ?? 0, bases: { 1: expect.bases?.[1] ?? null, 2: expect.bases?.[2] ?? null, 3: expect.bases?.[3] ?? null }, outs: expect.outs, count: expect.count ?? '0-0' })
  : expect.do === 'no_play' ? 'not a play' : 'ask the scorer';
