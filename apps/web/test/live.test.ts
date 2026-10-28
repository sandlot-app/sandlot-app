import { describe, expect, it } from 'vitest';
import { initialLiveGame, liveReducer, needsFetch, type LiveGame } from '../src/live.ts';
import { sampleEvents, serverState, snapshot } from './helpers.ts';

const events = sampleEvents();
const firstPlays = events.filter((event) => event.seq <= 8);
const loaded = (game: LiveGame = initialLiveGame, upTo = 8): LiveGame =>
  liveReducer(game, { type: 'snapshot', snapshot: snapshot(events.filter((event) => event.seq <= upTo)) });

describe('liveReducer', () => {
  it('loads the first snapshot and computes plays and state from its events', () => {
    const game = loaded();

    expect(game.revision).toBe(8);
    expect(game.events).toHaveLength(8);
    expect(game.plays.at(-1)?.text).toBe('#17 steals 2nd');
    expect(game.state).toMatchObject({ inning: 1, half: 'top', outs: 0, bases: { 2: { player: { id: 'away-1' } } } });
    expect(game.status).toBe('connecting');
  });

  it('keeps the recording when later snapshots arrive', () => {
    const recording = { playbackId: 'abc123', clockOffsetMs: 1500 };
    const withVideo = liveReducer(loaded(), { type: 'recording', recording });
    const next = liveReducer(withVideo, { type: 'snapshot', snapshot: snapshot(events, { afterSeq: 8 }) });

    expect(next.recording).toEqual(recording);
    expect(next.revision).toBeGreaterThan(withVideo.revision);
  });

  it('keeps the same game when the recording is unchanged and takes a new asset or offset', () => {
    const withVideo = liveReducer(loaded(), { type: 'recording', recording: { playbackId: 'abc123', clockOffsetMs: 0 } });

    expect(liveReducer(withVideo, { type: 'recording', recording: { playbackId: 'abc123', clockOffsetMs: 0 } })).toBe(withVideo);
    expect(
      liveReducer(withVideo, { type: 'recording', recording: { playbackId: 'abc123', clockOffsetMs: 1800 } }).recording,
    ).toEqual({ playbackId: 'abc123', clockOffsetMs: 1800 });
    expect(
      liveReducer(withVideo, { type: 'recording', recording: { playbackId: 'newAsset', clockOffsetMs: 0 } }).recording,
    ).toEqual({ playbackId: 'newAsset', clockOffsetMs: 0 });
  });

  it('accepts a game that has no events yet', () => {
    const game = liveReducer(initialLiveGame, { type: 'snapshot', snapshot: snapshot([]) });

    expect(game.pins).not.toBeNull();
    expect(game.plays).toEqual([]);
    expect(game.state).toMatchObject({ status: 'pregame' });
    expect(needsFetch(game, 0)).toBe(false);
  });

  it('appends only the events it has not seen when a higher revision arrives', () => {
    const next = liveReducer(loaded(), { type: 'snapshot', snapshot: snapshot(events, { afterSeq: 5 }) });

    expect(next.revision).toBe(events.at(-1)!.seq);
    expect(next.events).toEqual(events);
    expect(next.plays).toHaveLength(12);
    expect(next.state).toMatchObject({ half: 'bottom', outs: 0 });
  });

  it('ignores a snapshot with an equal or lower revision', () => {
    const game = loaded();

    expect(liveReducer(game, { type: 'snapshot', snapshot: snapshot(firstPlays) })).toBe(game);
    expect(liveReducer(game, { type: 'snapshot', snapshot: snapshot(firstPlays.slice(0, 5)) })).toBe(game);
  });

  it('asks for a fetch only when a message carries a higher revision', () => {
    const game = loaded();

    expect(needsFetch(game, 9)).toBe(true);
    expect(needsFetch(game, 8)).toBe(false);
    expect(needsFetch(game, 3)).toBe(false);
    expect(needsFetch(initialLiveGame, 0)).toBe(true);
  });

  it('falls back to the server state when the game was recorded under another engine version', () => {
    const cached = { ...serverState(events), score: { away: 4, home: 2 } };

    const game = liveReducer(initialLiveGame, {
      type: 'snapshot',
      snapshot: snapshot(events, { state: cached, pins: { engineVersion: '0.0.1' } }),
    });

    expect(game.state).toEqual(cached);
    expect(game.plays).toHaveLength(12);
    expect(game.plays.every((play) => play.scoreAfter === null)).toBe(true);
  });

  it('reports a game that cannot be seen, and drops what it held', () => {
    const game = liveReducer(loaded(), { type: 'snapshot', snapshot: null });

    expect(game).toMatchObject({ status: 'not_found', events: [], plays: [], state: null, pins: null });
    expect(liveReducer(game, { type: 'connection', status: 'live' }).status).toBe('not_found');
  });

  it('follows the connection and recovers from not found once a snapshot arrives', () => {
    const reconnecting = liveReducer(loaded(), { type: 'connection', status: 'reconnecting' });
    expect(reconnecting.status).toBe('reconnecting');
    expect(liveReducer(reconnecting, { type: 'connection', status: 'live' }).status).toBe('live');

    const hidden = liveReducer(initialLiveGame, { type: 'snapshot', snapshot: null });
    expect(loaded(hidden).status).toBe('live');
  });
});
