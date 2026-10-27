import { SAMPLE_RATE } from '../src/voice/pcm.ts';
import type { Mic } from '../src/voice/press.ts';
import type { Socket } from '../src/voice/realtime.ts';
import type { ParseBody, Parsed, Result, Session, VoiceApi } from '../src/voice/voice-api.ts';

// Stand-ins for the mic, the voice functions and OpenAI's socket, shared by the voice tests.

export const session: Session = { url: 'wss://api.openai.com/v1/realtime?intent=transcription', secret: 'ek_test', expiresAt: 0, sampleRate: SAMPLE_RATE };
export const timeouts = { openMs: 30, finalMs: 30 };
export const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

export function fakeMic(granted = true) {
  let push: ((chunk: Uint8Array, rate: number) => void) | null = null;
  const mic: Mic & { stopped: number; push(bytes: number[], rate?: number): void } = {
    stopped: 0,
    async start(onChunk) { push = onChunk; return granted; },
    stop() { mic.stopped += 1; },
    push(bytes, rate = SAMPLE_RATE) { push!(Uint8Array.from(bytes), rate); },
  };
  return mic;
}

export function fakeSocket() {
  const sent: Record<string, unknown>[] = [];
  const socket: Socket & { sent: typeof sent; closed: boolean; open(): void; server(event: object): void } = {
    sent, closed: false,
    onopen: null, onmessage: null, onerror: null, onclose: null,
    send(data) { sent.push(JSON.parse(data) as Record<string, unknown>); },
    close() { socket.closed = true; },
    open() { socket.onopen!(); },
    server(event) { socket.onmessage!({ data: JSON.stringify(event) }); },
  };
  return socket;
}

export function fakeApi(sessionResult: Result<Session> = { ok: true, value: session }, parseResult: Result<Parsed> = { ok: true, value: { transcript: '', parsed: null } }) {
  const parsed: ParseBody[] = [];
  const api: VoiceApi & { parsed: ParseBody[] } = {
    parsed,
    session: async () => sessionResult,
    parse: async (body) => { parsed.push(body); return parseResult; },
  };
  return api;
}
