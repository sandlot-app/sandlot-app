import { describe, expect, it } from 'vitest';
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

  it('discards the pitch, bases and batting order when a later outcome in the play collides', () => {
    const before = structuredClone(started);
    const single: Command = { kind: 'ball_in_play', outcome: 'single', trajectory: 'line', fielders: ['LF'], advances: [] };
    const inPlay: Command = { kind: 'pitch', result: 'in_play' };
    expect(applyGroup(setup, started, [inPlay, single, inPlay, single]))
      .toEqual({ ok: false, code: 'base_occupied' });
    expect(started).toEqual(before);
    const accepted = applyGroup(setup, started, [inPlay, single]);
    expect(accepted.ok && {
      bases: accepted.state.bases,
      nextBatter: accepted.state.nextBatter,
      pitchCounts: accepted.state.pitchCounts,
    }).toEqual({
      bases: { 1: { player: away(1), chargedTo: home(1) } },
      nextBatter: { home: 0, away: 1 },
      pitchCounts: { 'home-1': 1, 'away-1': 0 },
    });
  });

  it('rolls back a complete outcome when its play ends on another unresolved in-play pitch', () => {
    const single: Command = { kind: 'ball_in_play', outcome: 'single', trajectory: 'line', fielders: ['LF'], advances: [] };
    const inPlay: Command = { kind: 'pitch', result: 'in_play' };
    expect(applyGroup(setup, started, [inPlay, single, inPlay]))
      .toEqual({ ok: false, code: 'in_play_needs_outcome' });
    const original = replay(setup, started);
    expect(original.ok && original.state.bases).toEqual({});
    expect(original.ok && original.state.pitchCounts).toEqual({ 'home-1': 0, 'away-1': 0 });
  });

  it('refuses an unresolved stored play before an outcome in a later play', () => {
    expect(replay(setup, started.concat(events([
      [{ kind: 'pitch', result: 'in_play' }],
      [{ kind: 'ball_in_play', outcome: 'single', trajectory: 'line', fielders: ['LF'], advances: [] }],
    ])))).toEqual({ ok: false, code: 'in_play_needs_outcome' });
  });

  it('rejects a stored play that breaks the rules when replaying', () => {
    expect(replay(setup, events([[{ kind: 'pitch', result: 'ball' }]]))).toEqual({ ok: false, code: 'game_not_started' });
  });

  const notYet: Command[][] = [
    [{ kind: 'runner', event: 'wild_pitch', runner: away(1), to: 2 }],
    [{ kind: 'batter_out', reason: 'thrown_bat' }],
    [{ kind: 'substitution', side: 'home', change: { kind: 'pitching_change', in: home(2) } }],
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
