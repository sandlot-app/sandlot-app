import { applyGroup, presets, replay } from '@sandlot/engine';
import type { Command, Event, GameSetup, GameState, LineupSlot, PlayerRef, Position, PresetKey, TeamSide } from '@sandlot/engine';
import { readAnswer } from '../src/answer.ts';
import { toCommands } from '../src/commands.ts';
import type { PressGame, RosterEntry } from '../src/state.ts';
import { expandShort, type Short } from './short.ts';

const positions: Position[] = ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'];
const away = positions.map((_, index) => ({ kind: 'opponent', id: `away-${index + 1}` }) as PlayerRef);
const home = positions.map((_, index) => ({ kind: 'player', id: `home-${index + 1}` }) as PlayerRef);

// The design's sample game: the Marlins bat first, so J. Soto leads off against T. Nguyen.
const awayNames = [['17', 'J. Soto'], ['3', 'L. Darcy'], ['8', 'C. Vance'], ['5', 'N. Cole'], ['11', 'P. Shah'], ['4', 'R. Diaz'], ['2', 'G. Ford'], ['14', 'H. Lin'], ['21', 'M. Webb']];
const homeNames = [['15', 'T. Nguyen'], ['12', 'M. Ortiz'], ['24', 'D. Park'], ['7', 'S. Bell'], ['3', 'A. Kindle'], ['6', 'J. Ruiz'], ['9', 'R. Hale'], ['1', 'K. Moss'], ['22', 'E. Brooks']];

export const roster: RosterEntry[] = [
  ...away.map((player, index) => ({ player, side: 'away' as const, number: awayNames[index]![0]!, name: awayNames[index]![1]! })),
  ...home.map((player, index) => ({ player, side: 'home' as const, number: homeNames[index]![0]!, name: homeNames[index]![1]! })),
];

export const entryByName = (name: string): RosterEntry => {
  const found = roster.find((entry) => entry.name === name);
  if (!found) throw new Error(`No player named ${name} on the sample roster`);
  return found;
};

export function setupFor(preset: PresetKey = 'moraga-mustang-second-half'): GameSetup {
  return { rules: presets[preset], roster: { home, away }, pitcherOutsEarlierToday: {} };
}

/** Adds one play to the log, checked by the engine. A test play the engine refuses is a bug in the test, so it throws. */
export function append(game: PressGame, group: string, commands: Command[]): PressGame {
  const result = applyGroup(game.setup, game.events, commands);
  if (!result.ok) throw new Error(`Test play ${group} was rejected: ${result.code}`);
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

/** A starting situation. `up` is the batter due up; `next` are the batters after them, in order; `on` maps base to runner. */
export type Sit = {
  half?: 'top' | 'bottom';
  outs?: 0 | 1 | 2;
  /** "balls-strikes", like "3-2". */
  count?: string;
  on?: Partial<Record<'1' | '2' | '3', string>>;
  up: string;
  next?: string[];
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
 * A started game in the situation `sit` describes. The batting side's lineup is ordered so that the plays that put
 * outs and runners on base come first and `up` is due next. Runners get on with hits that move only the batter.
 * Each player keeps the fielding position of their place on the sample roster.
 */
export function buildGame(sit: Sit, setup = setupFor()): PressGame {
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

  let game: PressGame = { setup, events: [], roster };
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

/** The game after one more play, given as an answer in the short spelling, for presses that come after it. */
export function withLastPlay(game: PressGame, last: Short): PressGame {
  const answer = readAnswer(expandShort(last));
  if (!answer || answer.result !== 'play') throw new Error(`Last play doesn't read: ${JSON.stringify(last)}`);
  const mapped = toCommands(game, stateOf(game), answer.readings[0]);
  if (!mapped.ok) throw new Error(`Last play doesn't map: ${JSON.stringify(mapped.why)}`);
  return append(game, 'last-play', mapped.commands);
}
