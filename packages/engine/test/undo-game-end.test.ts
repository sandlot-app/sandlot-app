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

  it('undoes every command of a multi-pitch play and preserves the original play identity', () => {
    const book = game();
    const before = structuredClone(book.state);
    const target = book.record({ kind: 'pitch', result: 'ball' }, { kind: 'pitch', result: 'called_strike' });
    expect(book.state.count).toEqual({ balls: 1, strikes: 1, pitches: 2 });
    const stored = structuredClone(book.events);
    book.record({ kind: 'undo', target });
    expect(book.state).toEqual(before);
    expect(book.events.slice(0, -1)).toEqual(stored);
  });

  it('undoes runner movement and a third-out half transition from actual accepted events', () => {
    const book = game();
    book.record({ kind: 'pitch', result: 'hit_by_pitch' });
    const beforeMove = structuredClone(book.state);
    const move = book.record({ kind: 'runner', event: 'stolen_base', runner: away(1), to: 2 });
    expect(book.state.bases[2]?.player).toEqual(away(1));
    book.record({ kind: 'undo', target: move });
    expect(book.state).toEqual(beforeMove);
    for (let pitch = 0; pitch < 6; pitch++) book.record({ kind: 'pitch', result: 'called_strike' });
    book.record({ kind: 'pitch', result: 'ball' });
    const beforeOut = structuredClone(book.state);
    const out = book.record({ kind: 'runner', event: 'caught_stealing', runner: away(1), to: 'out' });
    expect(book.state).toMatchObject({ half: 'bottom', outs: 0, bases: {}, nextBatter: { away: 3, home: 0 } });
    book.record({ kind: 'undo', target: out });
    expect(book.state).toEqual(beforeOut);
  });

  it('undoes pitching changes, counts, and removal history while rejecting re-entry atomically', () => {
    const book = game();
    book.record({ kind: 'pitch', result: 'ball' });
    const before = structuredClone(book.state);
    const change = book.record({ kind: 'substitution', side: 'home', change: { kind: 'pitching_change', in: home(2) } });
    const pitch = book.record({ kind: 'pitch', result: 'called_strike' });
    expect(book.state.pitchCounts).toEqual({ 'home-1': 1, 'away-1': 0, 'home-2': 1 });
    book.record({ kind: 'undo', target: pitch });
    expect(book.state.pitchCounts['home-2']).toBe(0);
    book.record({ kind: 'undo', target: change });
    expect(book.state).toEqual(before);
    const retried = book.record({ kind: 'substitution', side: 'home', change: { kind: 'pitching_change', in: home(2) } });
    const changed = structuredClone(book.state);
    expect(applyGroup(book.pins, book.events, [
      { kind: 'pitch', result: 'ball' },
      { kind: 'substitution', side: 'home', change: { kind: 'pitching_change', in: home(1) } },
    ])).toEqual({ ok: false, code: 'pitcher_reentry_not_allowed' });
    expect(replay(book.pins, book.events)).toEqual({ ok: true, state: changed });
    book.record({ kind: 'undo', target: retried });
    expect(book.state).toEqual(before);
    book.record({ kind: 'pitch', result: 'ball' });
    expect(book.state.pitchCounts).toEqual({ 'home-1': 2, 'away-1': 0 });
  });

  for (const threshold of [65, 75]) {
    it(`undoes and can repeat the ${threshold}th pitch alert from a complete event log`, () => {
      const book = game();
      for (let pitch = 0; pitch < threshold - 1; pitch++) book.record({ kind: 'pitch', result: 'foul' });
      const before = structuredClone(book.state);
      const target = book.record({ kind: 'pitch', result: 'foul' });
      const alerts = threshold === 65
        ? [{ kind: 'pitch_count_near_limit', pitcher: home(1), remaining: 10 }]
        : [{ kind: 'pitch_count_at_limit', pitcher: home(1) }];
      expect(book.state.alerts).toEqual(alerts);
      book.record({ kind: 'undo', target });
      expect(book.state).toEqual(before);
      book.record({ kind: 'pitch', result: 'foul' });
      expect(book.state.alerts).toEqual(alerts);
      const clear = book.record({ kind: 'pitch', result: 'ball' });
      expect(book.state.alerts).toEqual([]);
      book.record({ kind: 'undo', target: clear });
      expect(book.state.pitchCounts['home-1']).toBe(threshold);
      expect(book.state.alerts).toEqual(alerts);
    });
  }

  for (const inning of [6, 7]) {
    it(`undoes a runner walkoff in bottom ${inning} from an actual occupied base`, () => {
      const book = game();
      for (let half = 0; half < inning * 2 - 1; half++) book.finishHalf();
      book.walk();
      const runner = book.state.bases[1]!.player;
      book.record({ kind: 'runner', event: 'passed_ball', runner, to: 3 });
      const before = structuredClone(book.state);
      const target = book.record({ kind: 'runner', event: 'passed_ball', runner, to: 'home' });
      expect(book.state).toMatchObject({ status: 'final', inning, half: 'bottom', score: { home: 1, away: 0 }, bases: {} });
      book.record({ kind: 'undo', target });
      expect(book.state).toEqual(before);
      book.record({ kind: 'pitch', result: 'ball' });
      expect(book.state.status).toBe('in_progress');
    });
  }

  it('undoes a final runner out and restores the unchanged batter due', () => {
    const book = game();
    for (let walk = 0; walk < 4; walk++) book.walk();
    for (let half = 0; half < 11; half++) book.finishHalf();
    book.walk();
    const runner = book.state.bases[1]!.player;
    for (let pitch = 0; pitch < 6; pitch++) book.record({ kind: 'pitch', result: 'called_strike' });
    book.record({ kind: 'pitch', result: 'ball' });
    const before = structuredClone(book.state);
    const target = book.record({ kind: 'runner', event: 'pickoff', runner, to: 'out' });
    expect(book.state).toMatchObject({ status: 'final', inning: 6, half: 'bottom', outs: 0, nextBatter: before.nextBatter });
    book.record({ kind: 'undo', target });
    expect(book.state).toEqual(before);
  });

  it('restores pregame when start is undone, then undoes the lineups until nothing is left', () => {
    const book = game();
    book.record({ kind: 'undo', target: 'play-3' as GroupId });
    expect(book.state).toMatchObject({ status: 'pregame', pitchers: {}, removedPitchers: { home: [], away: [] }, pitchCounts: {} });
    book.record({ kind: 'undo', target: 'play-2' as GroupId });
    book.record({ kind: 'undo', target: 'play-1' as GroupId });
    expect(book.state.lineups).toEqual({ home: [], away: [] });
    expect(applyGroup(book.pins, book.events, [{ kind: 'undo', target: 'play-1' as GroupId }]))
      .toEqual({ ok: false, code: 'nothing_to_undo' });
  });
});


