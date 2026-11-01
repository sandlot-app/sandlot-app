import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  applyGroup, battingLines, initialState, presets, replay,
  type Base, type Command, type Event, type EventId, type GameId, type GameSetup,
  type GameState, type GroupId, type OpponentId, type PlayerId, type PlayerRef, type Timestamp,
} from '../src/index.ts';

const at = '2026-10-25T17:00:00.000Z' as Timestamp;
const player = (side: 'home' | 'away', number: number): PlayerRef => side === 'home'
  ? { kind: 'player', id: `home-${number}` as PlayerId }
  : { kind: 'opponent', id: `away-${number}` as OpponentId };
const setup: GameSetup = {
  rules: presets['moraga-mustang-first-half'],
  roster: {
    home: Array.from({ length: 9 }, (_, index) => player('home', index + 1)),
    away: Array.from({ length: 9 }, (_, index) => player('away', index + 1)),
  },
  pitcherOutsEarlierToday: {},
};

function game() {
  const events: Event[] = [];
  const active: { group: GroupId; before: GameState }[] = [];
  let state = initialState(setup);
  let play = 0;
  function record(commands: Command[]) {
    const before = structuredClone(state);
    const result = applyGroup(setup, events, commands);
    expect(result.ok, JSON.stringify(commands)).toBe(true);
    if (!result.ok) throw new Error(result.code);
    const group = `property-play-${++play}` as GroupId;
    for (const command of commands) {
      const seq = events.length + 1;
      events.push({ id: `property-event-${seq}` as EventId, gameId: 'property-game' as GameId, seq, group, lockEpoch: 1, source: 'tap', at, command });
    }
    state = result.state;
    if (commands[0]?.kind !== 'undo') active.push({ group, before });
    expect(state.outs).toBeGreaterThanOrEqual(0);
    expect(state.outs).toBeLessThanOrEqual(2);
    const runners = Object.values(state.bases).map(({ player: runner }) => `${runner.kind}:${runner.id}`);
    expect(new Set(runners).size).toBe(runners.length);
    expect(Object.keys(state.bases).every((base) => ['1', '2', '3'].includes(base))).toBe(true);
    expect(replay(setup, events)).toEqual(result);
  }
  function undo() {
    const latest = active.pop();
    if (!latest) throw new Error('No play to undo');
    record([{ kind: 'undo', target: latest.group }]);
    expect(state).toEqual(latest.before);
  }
  for (const side of ['away', 'home'] as const) {
    record([{ kind: 'game', control: { kind: 'lineup_set', side, lineup: setup.roster[side].map((runner, index) => ({ player: runner, position: index === 0 ? 'P' : null })) } }]);
  }
  record([{ kind: 'game', control: { kind: 'start', umpireStart: at } }]);
  active.length = 0;
  return { record, undo, get state() { return state; }, get canUndo() { return active.length > 0; } };
}

function hit(state: GameState, outcome: 'single' | 'double' | 'triple' | 'home_run'): Command[] {
  return [
    { kind: 'pitch', result: 'in_play' },
    { kind: 'ball_in_play', outcome, trajectory: 'line', fielders: ['LF'], advances: Object.values(state.bases).map(({ player: runner }) => ({ runner, to: 'home' })) },
  ];
}

const action = fc.record({
  kind: fc.constantFrom('ball', 'called_strike', 'swinging_strike', 'foul', 'foul_tip', 'hit_by_pitch', 'single', 'double', 'triple', 'home_run', 'out', 'runner', 'retire', 'undo'),
  choice: fc.nat({ max: 2 }),
});

describe('random games through the public event log', () => {
  it('keeps legal outs and occupancy, agrees with replay, and restores whole plays on undo', () => {
    fc.assert(fc.property(fc.array(action, { minLength: 20, maxLength: 70 }), (actions) => {
      const book = game();
      book.record(hit(book.state, 'single'));
      book.record([{ kind: 'runner', event: 'stolen_base', runner: book.state.bases[1]!.player, to: 2 }]);
      book.record(hit(book.state, 'double'));
      book.undo();
      for (const { kind, choice } of actions) {
        if (kind === 'undo') {
          if (book.canUndo) book.undo();
          continue;
        }
        if (book.state.status === 'final') continue;
        if (kind === 'single' || kind === 'double' || kind === 'triple' || kind === 'home_run') {
          book.record(hit(book.state, kind));
        } else if (kind === 'out') {
          book.record([{ kind: 'pitch', result: 'in_play' }, { kind: 'ball_in_play', outcome: 'out', trajectory: 'fly', fielders: ['CF'], advances: [] }]);
        } else if (kind === 'runner' || kind === 'retire') {
          const occupied = ([1, 2, 3] as Base[]).filter((base) => book.state.bases[base]);
          const base = occupied[choice % occupied.length];
          if (base === undefined) {
            book.record([{ kind: 'pitch', result: 'hit_by_pitch' }]);
          } else {
            const runner = book.state.bases[base]!.player;
            book.record([{ kind: 'runner', event: kind === 'retire' ? 'pickoff' : 'passed_ball', runner, to: kind === 'retire' ? 'out' : 'home' }]);
          }
        } else {
          book.record([{ kind: 'pitch', result: kind }]);
        }
      }
    }), { numRuns: 120 });
  });

  it('undoes every generated hit as one play including its pitch and runner advances', () => {
    fc.assert(fc.property(
      fc.constantFrom('single', 'double', 'triple', 'home_run'),
      fc.integer({ min: 0, max: 3 }),
      fc.integer({ min: 0, max: 2 }),
      (outcome, balls, strikes) => {
        const book = game();
        book.record(hit(book.state, 'single'));
        book.record([{ kind: 'runner', event: 'stolen_base', runner: book.state.bases[1]!.player, to: 2 }]);
        for (let index = 0; index < balls; index++) book.record([{ kind: 'pitch', result: 'ball' }]);
        for (let index = 0; index < strikes; index++) book.record([{ kind: 'pitch', result: 'called_strike' }]);
        const before = structuredClone(book.state);
        book.record(hit(book.state, outcome));
        expect(book.state.pitchCounts['home-1']).toBe(before.pitchCounts['home-1']! + 1);
        expect(book.state.score.away).toBeGreaterThan(before.score.away);
        book.undo();
        expect(book.state).toEqual(before);
      },
    ), { numRuns: 100 });
  });
});

