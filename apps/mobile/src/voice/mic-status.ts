import type { VoiceDeps } from './press.ts';

// What the voice bar says about the microphone while no press is open. Kept apart from the warm mic so the screen
// can show it without importing anything else.

/**
 * - `off`: no warm mic. A press starts the mic on touch-down. This is the web build, Android until its device check
 *   passes (ADR 0005), a phone with voice not set up, and the moment before the mic is up.
 * - `explain`: first time on this screen. The line is up and iOS hasn't asked yet.
 * - `ready`: the warm mic is listening on the phone and keeping only the last second.
 * - `refused`: the scorer said no. Taps still work.
 * - `busy`: another app holds the mic (a phone call, for example). The next press tries again.
 */
export type MicStatus = 'off' | 'explain' | 'ready' | 'refused' | 'busy';

/** What the scoring screen gets from voice-service: what a press needs, and what the bar says about the mic. */
export type VoiceSetup = { voice: VoiceDeps | null; mic: MicStatus };

/** The one line that explains the warm mic before iOS asks for the microphone. */
export const explainLine = "Sandlot listens only while you're on this screen, and only sends what you say after you press.";

/** The voice bar's words. Listening wins over whatever the mic was doing before the press. */
export function barLabel(mic: MicStatus, listening: boolean): string {
  if (listening) return 'Listening…';
  switch (mic) {
    case 'ready': return 'Mic ready';
    case 'refused': return 'Turn on the mic in Settings';
    case 'busy': return 'Mic busy · tap to score';
    case 'off':
    case 'explain': return 'Hold to score by voice';
  }
}
