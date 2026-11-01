import { SAMPLE_RATE } from './pcm.ts';
import type { Mic, VoiceDeps } from './press.ts';
import type { Socket } from './realtime.ts';
import type { AudioSource, Permission } from './warm-mic.ts';

// A stand-in for the mic, voice-session and OpenAI's socket, for the Mac simulator check only. A simulator can't
// speak, and the functions aren't deployed yet. Start Metro with EXPO_PUBLIC_VOICE_STUB="strike swinging|strike" and
// each finished press hears the next phrase, word by word, as the real socket sends it. A press ends on the second tap. The press controller,
// route() and the engine all run for real. Development builds only: voice-service.ts checks __DEV__.
//
// The mic stand-in is silence, and by default it only runs during a press, like a phone with no warm mic. Add
// EXPO_PUBLIC_VOICE_STUB_MIC to turn the warm mic on over it, so the bar's states can be checked:
//   granted       the idle bar reads "Tap to score by voice" with "Mic ready" in its accessibility label
//   undetermined  the first-open line, then "Mic ready" once the stand-in says yes (iOS has no prompt to answer here)
//   denied        the Settings line, and a press says it can't listen
//   busy          the "Mic busy" line, as when another app holds the mic
//
// EXPO_PUBLIC_VOICE_STUB_READ_MS (default 150) is how long the stand-in takes to answer after a press ends, so the bar's
// "Reading your play…" state stays up long enough to film.

export const stubPhrases = String(process.env.EXPO_PUBLIC_VOICE_STUB ?? '').split('|').map((phrase) => phrase.trim()).filter(Boolean);

export type StubMic = '' | 'granted' | 'undetermined' | 'denied' | 'busy';
const stubMics: readonly string[] = ['granted', 'undetermined', 'denied', 'busy'];
const asked = String(process.env.EXPO_PUBLIC_VOICE_STUB_MIC ?? '').trim();
export const stubMic: StubMic = stubMics.includes(asked) ? asked as StubMic : '';

const askedMs = Number(process.env.EXPO_PUBLIC_VOICE_STUB_READ_MS);
const readMs = Number.isFinite(askedMs) && askedMs >= 0 ? askedMs : 150;
const chunkMs = 100;
const wordMs = 500;

/** "strike swinging" arrives as "strike", " swing", "ing", so the card shows words still being recognized. */
function pieces(phrase: string): string[] {
  return phrase.split(' ').flatMap((word, index) => {
    const spaced = index ? ` ${word}` : word;
    return word.length > 6 ? [spaced.slice(0, spaced.length - 3), spaced.slice(-3)] : [spaced];
  });
}

/** Silence every 100 ms while open, with the permission answer the run asked for. */
export function stubSource(mode: StubMic): AudioSource {
  let permission: Permission = mode === 'denied' ? 'denied' : mode === 'undetermined' ? 'undetermined' : 'granted';
  let timer: ReturnType<typeof setInterval> | null = null;
  return {
    async permission() { return permission; },
    async open(onChunk) {
      if (permission === 'undetermined') permission = 'granted';
      if (permission === 'denied') return 'refused';
      if (mode === 'busy') return 'failed';
      timer = setInterval(() => onChunk(new Uint8Array(SAMPLE_RATE * 2 * chunkMs / 1000), SAMPLE_RATE), chunkMs);
      return 'started';
    },
    close() {
      if (timer) clearInterval(timer);
      timer = null;
    },
  };
}

export function stubDeps(phrases: string[], mic: Mic): VoiceDeps {
  let heard = 0;
  return {
    mic,
    api: {
      session: async () => ({ ok: true, value: { url: 'wss://voice-stub.invalid', secret: 'stub', expiresAt: 0, sampleRate: SAMPLE_RATE } }),
      parse: async () => ({ ok: false, failure: 'voice_unavailable' }),
    },
    openSocket() {
      const phrase = phrases[heard % phrases.length]!;
      const timers: ReturnType<typeof setTimeout>[] = [];
      const later = (ms: number, action: () => void) => { timers.push(setTimeout(action, ms)); };
      const message = (event: object) => socket.onmessage?.({ data: JSON.stringify(event) });
      const socket: Socket = {
        onopen: null, onmessage: null, onerror: null, onclose: null,
        send(data) {
          if ((JSON.parse(data) as { type: string }).type !== 'input_audio_buffer.commit') return;
          later(readMs, () => {
            heard += 1;
            message({ type: 'conversation.item.input_audio_transcription.completed', item_id: 'stub', transcript: phrase });
          });
        },
        close() { for (const pending of timers) clearTimeout(pending); },
      };
      later(50, () => {
        socket.onopen?.();
        pieces(phrase).forEach((delta, index) => later(wordMs * (index + 1), () =>
          message({ type: 'conversation.item.input_audio_transcription.delta', item_id: 'stub', delta })));
      });
      return socket;
    },
  };
}