type Standing = { group: GroupId; commands: Command[]; replaced?: Standing };

/** A log kept beside a model of the plays that stand, where a Fix swaps a play for its replacement and an Undo of that Fix swaps it back. */
function fixBook() {
  const events: Event[] = [];
  const standing: Standing[] = [];
  let groups = 0;
  const flat = (plays: Command[][]): Event[] => plays.flatMap((commands, group) => commands.map((command, index): Event => ({
    id: `flat-${group}-${index}` as EventId, gameId: 'property-game' as GameId, seq: 1, group: `flat-${group}` as GroupId, lockEpoch: 1, source: 'tap', at, command,
  })));
  function append(commands: Command[]): GroupId {
    const group = `fix-play-${++groups}` as GroupId;
    for (const command of commands) {
      const seq = events.length + 1;
      events.push({ id: `fix-event-${seq}` as EventId, gameId: 'property-game' as GameId, seq, group, lockEpoch: 1, source: 'tap', at, command });
    }
    return group;
  }
  function check() {
    const plays = standing.map(({ commands }) => commands);
    expect(replay(setup, events)).toEqual(replay(setup, flat(plays)));
    expect(battingLines(setup, events)).toEqual(battingLines(setup, flat(plays)));
  }
  function play(commands: Command[]) {
    if (!applyGroup(setup, events, commands).ok) return;
    standing.push({ group: append(commands), commands });
    check();
  }
  function fix(replacement: Command[]) {
    const latest = standing.at(-1)!;
    const wanted = applyGroup(setup, flat(standing.slice(0, -1).map(({ commands }) => commands)), replacement);
    const command: Command = { kind: 'correct', target: latest.group, replacement };
    const result = applyGroup(setup, events, [command]);
    expect(result.ok, JSON.stringify(replacement)).toBe(wanted.ok);
    if (!result.ok) {
      check();
      return;
    }
    standing.pop();
    standing.push({ group: append([command]), commands: replacement, replaced: latest });
    check();
  }
  function undo() {
    const latest = standing.pop()!;
    append([{ kind: 'undo', target: latest.group }]);
    if (latest.replaced) standing.push(latest.replaced);
    check();
  }
  for (const side of ['away', 'home'] as const) {
    play([{ kind: 'game', control: { kind: 'lineup_set', side, lineup: setup.roster[side].map((runner, index) => ({ player: runner, position: index === 0 ? 'P' : null })) } }]);
  }
  play([{ kind: 'game', control: { kind: 'start', umpireStart: at } }]);
  const opening = standing.length;
  return { play, fix, undo, get canChange() { return standing.length > opening; } };
}

describe('Fix and Undo through the public event log', () => {
  const play = (outcome: 'single' | 'double' | 'out'): Command[] => [
    { kind: 'pitch', result: 'in_play' },
    { kind: 'ball_in_play', outcome, trajectory: 'line', fielders: ['LF'], advances: [] },
  ];
  const replacements: Command[][] = [
    [{ kind: 'pitch', result: 'ball' }],
    [{ kind: 'pitch', result: 'called_strike' }, { kind: 'pitch', result: 'foul' }],
    play('out'),
    play('single'),
    [],
  ];
  const action = fc.record({
    kind: fc.constantFrom('ball', 'strike', 'single', 'double', 'out', 'fix', 'fix', 'undo', 'undo'),
    choice: fc.nat({ max: replacements.length - 1 }),
  });

  it('leaves the game, and every batting line, as if only the plays that stand were played', () => {
    fc.assert(fc.property(fc.array(action, { minLength: 10, maxLength: 60 }), (actions) => {
      const book = fixBook();
      for (const { kind, choice } of actions) {
        if (kind === 'fix') {
          if (book.canChange) book.fix(replacements[choice]!);
        } else if (kind === 'undo') {
          if (book.canChange) book.undo();
        } else if (kind === 'ball' || kind === 'strike') {
          book.play([{ kind: 'pitch', result: kind === 'ball' ? 'ball' : 'called_strike' }]);
        } else {
          book.play(play(kind));
        }
      }
    }), { numRuns: 200 });
  });
});
