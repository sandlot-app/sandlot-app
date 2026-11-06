import { isEmptyTranscript, readLocally, type Heard, type PressContext } from '@sandlot/voice';
import { Clip, SAMPLE_RATE, toBase64 } from './pcm.ts';
import { liveTimeouts, openLive, type Live, type LiveTimeouts, type OpenSocket } from './realtime.ts';
import type { Session, VoiceApi, VoiceFailure } from './voice-api.ts';

// One tap-to-talk press of the voice bar. A press starts with the second before the touch when the mic is warm (ADR
// 0005), so no words are lost, and the mic opens on the touch only when it isn't (plan, Voice scoring step 1). Live
// words stream while the mic is open and nothing else is read: no pause ends a press. A second tap, or the 30 s limit,
// ends it. Then the final transcript is read by the phone only when it's pitch calls or a lone undo; anything else goes
// to voice-parse, where the AI reads the whole press with the game in view (ADR 0007). When streaming didn't connect,
// or came back blank, the recorded clip goes to voice-parse instead, once (spec A4, A5, and the blank retry). Nothing
// here saves a play: the caller passes what was heard to decide(), and the engine decides (rule 6). Nothing is sent
// before a press starts, so the warm mic's audio stays on the phone until then.

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
  | { kind: 'heard'; transcript: string; heard: Heard }
  | { kind: 'failed'; failure: VoiceFailure };

export type VoiceDeps = { mic: Mic; api: VoiceApi; openSocket: OpenSocket; timeouts?: LiveTimeouts };
export type PressInput = { names: string[]; context: PressContext };
export type PressHandle = { release(): void; cancel(): void };

const later = (ms: number) => new Promise<null>((resolve) => setTimeout(() => resolve(null), ms));

const nothing = (): PressUpdate => ({ kind: 'heard', transcript: '', heard: { kind: 'empty' } });

export function startPress(deps: VoiceDeps, input: PressInput, onUpdate: (update: PressUpdate) => void): PressHandle {
  const timeouts = deps.timeouts ?? liveTimeouts;
  const clip = new Clip();
  let live: Live | null = null;
  let released = false;
  let cancelled = false;
  let wrongRate = false;
  /** Set once a release stops waiting for the socket, so a late session opens nothing. */
  let gaveUp = false;
  /** Stops a voice-parse call when the press is dropped. */
  const stopping = new AbortController();

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
    const local = readLocally(transcript);
    if (local) return emit({ kind: 'heard', transcript, heard: local });
    const result = await deps.api.parse({ transcript, context: input.context }, stopping.signal);
    if (!result.ok) return emit({ kind: 'failed', failure: result.failure });
    emit({ kind: 'heard', transcript, heard: result.value.answer ? { kind: 'answer', answer: result.value.answer } : { kind: 'unusable' } });
  }

  async function liveWords(): Promise<string | null> {
    // A short press can end before voice-session answers, so it waits a little for the socket.
    await Promise.race([sessionReady, later(timeouts.openMs)]);
    gaveUp = true;
    const stream = live as Live | null;
    return stream && !cancelled ? stream.finish() : null;
  }

  async function release() {
    if (released || cancelled) return;
    released = true;
    stopMic();
    emit({ kind: 'ended' });
    // A mic that failed after the second tap still answers, so the press never waits forever.
    if (!(await micReady)) return emit({ kind: 'failed', failure: 'microphone' });
    if (wrongRate) return emit({ kind: 'failed', failure: 'voice_unavailable' });
    if (!clip.bytes) return emit(nothing());
    // The live words get finalMs in all, however they spend it, so the recording fallback always has time for its turn.
    const streamed = await Promise.race([liveWords(), later(timeouts.finalMs)]);
    gaveUp = true;
    (live as Live | null)?.close();
    if (cancelled) return;
    // A blank live transcript gets the same one retry as a stream that failed: the recording goes to voice-parse before
    // the scorer hears "Didn't catch that".
    if (streamed !== null && !isEmptyTranscript(streamed)) return heard(streamed);
    const result = await deps.api.parse({ audio: toBase64(clip.join()), context: input.context }, stopping.signal);
    if (!result.ok) return emit({ kind: 'failed', failure: result.failure });
    const { transcript, answer } = result.value;
    emit({ kind: 'heard', transcript, heard: readLocally(transcript) ?? (answer ? { kind: 'answer', answer } : { kind: 'unusable' }) });
  }

  return {
    release() { void release(); },
    cancel() {
      if (cancelled) return;
      cancelled = true;
      stopping.abort();
      if (!released) stopMic();
      released = true;
      live?.close();
    },
  };
}
