import { SAMPLE_RATE } from './pcm.ts';
import type { VoiceDeps } from './press.ts';
import type { Socket } from './realtime.ts';

// A stand-in for the mic, voice-session and OpenAI's socket, for the Mac simulator check only. A simulator can't
// speak, and the functions aren't deployed yet. Start Metro with EXPO_PUBLIC_VOICE_STUB="strike swinging|strike" and
// each finished press hears the next phrase, word by word, as the real socket sends it. The press controller,
// route() and the engine all run for real. Development builds only: voice-service.ts checks __DEV__.

export const stubPhrases = String(process.env.EXPO_PUBLIC_VOICE_STUB ?? '').split('|').map((phrase) => phrase.trim()).filter(Boolean);

const chunkMs = 100;
const wordMs = 500;

/** "strike swinging" arrives as "strike", " swing", "ing", so the card shows words still being recognized. */
function pieces(phrase: string): string[] {
  return phrase.split(' ').flatMap((word, index) => {
    const spaced = index ? ` ${word}` : word;
    return word.length > 6 ? [spaced.slice(0, spaced.length - 3), spaced.slice(-3)] : [spaced];
  });
}

export function stubDeps(phrases: string[]): VoiceDeps {
  let heard = 0;
  let timer: ReturnType<typeof setInterval> | null = null;
  return {
    mic: {
      async start(onChunk) {
        timer = setInterval(() => onChunk(new Uint8Array(SAMPLE_RATE * 2 * chunkMs / 1000), SAMPLE_RATE), chunkMs);
        return true;
      },
      stop() {
        if (timer) clearInterval(timer);
        timer = null;
      },
    },
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
          later(150, () => {
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
