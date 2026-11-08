import { describe, expect, it } from 'vitest';
import type { Timestamp } from '@sandlot/engine';
import { clipWindow } from '../src/clips.ts';
import { clockOffsetMs, offsetSql, summarizeDelays } from '../src/tools.ts';

const at = (iso: string) => iso as Timestamp;

describe('clockOffsetMs', () => {
  it('is how far the recording clock runs ahead of the scorer phone', () => {
    expect(clockOffsetMs(Date.parse('2026-10-30T18:00:32.250Z'), at('2026-10-30T18:00:30.000Z'))).toBe(2_250);
    expect(clockOffsetMs(Date.parse('2026-10-30T18:00:28.000Z'), at('2026-10-30T18:00:30.000Z'))).toBe(-2_000);
  });

  it('puts the clap 12 seconds into the clip of the play it was matched to', () => {
    const play = at('2026-10-30T18:00:30.000Z');
    const clap = Date.parse('2026-10-30T18:00:41.000Z');

    const { start } = clipWindow(play, clockOffsetMs(clap, play));

    expect(clap / 1000 - start).toBe(12);
  });
});

describe('offsetSql', () => {
  it('updates only the clock offset of that game', () => {
    expect(offsetSql('0c1cf306-713c-4662-a2c1-341da998db6d', 2250)).toBe(
      "update public.recordings set clock_offset_ms = 2250 where game_id = '0c1cf306-713c-4662-a2c1-341da998db6d';",
    );
  });
});

describe('summarizeDelays', () => {
  it('gives the count, the median and the slowest play', () => {
    expect(summarizeDelays([900, 3_000, 1_200])).toEqual({ count: 3, medianMs: 1_200, maxMs: 3_000 });
    expect(summarizeDelays([1_000, 2_000])).toEqual({ count: 2, medianMs: 1_500, maxMs: 2_000 });
  });

  it('has nothing to say before a play arrives', () => {
    expect(summarizeDelays([])).toBeNull();
  });
});
