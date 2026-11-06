import type { VoiceSetup } from './mic-status.ts';

// Voice scoring runs on phones. The web build keeps the bar, and a press says voice is unavailable.

const none: VoiceSetup = { voice: null, mic: 'off' };

export function useVoiceDeps(onScreen: boolean): VoiceSetup {
  void onScreen;
  return none;
}
