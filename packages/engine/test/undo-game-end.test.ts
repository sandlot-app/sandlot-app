import { describe, expect, it } from 'vitest';
import {
  applyGroup,
  initialState,
  presets,
  replay,
  type Command,
  type Event,
  type EventId,
  type GameId,
  type GameSetup,
  type GameState,
  type GroupId,
  type OpponentId,
  type PlayerId,
  type PlayerRef,
  type Timestamp,
} from '../src/index.ts';

const at = '2026-10-25T17:00:00.000Z' as Timestamp;
const home = (n: number): PlayerRef => ({ kind: 'player', id: `home-${n}` as PlayerId });
const away = (n: number): PlayerRef => ({ kind: 'opponent', id: `away-${n}` as OpponentId });
const setup: GameSetup = {
  rules: presets['moraga-mustang-first-half'],
  roster: { home: Array.from({ length: 9 }, (_, i) => home(i + 1)), away: Array.from({ length: 9 }, (_, i) => away(i + 1)) },
  pitcherOutsEarlierToday: {},
};

function game(rules = setup.rules) {
  const pins = { ...setup, rules };
  const events: Event[] = [];
  let state: GameState = initialState(pins);
  let number = 0;
  function record(...commands: Command[]): GroupId {
    const result = applyGroup(pins, events, commands);
    expect(result.ok, JSON.stringify(commands)).toBe(true);
    if (!result.ok) throw new Error(result.code);
    state = result.state;
    const group = `play-${++number}` as GroupId;
    for (const command of commands) {
      const seq = events.length + 1;
      events.push({ id: `event-${seq}` as EventId, gameId: 'game' as GameId, seq, group, lockEpoch: 1, source: 'tap', at, command });
    }
    expect(replay(pins, events)).toEqual(result);
    return group;
  }
  function finishHalf() {
    for (let pitch = 0; pitch < 9; pitch++) record({ kind: 'pitch', result: 'swinging_strike' });
  }
  function walk() {
    for (let pitch = 0; pitch < 4; pitch++) record({ kind: 'pitch', result: 'ball' });
  }
  for (const side of ['away', 'home'] as const) {
    record({ kind: 'game', control: { kind: 'lineup_set', side, lineup: pins.roster[side].map((player, i) => ({ player, position: i === 0 ? 'P' : null })) } });
  }
  record({ kind: 'game', control: { kind: 'start', umpireStart: at } });
  return { pins, events, record, finishHalf, walk, get state() { return state; } };
}

