import { describe, expect, it } from 'vitest';
import { applyGroupFrom } from '../src/engine.ts';
import {
  applyGroup,
  presets,
  replay,
  type Command,
  type Event,
  type EventId,
  type GameId,
  type GameSetup,
  type GroupId,
  type OpponentId,
  type PlayerId,
  type PlayerRef,
  type Timestamp,
} from '../src/index.ts';

const home = (n: number): PlayerRef => ({ kind: 'player', id: `home-${n}` as PlayerId });
const away = (n: number): PlayerRef => ({ kind: 'opponent', id: `away-${n}` as OpponentId });
const at = '2026-10-25T17:00:00.000Z' as Timestamp;

const setup: GameSetup = {
  rules: presets['moraga-mustang-first-half'],
  roster: { home: [home(1), home(2)], away: [away(1), away(2)] },
  pitcherOutsEarlierToday: {},
};

function events(plays: Command[][]): Event[] {
  let seq = 0;
  return plays.flatMap((commands, play) =>
    commands.map((command): Event => {
      seq += 1;
      return { id: `e-${seq}` as EventId, gameId: 'g' as GameId, seq, group: `p-${play}` as GroupId, lockEpoch: 1, source: 'tap', at, command };
    }),
  );
}

const started = events([
  [{ kind: 'game', control: { kind: 'lineup_set', side: 'away', lineup: [{ player: away(1), position: 'P' }, { player: away(2), position: 'C' }] } }],
  [{ kind: 'game', control: { kind: 'lineup_set', side: 'home', lineup: [{ player: home(1), position: 'P' }, { player: home(2), position: 'C' }] } }],
  [{ kind: 'game', control: { kind: 'start', umpireStart: at } }],
]);

describe('applyGroup', () => {
  it('saves nothing from a play when one of its commands is rejected', () => {
    expect(applyGroup(setup, started, [{ kind: 'pitch', result: 'ball' }, { kind: 'game', control: { kind: 'start', umpireStart: at } }]))
      .toEqual({ ok: false, code: 'game_already_started' });
    const after = applyGroup(setup, started, [{ kind: 'pitch', result: 'ball' }]);
    expect(after.ok && after.state.count).toEqual({ balls: 1, strikes: 0, pitches: 1 });
  });

  it('leaves the events it was given unchanged', () => {
    const before = structuredClone(started);
    applyGroup(setup, started, [{ kind: 'pitch', result: 'ball' }]);
    expect(started).toEqual(before);
  });

  it('rejects a stored play that breaks the rules when replaying', () => {
    expect(replay(setup, events([[{ kind: 'pitch', result: 'ball' }]]))).toEqual({ ok: false, code: 'game_not_started' });
  });

  it('changes the pitcher without changing either batting lineup or place in the order', () => {
    const before = replay(setup, started);
    const after = applyGroup(setup, started, [{ kind: 'substitution', side: 'home', change: { kind: 'pitching_change', in: home(2) } }]);
    expect(before.ok).toBe(true);
    expect(after.ok).toBe(true);
    if (!before.ok || !after.ok) return;
    expect(after.state.lineups).toEqual(before.state.lineups);
    expect(after.state.nextBatter).toEqual(before.state.nextBatter);
    expect(after.state.pitchers.home).toEqual(home(2));
  });

  it('does not retain a pitching change or its removed-pitcher history when a later command fails', () => {
    const opened = replay(setup, started);
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;
    const before = structuredClone(opened.state);
    expect(applyGroupFrom(setup, opened.state, [], [
      { kind: 'substitution', side: 'home', change: { kind: 'pitching_change', in: home(2) } },
      { kind: 'runner', event: 'wild_pitch', runner: away(1), to: 2 },
    ])).toEqual({ ok: false, code: 'runner_not_on_base' });
    expect(opened.state).toEqual(before);
    const resumed = applyGroupFrom(setup, opened.state, [], [{ kind: 'pitch', result: 'ball' }]);
    expect(resumed.ok && resumed.state.pitchCounts).toEqual({ 'home-1': 1, 'away-1': 0 });
  });

  it('does not score or move a runner when a later command in the play fails', () => {
    const walked = events([...started.map((event) => [event.command]), [{ kind: 'pitch', result: 'hit_by_pitch' }]]);
    const opened = replay(setup, walked);
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;
    const before = structuredClone(opened.state);
    expect(applyGroupFrom(setup, opened.state, [], [
      { kind: 'runner', event: 'advance_on_error', runner: away(1), to: 'home' },
      { kind: 'runner', event: 'wild_pitch', runner: away(1), to: 2 },
    ])).toEqual({ ok: false, code: 'runner_not_on_base' });
    expect(opened.state).toEqual(before);
  });

  const notYet: Command[][] = [
    [{ kind: 'pitch', result: 'in_play' }],
    [{ kind: 'pitch', result: 'in_play' }, { kind: 'ball_in_play', outcome: 'single', trajectory: 'line', fielders: ['LF'], advances: [] }],
    [{ kind: 'runner', event: 'defensive_indifference', runner: away(1), to: 2 }],
    [{ kind: 'batter_out', reason: 'thrown_bat' }],
    [{ kind: 'substitution', side: 'home', change: { kind: 'defensive', in: home(2), position: 'SS' } }],
    [{ kind: 'game', control: { kind: 'end_half', reason: 'manual' } }],
    [{ kind: 'game', control: { kind: 'end_game', reason: 'called' } }],
    [{ kind: 'undo', target: 'p-2' as GroupId }],
    [{ kind: 'correct', target: 'p-2' as GroupId, replacement: [] }],
  ];
  for (const commands of notYet) {
    it(`returns not_implemented for ${commands.map((c) => c.kind).join(' + ')}`, () => {
      expect(applyGroup(setup, started, commands)).toEqual({ ok: false, code: 'not_implemented' });
    });
  }
});
