import type { Timestamp } from '@sandlot/engine';

/** The recording's clock minus the scorer phone's clock: when the clap shows on the video, less when the scorer timed the play it matches. */
export function clockOffsetMs(clapOnRecordingMs: number, playAt: Timestamp): number {
  return Math.round(clapOnRecordingMs - Date.parse(playAt));
}

export function offsetSql(gameId: string, offsetMs: number): string {
  return `update public.recordings set clock_offset_ms = ${offsetMs} where game_id = '${gameId}';`;
}

export type DelaySummary = { count: number; medianMs: number; maxMs: number };

export function summarizeDelays(delaysMs: number[]): DelaySummary | null {
  if (delaysMs.length === 0) return null;
  const sorted = [...delaysMs].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const medianMs = sorted.length % 2 === 1 ? sorted[middle]! : Math.round((sorted[middle - 1]! + sorted[middle]!) / 2);
  return { count: sorted.length, medianMs, maxMs: sorted.at(-1)! };
}