describe('undo and game end through the event log', () => {
  it('ends a tied Mustang game after exactly one complete extra inning', () => {
    const book = game();
    for (let half = 0; half < 12; half++) book.finishHalf();
    expect(book.state).toMatchObject({ status: 'in_progress', inning: 7, half: 'top', score: { home: 0, away: 0 } });
    book.finishHalf();
    expect(book.state).toMatchObject({ status: 'in_progress', inning: 7, half: 'bottom' });
    book.finishHalf();
    expect(book.state).toMatchObject({ status: 'final', inning: 7, half: 'bottom', score: { home: 0, away: 0 } });
  });

  it('uses the regulation and extra innings in the pinned rules', () => {
    const rules = { ...setup.rules, innings: 2, timeLimit: { ...setup.rules.timeLimit!, extraInningsIfTiedBeforeLimit: 2 } };
    const book = game(rules);
    for (let half = 0; half < 6; half++) book.finishHalf();
    expect(book.state).toMatchObject({ status: 'in_progress', inning: 4, half: 'top' });
    book.finishHalf();
    book.finishHalf();
    expect(book.state).toMatchObject({ status: 'final', inning: 4, half: 'bottom' });
  });

  it('ends a regulation tie without extras when the rule set has no extra-inning setting', () => {
    const book = game({ ...setup.rules, innings: 1, timeLimit: null });
    book.finishHalf();
    book.finishHalf();
    expect(book.state).toMatchObject({ status: 'final', inning: 1, half: 'bottom' });
  });

  it('skips bottom six when the home team already leads', () => {
    const book = game();
    book.finishHalf();
    for (let walk = 0; walk < 4; walk++) book.walk();
    book.finishHalf();
    for (let half = 0; half < 9; half++) book.finishHalf();
    expect(book.state).toMatchObject({ status: 'final', inning: 6, half: 'top', score: { home: 1, away: 0 } });
  });

  it('lets the home team finish bottom six before an away win', () => {
    const book = game();
    for (let walk = 0; walk < 4; walk++) book.walk();
    for (let half = 0; half < 11; half++) book.finishHalf();
    expect(book.state).toMatchObject({ status: 'in_progress', inning: 6, half: 'bottom', score: { home: 0, away: 1 } });
    book.finishHalf();
    expect(book.state).toMatchObject({ status: 'final', inning: 6, half: 'bottom', score: { home: 0, away: 1 } });
  });

  it('ends a walkoff immediately and undo restores its entire prior state', () => {
    const book = game();
    for (let half = 0; half < 11; half++) book.finishHalf();
    for (let walk = 0; walk < 3; walk++) book.walk();
    for (let pitch = 0; pitch < 3; pitch++) book.record({ kind: 'pitch', result: 'ball' });
    const before = structuredClone(book.state);
    const target = book.record({ kind: 'pitch', result: 'ball' });
    expect(book.state).toMatchObject({ status: 'final', inning: 6, half: 'bottom', score: { home: 1, away: 0 }, outs: 0 });
    book.record({ kind: 'undo', target });
    expect(book.state).toEqual(before);
    book.record({ kind: 'pitch', result: 'called_strike' });
    expect(book.state).toMatchObject({ status: 'in_progress', count: { balls: 3, strikes: 1, pitches: 4 } });
  });

  it('rejects every non-undo command after final, including game controls and unsupported commands', () => {
    const book = game();
    const target = book.record({ kind: 'game', control: { kind: 'end_game', reason: 'called' } });
    const commands: Command[] = [
      { kind: 'pitch', result: 'ball' },
      { kind: 'ball_in_play', outcome: 'single', trajectory: null, fielders: [], advances: [] },
      { kind: 'runner', event: 'wild_pitch', runner: away(1), to: 2 },
      { kind: 'batter_out', reason: 'thrown_bat' },
      { kind: 'substitution', side: 'home', change: { kind: 'pitching_change', in: home(2) } },
      { kind: 'game', control: { kind: 'lineup_set', side: 'home', lineup: [] } },
      { kind: 'game', control: { kind: 'start', umpireStart: at } },
      { kind: 'game', control: { kind: 'end_half', reason: 'manual' } },
      { kind: 'game', control: { kind: 'end_game', reason: 'called' } },
      { kind: 'correct', target, replacement: [] },
      { kind: 'runner', event: 'missed_base', runner: home(99), to: 'out' },
    ];
    for (const command of commands) expect(applyGroup(book.pins, book.events, [command])).toEqual({ ok: false, code: 'game_over' });
    book.record({ kind: 'undo', target });
    expect(book.state.status).toBe('in_progress');
  });

  it('preserves event identities and original commands while replaying undos', () => {
    const book = game();
    const before = structuredClone(book.state);
    const first = book.record({ kind: 'pitch', result: 'ball' });
    const second = book.record({ kind: 'pitch', result: 'called_strike' });
    book.record({ kind: 'undo', target: second });
    book.record({ kind: 'undo', target: first });
    const original = structuredClone(book.events);
    expect(replay(book.pins, book.events)).toEqual({ ok: true, state: before });
    expect(book.events).toEqual(original);
    expect(book.events.slice(-4).map(({ id, group, command }) => ({ id, group, kind: command.kind }))).toEqual([
      { id: 'event-4', group: 'play-4', kind: 'pitch' },
      { id: 'event-5', group: 'play-5', kind: 'pitch' },
      { id: 'event-6', group: 'play-6', kind: 'undo' },
      { id: 'event-7', group: 'play-7', kind: 'undo' },
    ]);
    expect(applyGroup(book.pins, book.events, [{ kind: 'undo', target: second }])).toEqual({ ok: false, code: 'undo_not_latest' });
  });

  it('does not let an undo hide an invalid stored play', () => {
    const book = game();
    const seq = book.events.length + 1;
    const illegal = { ...book.events[0]!, id: `event-${seq}` as EventId, seq, group: 'bad' as GroupId, command: { kind: 'game', control: { kind: 'start', umpireStart: at } } satisfies Command };
    const undo = { ...illegal, id: `event-${seq + 1}` as EventId, seq: seq + 1, group: 'undo' as GroupId, command: { kind: 'undo', target: 'bad' as GroupId } satisfies Command };
    expect(replay(book.pins, [...book.events, illegal, undo])).toEqual({ ok: false, code: 'game_already_started' });
  });
});
