import type { VoiceDeps } from './press.ts';

// Voice scoring runs on phones. The web build keeps the bar, and a press says voice is unavailable.

export function useVoiceDeps(): VoiceDeps | null {
  return null;
}
