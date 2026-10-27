import { toBase64 } from './pcm.ts';

// One press's live transcription over OpenAI's Realtime socket. voice-session already set the session up
// (gpt-live-transcribe, 24 kHz PCM, no turn detection), so the phone only appends audio and commits on release.

/** The part of a WebSocket this uses, so tests can drive it. */
export type Socket = {
  send(data: string): void;
  close(): void;
  onopen: (() => void) | null;
  onmessage: ((event: { data: unknown }) => void) | null;
  onerror: (() => void) | null;
  onclose: (() => void) | null;
};

/** React Native's WebSocket takes headers, so the client secret goes in Authorization. */
export type OpenSocket = (url: string, secret: string) => Socket;

export type Live = {
  /** Sends a chunk now, or once the socket opens. */
  append(chunk: Uint8Array): void;
  /** Commits the audio and resolves with the final transcript, or null when streaming failed. */
  finish(): Promise<string | null>;
  close(): void;
};

export type LiveTimeouts = {
  /** How long a release waits for a socket that's still connecting. */
  openMs: number;
  /** How long it waits for the final transcript after the commit. */
  finalMs: number;
};

export const liveTimeouts: LiveTimeouts = { openMs: 3000, finalMs: 5000 };

type ServerEvent = { type?: unknown; delta?: unknown; transcript?: unknown };

export function openLive(socket: Socket, onWords: (words: string) => void, timeouts: LiveTimeouts = liveTimeouts): Live {
  let state: 'connecting' | 'open' | 'failed' | 'closed' = 'connecting';
  const queued: Uint8Array[] = [];
  let words = '';
  let final: string | null = null;
  const waiters = new Set<() => void>();
  const wake = () => { for (const waiter of [...waiters]) waiter(); };

  const send = (chunk: Uint8Array) => socket.send(JSON.stringify({ type: 'input_audio_buffer.append', audio: toBase64(chunk) }));
  const fail = () => {
    if (state === 'closed') return;
    state = 'failed';
    wake();
  };

  socket.onopen = () => {
    if (state !== 'connecting') return;
    state = 'open';
    try {
      for (const chunk of queued.splice(0)) send(chunk);
    } catch {
      fail();
    }
    wake();
  };
  socket.onerror = fail;
  socket.onclose = () => { if (final === null) fail(); };
  socket.onmessage = ({ data }) => {
    let event: ServerEvent;
    try {
      event = JSON.parse(String(data)) as ServerEvent;
    } catch {
      return;
    }
    if (event.type === 'conversation.item.input_audio_transcription.delta' && typeof event.delta === 'string') {
      words += event.delta;
      onWords(words);
    } else if (event.type === 'conversation.item.input_audio_transcription.completed' && typeof event.transcript === 'string') {
      final = event.transcript;
      wake();
    } else if (event.type === 'error') {
      fail();
    }
  };

  /** Resolves when `done()` holds or the time runs out. */
  const until = (done: () => boolean, ms: number) => new Promise<void>((resolve) => {
    if (done()) return resolve();
    const timer = setTimeout(finish, ms);
    function finish() {
      clearTimeout(timer);
      waiters.delete(check);
      resolve();
    }
    function check() { if (done()) finish(); }
    waiters.add(check);
  });

  return {
    append(chunk) {
      if (state === 'connecting') queued.push(chunk);
      else if (state === 'open') {
        try {
          send(chunk);
        } catch {
          fail();
        }
      }
    },
    async finish() {
      await until(() => state !== 'connecting', timeouts.openMs);
      if (state !== 'open') return null;
      try {
        socket.send(JSON.stringify({ type: 'input_audio_buffer.commit' }));
      } catch {
        return null;
      }
      await until(() => final !== null || state !== 'open', timeouts.finalMs);
      return final;
    },
    close() {
      state = 'closed';
      wake();
      try {
        socket.close();
      } catch {
        // Already closed.
      }
    },
  };
}
