import { createClient } from '@supabase/supabase-js';
import { requestRecordingPermissionsAsync, useAudioStream } from 'expo-audio';
import Storage from 'expo-sqlite/kv-store';
import { useMemo, useRef } from 'react';
import { SAMPLE_RATE } from './pcm.ts';
import type { Mic, VoiceDeps } from './press.ts';
import type { OpenSocket, Socket } from './realtime.ts';
import { stubDeps, stubPhrases } from './stub.ts';
import { createVoiceApi } from './voice-api.ts';

// The phone's side of voice: an anonymous Supabase sign-in, the expo-audio mic stream, and React Native's WebSocket.

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

const supabase = url && key ? createClient(url, key, {
  // Each press reads the session, which refreshes an expired token, so no background timer is needed.
  auth: { storage: Storage, persistSession: true, autoRefreshToken: false, detectSessionInUrl: false },
}) : null;

/** The signed-in phone's token. An anonymous sign-in is enough for the demo. */
async function token(fresh: boolean): Promise<string | null> {
  if (!supabase) return null;
  const current = fresh ? await supabase.auth.refreshSession() : await supabase.auth.getSession();
  if (current.data.session) return current.data.session.access_token;
  const signedIn = await supabase.auth.signInAnonymously();
  return signedIn.error ? null : signedIn.data.session?.access_token ?? null;
}

const api = url && key ? createVoiceApi({ url, key, token, fetch: (input, init) => fetch(input, init) }) : null;

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
  const stub = useMemo(() => (__DEV__ && stubPhrases.length ? stubDeps(stubPhrases) : null), []);
  if (stub) return stub;
  return api ? { mic, api, openSocket } : null;
}
