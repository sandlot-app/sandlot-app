import { isEmptyTranscript, parsePhrase, type ParseResult } from '@sandlot/voice';
import { Clip, SAMPLE_RATE, toBase64 } from './pcm.ts';
import { liveTimeouts, openLive, type Live, type LiveTimeouts, type OpenSocket } from './realtime.ts';
import type { ParseContext, Session, VoiceApi, VoiceFailure } from './voice-api.ts';

// One tap-to-talk press of the voice bar. A press starts with the second before the touch when the mic is warm (ADR
// 0005), so no words are lost, and the mic opens on the touch only when it isn't (plan, Voice scoring step 1). Live
// words stream while the mic is open and nothing else is read: no pause ends a press. A second tap, or the 30 s limit,
// ends it. Then the final transcript is read by the phone's own grammar, and voice-parse reads only what that grammar
// can't. When streaming didn't connect, or came back blank, the recorded clip goes to voice-parse instead, once (spec
// A4, A5, and the blank retry). Nothing here saves a play: the caller routes what was heard through route(), and the
// engine decides (rule 6). Nothing is sent before a press starts, so the warm mic's audio stays on the phone until
// then.

export type Mic = {
  /**
   * Starts this press's audio. With the warm mic the last second before now comes first, then everything after. Resolves
   * false when the scorer hasn't allowed the microphone.
   */
  start(onChunk: (chunk: Uint8Array, sampleRate: number) => void): Promise<boolean>;
  /** Ends this press's audio. The warm mic keeps listening on the phone; a mic the press opened closes. */
  stop(): void;
};

export type PressUpdate =
  | { kind: 'words'; words: string }
  /** The mic is closed and the press is being read: a second tap, or the 30 s limit, ended it. */
  | { kind: 'ended' }
  | { kind: 'heard'; transcript: string; parsed: ParseResult }
  | { kind: 'failed'; failure: VoiceFailure };

export type VoiceDeps = { mic: Mic; api: VoiceApi; openSocket: OpenSocket; timeouts?: LiveTimeouts };
export type PressInput = { names: string[]; context: ParseContext };
export type PressHandle = { release(): void; cancel(): void };

const nothing = (): PressUpdate => ({ kind: 'heard', transcript: '', parsed: parsePhrase('') });

export function startPress(deps: VoiceDeps, input: PressInput, onUpdate: (update: PressUpdate) => void): PressHandle {
  const timeouts = deps.timeouts ?? liveTimeouts;
  const clip = new Clip();
  let live: Live | null = null;
  let released = false;
  let cancelled = false;
  let wrongRate = false;
  /** Set once a release stops waiting for the socket, so a late session opens nothing. */
  let gaveUp = false;

  const emit = (update: PressUpdate) => { if (!cancelled) onUpdate(update); };
  const stopMic = () => {
    try {
      deps.mic.stop();
    } catch {
      // The stream was never running.
    }
  };

  function connect(session: Session) {
    if (cancelled || gaveUp || session.sampleRate !== SAMPLE_RATE) return;
    let opened: Live;
    try {
      opened = openLive(deps.openSocket(session.url, session.secret), (words) => { if (!released) emit({ kind: 'words', words }); }, timeouts);
    } catch {
      return;
    }
    // The audio from before the socket opened goes first.
    for (const chunk of clip.sent()) opened.append(chunk);
    live = opened;
  }

  const sessionReady = deps.api.session(input.names).then((result) => { if (result.ok) connect(result.value); }, () => {});

  const micReady = deps.mic.start((chunk, sampleRate) => {
    if (released) return;
    if (sampleRate !== SAMPLE_RATE) {
      // voice-parse and the socket take 24 kHz only. A phone that can't deliver it falls back to taps.
      wrongRate = true;
      return;
    }
    const kept = clip.append(chunk);
    if (kept.length) live?.append(kept);
    if (clip.full) void release();
  }).catch(() => false);
  // Without the microphone the scorer hears at once, not after letting go.
  void micReady.then((ready) => {
    if (ready || released || cancelled) return;
    released = true;
    gaveUp = true;
    live?.close();
    emit({ kind: 'failed', failure: 'microphone' });
  });

  async function heard(transcript: string) {
    const local = parsePhrase(transcript);
    if (isEmptyTranscript(transcript) || local.kind !== 'unclear') return emit({ kind: 'heard', transcript, parsed: local });
    const result = await deps.api.parse({ transcript, context: input.context });
    // When voice-parse can't help, route() still says "Didn't understand" and points to the buttons.
    emit({ kind: 'heard', transcript, parsed: result.ok && result.value.parsed ? result.value.parsed : local });
  }

  async function release() {
    if (released || cancelled) return;
    released = true;
    stopMic();
    emit({ kind: 'ended' });
    if (!(await micReady)) return;
    if (wrongRate) return emit({ kind: 'failed', failure: 'voice_unavailable' });
    if (!clip.bytes) return emit(nothing());
    // A short press can end before voice-session answers, so it waits a little for the socket.
    await Promise.race([sessionReady, new Promise((resolve) => setTimeout(resolve, timeouts.openMs))]);
    gaveUp = true;
    const stream = live as Live | null;
    if (cancelled) return;
    const streamed = stream ? await stream.finish() : null;
    stream?.close();
    if (cancelled) return;
    // A blank live transcript gets the same one retry as a stream that failed: the recording goes to voice-parse before
    // the scorer hears "Didn't catch that".
    if (streamed !== null && !isEmptyTranscript(streamed)) return heard(streamed);
    const result = await deps.api.parse({ audio: toBase64(clip.join()), context: input.context });
    if (!result.ok) return emit({ kind: 'failed', failure: result.failure });
    if (!result.value.parsed) return emit(nothing());
    emit({ kind: 'heard', transcript: result.value.transcript, parsed: result.value.parsed });
  }

  return {
    release() { void release(); },
    cancel() {
      if (cancelled) return;
      cancelled = true;
      if (!released) stopMic();
      released = true;
      live?.close();
    },
  };
}
