import type { Timestamp } from '@sandlot/engine';

/** A game's Mux recording, as the `recordings` table stores it. */
export type Recording = { playbackId: string; clockOffsetMs: number };

/** The play happens before the scorer starts the action, so a clip starts well before `at` (docs/contract.md). */
export const CLIP_BEFORE_MS = 12_000;
export const CLIP_AFTER_MS = 5_000;

/** Reads a `recordings` row, or null when there is none or it isn't one. */
export function parseRecording(row: unknown): Recording | null {
  if (!row || typeof row !== 'object') return null;
  const { playback_id: playbackId, clock_offset_ms: clockOffsetMs } = row as Record<string, unknown>;
  if (typeof playbackId !== 'string' || !/^[A-Za-z0-9]{1,128}$/.test(playbackId)) return null;
  if (typeof clockOffsetMs !== 'number' || !Number.isInteger(clockOffsetMs)) return null;
  return { playbackId, clockOffsetMs };
}

/**
 * The part of the recording that shows the play the scorer started at `at`, in epoch seconds on the recording's clock.
 * Mux clips to whole segments that include both ends, so rounding outward never cuts the play short.
 */
export function clipWindow(at: Timestamp, clockOffsetMs: number): { start: number; end: number } {
  const onRecording = Date.parse(at) + clockOffsetMs;
  return {
    start: Math.floor((onRecording - CLIP_BEFORE_MS) / 1000),
    end: Math.ceil((onRecording + CLIP_AFTER_MS) / 1000),
  };
}

export function streamUrl(playbackId: string): string {
  return `https://stream.mux.com/${playbackId}.m3u8`;
}

/** Mux's instant clip: the recording's playback URL limited to the play's window. Nothing is cut or copied. */
export function clipUrl(recording: Recording, at: Timestamp): string {
  const { start, end } = clipWindow(at, recording.clockOffsetMs);
  return `${streamUrl(recording.playbackId)}?program_start_time=${start}&program_end_time=${end}`;
}
