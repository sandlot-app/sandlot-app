import { SAMPLE_RATE } from '../../src/voice/pcm.ts';
import { openLive, type Socket } from '../../src/voice/realtime.ts';

// Streams one clip through the phone's own live client (src/voice/realtime.ts), paced like a real press.

const BYTES_PER_MS = SAMPLE_RATE * 2 / 1000;
const bytes = (ms: number) => Math.round(ms * BYTES_PER_MS) & ~1;

/** The clip without audio the phone never hands over: before the mic stream starts, and after the finger lifts. */
export function cut(pcm: Uint8Array, startMs: number, endMs: number): Uint8Array {
  const start = Math.min(bytes(startMs), pcm.length);
  return pcm.subarray(start, Math.max(start, pcm.length - bytes(endMs)));
}

export type Streamed = {
  /** The final transcript, or null when the stream failed or gave none in time (the phone would fall back to the clip). */
  transcript: string | null;
  /** Milliseconds from the release to the final transcript (or to giving up). */
  finalMs: number;
};

/** Node's WebSocket uses a client-secret subprotocol; the phone uses its native Authorization header. */
function openSocket(url: string, secret: string): Socket {
  const ws = new WebSocket(url, ['realtime', `openai-insecure-api-key.${secret}`]);
  const socket: Socket = { send: (data) => ws.send(data), close: () => ws.close(), onopen: null, onmessage: null, onerror: null, onclose: null };
  ws.onopen = () => socket.onopen?.();
  ws.onmessage = (event) => socket.onmessage?.({ data: event.data });
  ws.onerror = () => socket.onerror?.();
  ws.onclose = () => socket.onclose?.();
  return socket;
}

export async function streamClip(session: { url: string; secret: string }, pcm: Uint8Array, chunkMs = 100): Promise<Streamed> {
  const live = openLive(openSocket(session.url, session.secret), () => {});
  try {
    const step = bytes(chunkMs);
    for (let at = 0; at < pcm.length; at += step) {
      live.append(pcm.subarray(at, at + step));
      await new Promise((resolve) => setTimeout(resolve, chunkMs));
    }
    const released = performance.now();
    const transcript = await live.finish();
    return { transcript, finalMs: Math.round(performance.now() - released) };
  } finally {
    live.close();
  }
}
