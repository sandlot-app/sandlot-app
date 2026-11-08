import { getRecordingPermissionsAsync, requestRecordingPermissionsAsync, useAudioStream } from 'expo-audio';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import type { MicStatus, VoiceSetup } from './mic-status.ts';
import { SAMPLE_RATE } from './pcm.ts';
import type { OpenSocket, Socket } from './realtime.ts';
import { stubDeps, stubMic, stubPhrases, stubSource } from './stub.ts';
import { createVoiceApi } from './voice-api.ts';
import { createWarmMic, type AudioSource } from './warm-mic.ts';
import { project, token } from '../sync/backend';

// The phone's side of voice: an anonymous Supabase sign-in, the expo-audio mic stream, and React Native's WebSocket.

const api = project ? createVoiceApi({ ...project, token, fetch: (input, init) => fetch(input, init) }) : null;

/** React Native's WebSocket, whose third argument (headers) the DOM typings don't know. */
type NativeWebSocket = new (url: string, protocols: null, options: { headers: Record<string, string> }) => Socket;

const openSocket: OpenSocket = (address, secret) =>
  new (WebSocket as unknown as NativeWebSocket)(address, null, { headers: { Authorization: `Bearer ${secret}` } });

/**
 * Where the warm mic runs (ADR 0005). Android stays off until its device check passes: there, a press starts the mic on
 * touch-down, as before.
 */
const warmMicHere = Platform.OS === 'ios';

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** The expo-audio mic stream, as the warm mic opens and closes it. */
function useAudioSource(): AudioSource {
  const listener = useRef<((chunk: Uint8Array, sampleRate: number) => void) | null>(null);
  const { stream } = useAudioStream({
    sampleRate: SAMPLE_RATE,
    channels: 1,
    encoding: 'int16',
    onBuffer: (buffer) => listener.current?.(new Uint8Array(buffer.data), buffer.sampleRate),
  });
  return useMemo<AudioSource>(() => ({
    async permission() {
      const { granted, status } = await getRecordingPermissionsAsync();
      return granted ? 'granted' : String(status) === 'undetermined' ? 'undetermined' : 'denied';
    },
    async open(onChunk) {
      // Asks only while the scorer hasn't answered. After that the answer comes back without a prompt.
      const { granted } = await requestRecordingPermissionsAsync();
      if (!granted) return 'refused';
      listener.current = onChunk;
      try {
        await stream.start();
      } catch {
        // Another app holds the mic, such as a phone call.
        listener.current = null;
        return 'failed';
      }
      return 'started';
    },
    close() {
      listener.current = null;
      if (stream.isStreaming) stream.stop();
    },
  }), [stream]);
}

/**
 * What a press needs on this phone, or null when voice isn't set up, so a press says "Voice is unavailable". `onScreen`
 * is true while the scoring bar is showing and the screen is focused. The warm mic follows it and the app's foreground
 * state, and stops when either goes away.
 */
export function useVoiceDeps(onScreen: boolean): VoiceSetup {
  const real = useAudioSource();
  const stubbed = __DEV__ && stubPhrases.length > 0;
  const source = useMemo(() => (stubbed ? stubSource(stubMic) : real), [stubbed, real]);
  const [mic, setMic] = useState<MicStatus>('off');
  // One warm mic per stream, so the screen's voice controller lives as long as the stream does.
  const warm = useMemo(() => createWarmMic({ source, now: Date.now, wait, onStatus: setMic }), [source]);
  const voice = useMemo(() => {
    if (stubbed) return stubDeps(stubPhrases, warm.mic);
    return api ? { mic: warm.mic, api, openSocket } : null;
  }, [stubbed, warm]);
  // The stub keeps today's touch-down mic unless a run asks for the warm one (EXPO_PUBLIC_VOICE_STUB_MIC).
  const listens = warmMicHere && voice !== null && (!stubbed || stubMic !== '');
  useEffect(() => {
    if (!listens || !onScreen) return;
    const follow = (state: string | null | undefined) => warm.warm(state === 'active');
    follow(AppState.currentState);
    const subscription = AppState.addEventListener('change', follow);
    return () => {
      subscription.remove();
      warm.warm(false);
    };
  }, [warm, listens, onScreen]);
  return { voice, mic: listens && onScreen ? mic : 'off' };
}
