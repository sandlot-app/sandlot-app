import { requestRecordingPermissionsAsync, useAudioStream } from 'expo-audio';
import { useMemo, useRef } from 'react';
import { SAMPLE_RATE } from './pcm.ts';
import type { Mic, VoiceDeps } from './press.ts';
import type { OpenSocket, Socket } from './realtime.ts';
import { stubDeps, stubPhrases } from './stub.ts';
import { createVoiceApi } from './voice-api.ts';
import { project, token } from '../sync/backend';

// The phone's side of voice: an anonymous Supabase sign-in, the expo-audio mic stream, and React Native's WebSocket.

const api = project ? createVoiceApi({ ...project, token, fetch: (input, init) => fetch(input, init) }) : null;

/** React Native's WebSocket, whose third argument (headers) the DOM typings don't know. */
type NativeWebSocket = new (url: string, protocols: null, options: { headers: Record<string, string> }) => Socket;

const openSocket: OpenSocket = (address, secret) =>
  new (WebSocket as unknown as NativeWebSocket)(address, null, { headers: { Authorization: `Bearer ${secret}` } });

/** What a press needs on this phone, or null when voice isn't set up, so a press says "Voice is unavailable". */
export function useVoiceDeps(): VoiceDeps | null {
  const listener = useRef<((chunk: Uint8Array, sampleRate: number) => void) | null>(null);
  const { stream } = useAudioStream({
    sampleRate: SAMPLE_RATE,
    channels: 1,
    encoding: 'int16',
    onBuffer: (buffer) => listener.current?.(new Uint8Array(buffer.data), buffer.sampleRate),
  });
  // Each start gets a turn, so a release during the permission prompt or a slow start stops the stream it began.
  const turn = useRef(0);
  const mic = useMemo<Mic>(() => ({
    async start(onChunk) {
      const mine = ++turn.current;
      const { granted } = await requestRecordingPermissionsAsync();
      if (!granted) return false;
      if (mine !== turn.current) return true;
      listener.current = onChunk;
      await stream.start();
      if (mine !== turn.current) stream.stop();
      return true;
    },
    stop() {
      turn.current += 1;
      listener.current = null;
      if (stream.isStreaming) stream.stop();
    },
  }), [stream]);
  // One object per mic, so the screen's voice controller lives as long as the stream does.
  const real = useMemo(() => (api ? { mic, api, openSocket } : null), [mic]);
  const stub = useMemo(() => (__DEV__ && stubPhrases.length ? stubDeps(stubPhrases) : null), []);
  return stub ?? real;
}
