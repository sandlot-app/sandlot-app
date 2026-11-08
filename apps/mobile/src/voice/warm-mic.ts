import type { MicStatus } from './mic-status.ts';
import { SAMPLE_RATE } from './pcm.ts';
import type { Mic } from './press.ts';

// The warm mic (ADR 0005). While the scoring screen is open and in the foreground, the phone's mic runs and this keeps
// only the last second of what it hears, in memory. A press starts with that second, so the first word is never lost.
// Nothing here talks to the network, saves audio or logs it: the audio leaves the phone only through a press, after the
// press starts (rule 5).

export type Permission = 'granted' | 'undetermined' | 'denied';
/** `refused` is the scorer saying no. `failed` is anything else, such as another app holding the mic. */
export type OpenResult = 'started' | 'refused' | 'failed';
type OnChunk = (chunk: Uint8Array, sampleRate: number) => void;

/** The phone's raw mic stream, which voice-service.ts wraps around expo-audio. */
export type AudioSource = {
  /** What the scorer has answered so far, without asking. */
  permission(): Promise<Permission>;
  /** Asks the scorer if they haven't answered yet, then starts the stream. */
  open(onChunk: OnChunk): Promise<OpenResult>;
  close(): void;
};

export type WarmMicDeps = {
  source: AudioSource;
  now(): number;
  /** Resolves after `ms`. */
  wait(ms: number): Promise<void>;
  onStatus?(status: MicStatus): void;
};

/** How much audio before the touch a press starts with. */
const preRollMs = 1000;
/** How long the first-open line stays up before iOS asks. */
const explainMs = 4000;
/** A stream that has gone this long without audio is treated as interrupted, and the next press opens it again. */
const staleMs = 1500;

type Heard = { bytes: Uint8Array; rate: number; at: number };

export function createWarmMic({ source, now, wait, onStatus }: WarmMicDeps) {
  const maxBytes = Math.round(SAMPLE_RATE * 2 * preRollMs / 1000);
  /** The scoring screen is open and in the foreground, so the mic stays on between presses. */
  let wanted = false;
  let running = false;
  let ring: Heard[] = [];
  let ringBytes = 0;
  let lastHeard = 0;
  /** The open press, once it has the second before the touch. */
  let press: OnChunk | null = null;
  /** A press that is starting: what the mic hears meanwhile waits here, so it goes after that second, in order. */
  let starting: Heard[] | null = null;
  let opening: Promise<OpenResult> | null = null;
  let status: MicStatus = 'off';
  /** Counts each time the screen turns the warm mic on or off, so an attempt that was overtaken stops. */
  let screenTurn = 0;
  /** Counts each time a press starts or ends, so a start that was overtaken knows. */
  let pressTurn = 0;
  /** Counts each time the stream closes, so audio from a stream that was closed is ignored. */
  let generation = 0;

  function setStatus(next: MicStatus) {
    if (next === status) return;
    status = next;
    onStatus?.(next);
  }

  function hear(bytes: Uint8Array, rate: number) {
    lastHeard = now();
    if (starting) return void starting.push({ bytes, rate, at: lastHeard });
    if (press) return press(bytes, rate);
    ring.push({ bytes, rate, at: lastHeard });
    ringBytes += bytes.length;
    // Only the last second stays: older audio is thrown away.
    while (ring.length > 1 && ringBytes - ring[0]!.bytes.length >= maxBytes) ringBytes -= ring.shift()!.bytes.length;
  }

  function forget() {
    ring = [];
    ringBytes = 0;
  }

  /** Stops the stream and throws away what it heard. */
  function closeStream() {
    generation += 1;
    running = false;
    forget();
    source.close();
  }

  /** The stream stays on only for the screen or for a press that is using it. */
  function settle() {
    if (running && !wanted && !press && !starting) closeStream();
  }

  function ensureOpen(): Promise<OpenResult> {
    if (running) return Promise.resolve('started');
    const mine = generation;
    opening ??= source.open((bytes, rate) => { if (mine === generation) hear(bytes, rate); })
      .catch((): OpenResult => 'failed')
      .then((result) => {
        opening = null;
        running = result === 'started';
        lastHeard = now();
        settle();
        return result;
      });
    return opening;
  }

  const mic: Mic = {
    async start(onChunk) {
      const mine = ++pressTurn;
      // A press takes over from any warm-mic attempt still waiting, such as the first-open line's timer, so the mic
      // is asked for once.
      screenTurn += 1;
      // From here on what the mic hears belongs to this press, behind the second before the touch.
      starting = [];
      if (running && now() - lastHeard > staleMs) closeStream();
      if (!running) {
        // No warm mic, so this press starts the mic on touch-down: Android, a refused or busy mic, or a stream that
        // was interrupted.
        const result = await ensureOpen();
        if (result !== 'started') {
          if (mine === pressTurn) starting = null;
          setStatus(result === 'refused' ? 'refused' : 'busy');
          return false;
        }
        setStatus(wanted ? 'ready' : 'off');
        if (mine !== pressTurn) return true;
      }
      const fresh = ring.filter((heard) => now() - heard.at <= preRollMs);
      forget();
      // After a microtask, so the press has its handle before the first audio arrives.
      await Promise.resolve();
      if (mine !== pressTurn) return true;
      press = onChunk;
      const live = starting ?? [];
      starting = null;
      for (const heard of [...fresh, ...live]) onChunk(heard.bytes, heard.rate);
      return true;
    },
    stop() {
      pressTurn += 1;
      press = null;
      starting = null;
      forget();
      settle();
    },
  };

  return {
    mic,
    /** The scoring screen is open and in the foreground (true), or it was left, locked or switched away from (false). */
    warm(on: boolean) {
      wanted = on;
      const mine = ++screenTurn;
      if (!on) {
        if (running) closeStream();
        setStatus('off');
        return;
      }
      void (async () => {
        const permission = await source.permission().catch((): Permission => 'undetermined');
        if (mine !== screenTurn) return;
        if (permission === 'denied') return setStatus('refused');
        if (permission === 'undetermined') {
          // The first time on this screen: the line is up while iOS hasn't asked, so the scorer reads why before it does.
          setStatus('explain');
          await wait(explainMs);
          if (mine !== screenTurn) return;
        }
        const result = await ensureOpen();
        if (mine === screenTurn) setStatus(result === 'started' ? 'ready' : result === 'refused' ? 'refused' : 'busy');
      })();
    },
  };
}

export type WarmMic = ReturnType<typeof createWarmMic>;