describe('balls in play with undo, final innings, and pitch-count alerts', () => {
  for (const inning of [6, 7]) {
    for (const awayLead of [0, 1]) {
      it(`stops an ordinary bottom-${inning} walkoff after the winning run from a ${awayLead}-run deficit (OBR 7.01(e)(3), 9.06(f))`, () => {
        const book = game();
        for (let half = 0; half < inning * 2 - 2; half++) book.finishHalf();
        if (awayLead) book.record(
          { kind: 'pitch', result: 'in_play' },
          { kind: 'ball_in_play', outcome: 'home_run', trajectory: 'fly', fielders: ['CF'], advances: [] },
        );
        book.finishHalf();
        for (let runner = 0; runner < 3; runner++) book.record({ kind: 'pitch', result: 'hit_by_pitch' });
        book.record({ kind: 'pitch', result: 'called_strike' });
        const before = structuredClone(book.state);
        const oldEvents = structuredClone(book.events);
        const target = book.record(
          { kind: 'pitch', result: 'in_play' },
          {
            kind: 'ball_in_play', outcome: 'single', trajectory: 'line', fielders: ['CF'],
            advances: ([3, 2, 1] as const).map((base) => ({ runner: before.bases[base]!.player, to: 'home' })),
          },
        );
        expect(book.state).toMatchObject({
          status: 'final', inning, half: 'bottom', score: { home: awayLead + 1, away: awayLead },
          runsThisHalf: awayLead + 1, count: { balls: 0, strikes: 0, pitches: 0 },
        });
        expect(book.state.bases).toEqual({ 1: { player: before.lineups.home[before.nextBatter.home]!.player, chargedTo: away(1) } });
        expect(book.state.nextBatter).toEqual({ ...before.nextBatter, home: (before.nextBatter.home + 1) % 9 });
        expect(book.state.pitchCounts['away-1']).toBe(before.pitchCounts['away-1']! + 1);
        expect(book.state.removedPitchers).toEqual(before.removedPitchers);
        expect(book.events.slice(-2).map((event) => event.group)).toEqual([target, target]);
        expect(applyGroup(book.pins, book.events, [{ kind: 'pitch', result: 'ball' }])).toEqual({ ok: false, code: 'game_over' });
        book.record({ kind: 'undo', target });
        expect(book.state).toEqual(before);
        expect(book.events.slice(0, oldEvents.length)).toEqual(oldEvents);
        book.record({ kind: 'pitch', result: 'ball' });
        expect(book.state).toMatchObject({ status: 'in_progress', count: { balls: 1, strikes: 1, pitches: 2 } });
      });
    }

    it(`counts every eligible run on an out-of-field bottom-${inning} walkoff home run (OBR 7.01(e)(3) exception, 9.06(g))`, () => {
      const book = game();
      for (let half = 0; half < inning * 2 - 1; half++) book.finishHalf();
      for (let runner = 0; runner < 3; runner++) book.record({ kind: 'pitch', result: 'hit_by_pitch' });
      const before = structuredClone(book.state);
      const target = book.record(
        { kind: 'pitch', result: 'in_play' },
        {
          kind: 'ball_in_play', outcome: 'home_run', trajectory: 'fly', fielders: ['CF'],
          advances: ([3, 2, 1] as const).map((base) => ({ runner: before.bases[base]!.player, to: 'home' })),
        },
      );
      expect(book.state).toMatchObject({ status: 'final', inning, half: 'bottom', score: { home: 4, away: 0 }, runsThisHalf: 4, bases: {} });
      book.record({ kind: 'undo', target });
      expect(book.state).toEqual(before);
    });
  }

  it('uses the pinned regulation length when limiting ordinary walkoff runs (OBR 7.01(e)(3))', () => {
    const book = game({ ...setup.rules, innings: 2 });
    for (let half = 0; half < 3; half++) book.finishHalf();
    for (let runner = 0; runner < 2; runner++) book.record({ kind: 'pitch', result: 'hit_by_pitch' });
    const before = structuredClone(book.state);
    book.record(
      { kind: 'pitch', result: 'in_play' },
      {
        kind: 'ball_in_play', outcome: 'single', trajectory: 'line', fielders: ['CF'],
        advances: ([2, 1] as const).map((base) => ({ runner: before.bases[base]!.player, to: 'home' })),
      },
    );
    expect(book.state).toMatchObject({ status: 'final', inning: 2, half: 'bottom', score: { home: 1, away: 0 }, runsThisHalf: 1 });
  });

  for (const inning of [6, 7]) {
    it(`undoes both commands of a bottom-${inning} walkoff and reopens the game (OBR 5.08(a), 7.01(g)(3))`, () => {
      const book = game();
      for (let half = 0; half < inning * 2 - 1; half++) book.finishHalf();
      book.record({ kind: 'pitch', result: 'hit_by_pitch' });
      book.record({ kind: 'pitch', result: 'called_strike' });
      const before = structuredClone(book.state);
      const oldEvents = structuredClone(book.events);
      const target = book.record(
        { kind: 'pitch', result: 'in_play' },
        { kind: 'ball_in_play', outcome: 'single', trajectory: 'line', fielders: ['CF'], advances: [{ runner: before.bases[1]!.player, to: 'home' }] },
      );
      expect(book.state).toMatchObject({ status: 'final', inning, half: 'bottom', score: { home: 1, away: 0 } });
      expect(book.state.pitchCounts['away-1']).toBe(before.pitchCounts['away-1']! + 1);
      expect(book.events.slice(-2).map((event) => event.group)).toEqual([target, target]);
      expect(applyGroup(book.pins, book.events, [{ kind: 'pitch', result: 'ball' }])).toEqual({ ok: false, code: 'game_over' });
      book.record({ kind: 'undo', target });
      expect(book.state).toEqual(before);
      expect(book.events.slice(0, oldEvents.length)).toEqual(oldEvents);
      book.record({ kind: 'pitch', result: 'ball' });
      expect(book.state).toMatchObject({ status: 'in_progress', count: { balls: 1, strikes: 1, pitches: 2 } });
    });
  }

  for (const threshold of [65, 75]) {
    it(`rejects a contradictory outcome atomically at pitch ${threshold}, then emits and restores its alert through BIP undo (Pitch Smart ages 9-10, OBR 9.05(b)(1))`, () => {
      const book = game();
      book.record({ kind: 'pitch', result: 'hit_by_pitch' });
      for (let count = 1; count < threshold - 1; count++) book.record({ kind: 'pitch', result: 'foul' });
      const before = structuredClone(book.state);
      const priorEvents = structuredClone(book.events);
      expect(applyGroup(book.pins, book.events, [
        { kind: 'pitch', result: 'in_play' },
        { kind: 'ball_in_play', outcome: 'single', trajectory: 'ground', fielders: ['SS', '2B'], advances: [{ runner: away(1), to: 'out', outType: 'force' }] },
      ])).toEqual({ ok: false, code: 'invalid_out_type' });
      expect(book.events).toEqual(priorEvents);
      expect(replay(book.pins, book.events)).toEqual({ ok: true, state: before });
      const commands: Command[] = [
        { kind: 'pitch', result: 'in_play' },
        { kind: 'ball_in_play', outcome: 'fielders_choice', trajectory: 'ground', fielders: ['SS', '2B'], advances: [{ runner: away(1), to: 'out', outType: 'force' }] },
      ];
      const target = book.record(...commands);
      const expectedAlerts = threshold === 65
        ? [{ kind: 'pitch_count_near_limit', pitcher: home(1), remaining: 10 }]
        : [{ kind: 'pitch_count_at_limit', pitcher: home(1) }];
      expect(book.state.alerts).toEqual(expectedAlerts);
      expect(book.state.pitchCounts['home-1']).toBe(threshold);
      expect(book.state.outs).toBe(1);
      const accepted = structuredClone(book.state);
      book.record({ kind: 'undo', target });
      expect(book.state).toEqual(before);
      book.record(...commands);
      expect(book.state).toEqual(accepted);
    });
  }

  it('undoes a two-command third out, restoring runner, count, pitcher history, and batting order (OBR 5.09)', () => {
    const book = game();
    book.record({ kind: 'substitution', side: 'home', change: { kind: 'pitching_change', in: home(2) } });
    book.record({ kind: 'pitch', result: 'hit_by_pitch' });
    for (let count = 0; count < 6; count++) book.record({ kind: 'pitch', result: 'swinging_strike' });
    book.record({ kind: 'pitch', result: 'ball' });
    const before = structuredClone(book.state);
    const target = book.record(
      { kind: 'pitch', result: 'in_play' },
      { kind: 'ball_in_play', outcome: 'fielders_choice', trajectory: 'ground', fielders: ['SS', '2B'], advances: [{ runner: away(1), to: 'out', outType: 'force' }] },
    );
    expect(book.state).toMatchObject({ half: 'bottom', outs: 0, bases: {} });
    book.record({ kind: 'undo', target });
    expect(book.state).toEqual(before);
  });
});
