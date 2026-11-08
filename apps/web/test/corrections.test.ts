import { describe, expect, it } from 'vitest';
import type { Command, Event, GroupId, Timestamp } from '@sandlot/engine';
import { clipUrl } from '../src/clips.ts';
import { initialLiveGame, liveReducer } from '../src/live.ts';
import { streamView } from '../src/LiveView.tsx';
import { buildTimeline } from '../src/plays.ts';
import { pins, sampleEvents, serverState, snapshot, withPlay } from './helpers.ts';

const pitch = (result: Extract<Command, { kind: 'pitch' }>['result']): Command => ({ kind: 'pitch', result });
const fix = (events: Event[], id: string, target: string, replacement: Command[]): Event[] =>
  withPlay(events, id, { kind: 'correct', target: target as GroupId, replacement });
const undo = (events: Event[], id: string, target: string): Event[] =>
  withPlay(events, id, { kind: 'undo', target: target as GroupId });
const homeRun: Command[] = [
  pitch('in_play'),
  { kind: 'ball_in_play', outcome: 'home_run', trajectory: 'fly', fielders: ['CF'], advances: [] },
];
const flyOut: Command[] = [
  pitch('in_play'),
  { kind: 'ball_in_play', outcome: 'out', trajectory: 'fly', fielders: ['CF'], advances: [] },
];

