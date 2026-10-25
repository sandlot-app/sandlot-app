import { describe, expect, it } from 'vitest';
import type { Command, Event, GroupId, PlayerId, PlayerRef } from '@sandlot/engine';
import { buildTimeline } from '../src/plays.ts';
import { awayPlayer, pins, sampleEvents, serverState, withPlay } from './helpers.ts';

const pitch = (result: Extract<Command, { kind: 'pitch' }>['result']): Command => ({ kind: 'pitch', result });
const homePlayer = (n: number): PlayerRef => ({ kind: 'player', id: `home-${n}` as PlayerId });
const flyOut: Command[] = [pitch('in_play'), { kind: 'ball_in_play', outcome: 'out', trajectory: 'fly', fielders: ['CF'], advances: [] }];
const single: Command[] = [pitch('in_play'), { kind: 'ball_in_play', outcome: 'single', trajectory: 'line', fielders: ['LF'], advances: [] }];

const plays = (events: Event[], ...groups: Command[][]): Event[] =>
  groups.reduce((sofar, commands, i) => withPlay(sofar, `play-${i}`, ...commands), events);

const homeRun: Command[] = [
  pitch('in_play'),
  { kind: 'ball_in_play', outcome: 'home_run', trajectory: 'fly', fielders: ['CF'], advances: [] },
];

describe('buildTimeline', () => {
  it('describes each play of the sample half-inning and ends in the bottom of the 1st', () => {
    const { plays, state } = buildTimeline(pins(), sampleEvents(), null);

    expect(plays.map((play) => play.text)).toEqual([
      'Lineup set (away)',
      'Lineup set (home)',
      'Game started',
      'Ball',
      'Strike looking',
      'away-1 singles to left (LF)',
      'away-1 steals 2nd',
      'Strike looking',
      'Strike swinging',
      'away-2 strikes out swinging',
      'away-3 grounds out, 2B to 1B',
      'away-4 flies out to center (CF)',
    ]);
    expect(plays.every((play) => play.scoreAfter?.away === 0 && play.scoreAfter.home === 0)).toBe(true);
    expect(plays.at(-1)).toMatchObject({ inning: 1, half: 'top' });
    expect(state).toMatchObject({ status: 'in_progress', inning: 1, half: 'bottom', outs: 0, bases: {}, score: { away: 0, home: 0 } });
  });

  it('shows the score after a run and the restored score after an undo, without the undone play', () => {
    const scored = withPlay(sampleEvents(), 'home-run', ...homeRun);
    const homeRunGroup = scored.at(-1)!.group;
    const undone = withPlay(scored, 'undo-home-run', { kind: 'undo', target: homeRunGroup });

    const afterRun = buildTimeline(pins(), scored, null);
    expect(afterRun.plays.at(-1)).toMatchObject({ text: 'home-1 hits a home run to center (CF)', scoreAfter: { away: 0, home: 1 }, inning: 1, half: 'bottom' });
    expect(afterRun.state).toMatchObject({ score: { away: 0, home: 1 } });

    const afterUndo = buildTimeline(pins(), undone, null);
    expect(afterUndo.plays.map((play) => play.group)).not.toContain(homeRunGroup);
    expect(afterUndo.plays.at(-1)).toMatchObject({ text: 'Undo', scoreAfter: { away: 0, home: 0 } });
    expect(afterUndo.state).toMatchObject({ score: { away: 0, home: 0 } });
  });

  it('keeps the plays and the server state when the game was recorded under another engine version', () => {
    const events = sampleEvents();
    const cached = { ...serverState(events), score: { away: 7, home: 3 } };

    const { plays, state } = buildTimeline(pins({ engineVersion: '0.0.1' }), events, cached);

    expect(state).toBe(cached);
    expect(plays).toHaveLength(12);
    expect(plays.map((play) => play.text)).toContain('Strike swinging');
    expect(plays.every((play) => play.scoreAfter === null && play.inning === null && play.half === null)).toBe(true);
  });

  it('keeps the plays and the server state when the engine rejects a stored play', () => {
    const events = withPlay(sampleEvents(), 'sub', {
      kind: 'substitution',
      side: 'away',
      change: { kind: 'pinch_hitter', in: awayPlayer(5), out: awayPlayer(4) },
    });
    const cached = serverState(sampleEvents());

    const { plays, state } = buildTimeline(pins(), events, cached);

    expect(state).toBe(cached);
    expect(plays.at(-1)).toMatchObject({ text: 'away-5 pinch hits for away-4', scoreAfter: null });
  });

  it('names a play it has no wording for instead of failing', () => {
    const unknown = { kind: 'review_decision' } as unknown as Command;
    const events = withPlay(sampleEvents(), 'future', unknown);

    const { plays } = buildTimeline(pins({ schemaVersion: 99 }), events, null);

    expect(plays.at(-1)?.text).toBe('Play');
  });

  it('announces a walk on ball four', () => {
    const events = plays(sampleEvents(), [pitch('ball')], [pitch('ball')], [pitch('ball')], [pitch('ball')]);

    const { plays: timeline, state } = buildTimeline(pins(), events, null);

    expect(timeline.slice(-4).map((play) => play.text)).toEqual(['Ball', 'Ball', 'Ball', 'Ball four, home-1 walks']);
    expect(state?.bases[1]?.player).toEqual(homePlayer(1));
  });

  it('calls a pitch a plain ball when a runner makes the third out on the same play', () => {
    const events = plays(sampleEvents(), flyOut, flyOut, single, [
      pitch('ball'),
      { kind: 'runner', event: 'caught_stealing', runner: homePlayer(3), to: 'out' },
    ]);

    const { plays: timeline, state } = buildTimeline(pins(), events, null);

    expect(timeline.at(-1)?.text).toBe('Ball. home-3 is caught stealing');
    expect(state).toMatchObject({ inning: 2, half: 'top', outs: 0 });
  });

  it('calls a pitch a plain ball when the scorer ends the half on the same play', () => {
    const events = plays(sampleEvents(), [pitch('ball'), { kind: 'game', control: { kind: 'end_half', reason: 'manual' } }]);

    expect(buildTimeline(pins(), events, null).plays.at(-1)?.text).toBe('Ball. Half-inning ended');
  });

  it('is pregame with no plays before the first event', () => {
    expect(buildTimeline(pins(), [], null)).toMatchObject({ plays: [], state: { status: 'pregame' } });
  });

  it('keeps events of one play together', () => {
    const { plays } = buildTimeline(pins(), sampleEvents(), null);
    const groups: GroupId[] = plays.map((play) => play.group);
    expect(new Set(groups).size).toBe(groups.length);
  });
});
