import { describe, expect, it } from 'vitest';
import type { Timestamp } from '@sandlot/engine';
import { clipUrl, clipWindow, parseRecording } from '../src/clips.ts';

const at = (iso: string) => iso as Timestamp;
const epoch = (iso: string) => Date.parse(iso) / 1000;

describe('clipWindow', () => {
  it('starts 12 seconds before the scorer started the play and ends 5 seconds after', () => {
    expect(clipWindow(at('2026-10-30T18:00:30.000Z'), 0)).toEqual({
      start: epoch('2026-10-30T18:00:18.000Z'),
      end: epoch('2026-10-30T18:00:35.000Z'),
    });
  });

  it('moves the window onto the recording clock by the clap offset', () => {
    expect(clipWindow(at('2026-10-30T18:00:30.000Z'), 2_000)).toEqual({
      start: epoch('2026-10-30T18:00:20.000Z'),
      end: epoch('2026-10-30T18:00:37.000Z'),
    });
    expect(clipWindow(at('2026-10-30T18:00:30.000Z'), -2_000)).toEqual({
      start: epoch('2026-10-30T18:00:16.000Z'),
      end: epoch('2026-10-30T18:00:33.000Z'),
    });
  });

  it('rounds outward to whole seconds so the play is never cut short', () => {
    expect(clipWindow(at('2026-10-30T18:00:30.400Z'), 0)).toEqual({
      start: epoch('2026-10-30T18:00:18.000Z'),
      end: epoch('2026-10-30T18:00:36.000Z'),
    });
  });
});

describe('clipUrl', () => {
  it('is the Mux playback URL limited to the play', () => {
    expect(clipUrl({ playbackId: 'abc123', clockOffsetMs: 0 }, at('2026-10-30T18:00:30.000Z'))).toBe(
      `https://stream.mux.com/abc123.m3u8?program_start_time=${epoch('2026-10-30T18:00:18.000Z')}` +
        `&program_end_time=${epoch('2026-10-30T18:00:35.000Z')}`,
    );
  });
});

describe('parseRecording', () => {
  it('reads a recordings row', () => {
    expect(parseRecording({ playback_id: 'abc123', clock_offset_ms: -1500 })).toEqual({
      playbackId: 'abc123',
      clockOffsetMs: -1500,
    });
  });

  it('is null when the game has no recording or the row is malformed', () => {
    expect(parseRecording(null)).toBeNull();
    expect(parseRecording({ playback_id: 'abc/../x', clock_offset_ms: 0 })).toBeNull();
    expect(parseRecording({ playback_id: 'abc123', clock_offset_ms: '0' })).toBeNull();
  });
});