describe('the family timeline after a Fix', () => {
  it('replaces the pitch without adding another physical play or pitcher pitch', () => {
    const original = withPlay(sampleEvents(), 'original', pitch('ball'));
    const corrected = fix(original, 'fix', 'original', [pitch('called_strike')]);
    const before = buildTimeline(pins(), original, null);
    const after = buildTimeline(pins(), corrected, null);

    expect(after.plays).toHaveLength(before.plays.length);
    expect(after.plays.at(-1)).toMatchObject({ group: 'original', text: 'Strike looking', onField: true });
    expect(after.state).toEqual(serverState(withPlay(sampleEvents(), 'expected', pitch('called_strike'))));
    expect(after.state?.count).toEqual({ balls: 0, strikes: 1, pitches: 1 });
  });

  it('applies a Fix on a game pinned to 0.1.1, which this engine continues', () => {
    const original = withPlay(sampleEvents(), 'original', pitch('ball'));
    const corrected = fix(original, 'fix', 'original', [pitch('called_strike')]);
    const { plays, state } = buildTimeline(pins({ engineVersion: '0.1.1' }), corrected, null);

    expect(plays.at(-1)).toMatchObject({ group: 'original', text: 'Strike looking' });
    expect(state).toEqual(serverState(withPlay(sampleEvents(), 'expected', pitch('called_strike'))));
  });

  it('replaces a scoring hit with an out, including its batter, score and clip time', () => {
    const originalAt = '2026-10-25T17:20:00.000Z' as Timestamp;
    const fixedAt = '2026-10-25T17:21:00.000Z' as Timestamp;
    const original = withPlay(sampleEvents(), 'original', ...homeRun)
      .map((event) => event.group === 'original' ? { ...event, at: originalAt } : event);
    const corrected = fix(original, 'fix', 'original', flyOut)
      .map((event) => event.group === 'fix' ? { ...event, at: fixedAt } : event);
    const { plays, state } = buildTimeline(pins(), corrected, null);
    const play = plays.at(-1)!;

    expect(play).toMatchObject({
      group: 'original', at: originalAt, text: '#15 flies out to center (CF)',
      scoreAfter: { away: 0, home: 0 }, inning: 1, half: 'bottom',
      situation: { outs: 1, runners: [] }, onField: true,
    });
    expect(plays.filter(({ group }) => group === 'original')).toHaveLength(1);
    expect(plays.some(({ text }) => text.includes('home run') || text === 'Correction')).toBe(false);
    expect(state).toEqual(serverState(withPlay(sampleEvents(), 'expected', ...flyOut)));
    const recording = { playbackId: 'abc123', clockOffsetMs: 0 };
    expect(clipUrl(recording, play.at)).toBe(clipUrl(recording, originalAt));
    expect(clipUrl(recording, play.at)).not.toBe(clipUrl(recording, fixedAt));
  });

  it('restores the original play and its score when the Fix is undone', () => {
    const original = withPlay(sampleEvents(), 'original', ...homeRun);
    const corrected = fix(original, 'fix', 'original', flyOut);
    const restored = undo(corrected, 'undo-fix', 'fix');

    expect(buildTimeline(pins(), restored, null)).toEqual(buildTimeline(pins(), original, null));
  });

  it('steps back through a Fix of a Fix, then removes the restored original with Undo', () => {
    const original = withPlay(sampleEvents(), 'original', pitch('ball'));
    const first = fix(original, 'fix-one', 'original', [pitch('called_strike')]);
    const second = fix(first, 'fix-two', 'fix-one', [pitch('foul')]);
    const undoSecond = undo(second, 'undo-two', 'fix-two');
    const undoFirst = undo(undoSecond, 'undo-one', 'fix-one');
    const undoOriginal = undo(undoFirst, 'undo-original', 'original');

    expect(buildTimeline(pins(), second, null).plays.at(-1)?.text).toBe('Foul');
    expect(buildTimeline(pins(), undoSecond, null)).toEqual(buildTimeline(pins(), first, null));
    expect(buildTimeline(pins(), undoFirst, null)).toEqual(buildTimeline(pins(), original, null));
    expect(buildTimeline(pins(), undoOriginal, null)).toEqual(buildTimeline(pins(), sampleEvents(), null));
  });

  it('hides an empty replacement and its clip while keeping Undo able to restore it', () => {
    const original = withPlay(sampleEvents(), 'original', ...homeRun);
    const removed = fix(original, 'remove', 'original', []);
    const later = withPlay(removed, 'later', pitch('ball'));
    const undoLater = undo(later, 'undo-later', 'later');

    expect(buildTimeline(pins(), removed, null)).toEqual(buildTimeline(pins(), sampleEvents(), null));
    expect(buildTimeline(pins(), undoLater, null)).toEqual(buildTimeline(pins(), removed, null));
    expect(buildTimeline(pins(), undo(undoLater, 'restore', 'remove'), null))
      .toEqual(buildTimeline(pins(), original, null));
  });

  it('uses the original at-bat context for a replacement spanning two batters', () => {
    const original = withPlay(sampleEvents(), 'original', pitch('ball'));
    const replacement = [pitch('ball'), pitch('ball'), pitch('ball'), pitch('ball'), pitch('called_strike')];
    const { plays, state } = buildTimeline(pins(), fix(original, 'fix', 'original', replacement), null);

    expect(plays.at(-1)?.text).toBe('Ball. Ball. Ball. Ball four, #15 walks. Strike looking');
    expect(state).toEqual(serverState(withPlay(sampleEvents(), 'expected', ...replacement)));
  });

  it('keeps the original half-inning when a Fix replaces the game-ending out', () => {
    const gamePins = pins({ rules: { ...pins().rules, innings: 1, timeLimit: null } });
    const oneOut = withPlay(sampleEvents(), 'out-one', ...flyOut);
    const twoOuts = withPlay(oneOut, 'out-two', ...flyOut);
    const ended = withPlay(twoOuts, 'original', ...flyOut);
    const { plays, state } = buildTimeline(gamePins, fix(ended, 'fix', 'original', [pitch('ball')]), null);

    expect(plays.at(-1)).toMatchObject({ text: 'Ball', inning: 1, half: 'bottom', situation: { outs: 2, runners: [] } });
    expect(state).toMatchObject({ status: 'in_progress', inning: 1, half: 'bottom', outs: 2 });
  });

  it('projects corrected text with cached state when the engine version differs', () => {
    const original = withPlay(sampleEvents(), 'original', pitch('ball'));
    const corrected = fix(original, 'fix', 'original', [pitch('called_strike')]);
    const cached = serverState(corrected);
    const { plays, state } = buildTimeline(pins({ engineVersion: 'future' }), corrected, cached);

    expect(state).toBe(cached);
    expect(plays.at(-1)).toMatchObject({ group: 'original', text: 'Strike looking', onField: true });
    expect(plays).toHaveLength(buildTimeline(pins(), original, null).plays.length);
    expect(plays.every((play) => play.scoreAfter === null && play.situation === null)).toBe(true);
  });

  it('does not remove the latest physical play for a malformed correction target', () => {
    const original = withPlay(sampleEvents(), 'original', pitch('ball'));
    const malformed = fix(original, 'fix', 'missing', [pitch('called_strike')]);
    const { plays, state } = buildTimeline(pins(), malformed, null);

    expect(state).toBeNull();
    expect(plays).toContainEqual(expect.objectContaining({ group: 'original', text: 'Ball' }));
  });

  it('updates an already selected clip on a correction and returns to live when it is removed', () => {
    const original = withPlay(sampleEvents(), 'original', ...homeRun);
    const initial = liveReducer(initialLiveGame, { type: 'snapshot', snapshot: snapshot(original) });
    const game = liveReducer(initial, { type: 'recording', recording: { playbackId: 'abc123', clockOffsetMs: 0 } });
    const selected = game.plays.at(-1)!.group;
    const before = streamView(game, selected);
    const corrected = fix(original, 'fix', 'original', flyOut);
    const after = liveReducer(game, { type: 'snapshot', snapshot: snapshot(corrected, { afterSeq: game.revision }) });

    expect(before).toMatchObject({ kind: 'clip', text: '#15 hits a home run to center (CF)' });
    expect(streamView(after, selected)).toMatchObject({
      kind: 'clip', src: before?.src, text: '#15 flies out to center (CF)', score: { away: 0, home: 0 },
    });

    const removed = fix(corrected, 'remove', 'fix', []);
    const afterRemoval = liveReducer(after, { type: 'snapshot', snapshot: snapshot(removed, { afterSeq: after.revision }) });
    expect(streamView(afterRemoval, selected)).toMatchObject({ kind: 'live' });
  });
});
