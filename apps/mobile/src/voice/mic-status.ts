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

/** Where the voice bar is in one press: waiting, the mic open, the play being read, or just saved. */
export type BarPhase = 'idle' | 'listening' | 'reading' | 'saved';

/**
 * What the voice bar shows and says. `button` is false while a play is read or just saved: the bar is then only a line,
 * with a spinner or a check, and the button comes back after. The open mic wins over what the mic was doing before.
 */
export type BarView = { label: string; accessibilityLabel: string; lines: 1 | 2; button: boolean };

const tap = 'Tap to score by voice';
const settings = 'Turn on the mic in Settings';
const busy = 'Mic busy · tap to score';

export function barView(mic: MicStatus, phase: BarPhase): BarView {
  switch (phase) {
    case 'listening': return { label: 'Listening… tap to finish', accessibilityLabel: 'Listening. Tap to finish', lines: 1, button: true };
    case 'reading': return { label: 'Reading your play…', accessibilityLabel: 'Reading your play', lines: 1, button: false };
    case 'saved': return { label: 'Saved', accessibilityLabel: 'Saved', lines: 1, button: false };
    case 'idle': break;
  }
  switch (mic) {
    case 'ready': return { label: tap, accessibilityLabel: `Mic ready. ${tap}`, lines: 1, button: true };
    // These two don't fit one line on a narrow phone.
    case 'refused': return { label: settings, accessibilityLabel: settings, lines: 2, button: true };
    case 'busy': return { label: busy, accessibilityLabel: busy, lines: 2, button: true };
    case 'off':
    case 'explain': return { label: tap, accessibilityLabel: tap, lines: 1, button: true };
  }
}
