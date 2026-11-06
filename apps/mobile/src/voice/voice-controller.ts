import type { Command } from '@sandlot/engine';
import { decide, type PressGame, type Reading } from '@sandlot/voice';
import type { VoiceCard } from '../../scorer-ui';
import type { DemoAction, SavedGame } from '../scoring/offline-game.ts';
import { choiceLabels, failureMessage, pressGame, pressInput, unsavedMessage } from './outcome.ts';
import { startPress, type PressHandle, type PressUpdate, type VoiceDeps } from './press.ts';

// The scoring screen's voice state, kept out of React so tests can drive it: the Transcript Card while the mic is open,
// while a press is read or while it waits for a choice, and a line for the banner of a saved play or anything that falls
// back to taps. One tap opens the mic and a second ends it, or 30 s does (ADR 0007). Ended presses queue: each is read on
// its own, but they save in the order they ended. Every save goes through `record`, so the engine checks it (rule 6).

export type VoiceView = {
  /** The mic is open. */
  listening: boolean;
  /** How many ended presses are still being read or waiting their turn to save. */
  reading: number;
  /** A voice play just saved: the bar says so for a moment, then the button comes back. */
  saved: boolean;
  card: VoiceCard | null;
  /** A line about something that didn't save. */
  message: string | null;
  /** What a voice play just saved. */
  banner: string | null;
};

/**
 * How long an ended press may take to be read. The scoring buttons wait for it, so it can't be long: pitches keep coming.
 * It holds the live words' time (liveTimeouts.finalMs) and one voice-parse call (REQUEST_TIMEOUT_MS), with a second over.
 */
export const READ_LIMIT_MS = 15_000;

export type VoiceControllerDeps = {
  /** Null when voice isn't set up on this phone. */
  voice: VoiceDeps | null;
  /** The newest saved game. */
  game(): SavedGame | null;
  /** The newest record(), which reads the newest screen state. */
  record(action: DemoAction): Promise<boolean>;
  now(): number;
  /** How long `saved` stays up after a voice play saves. */
  savedMs?: number;
  readLimitMs?: number;
  onChange(view: VoiceView): void;
};

/** What one press saves against: when it started, and the game it started on. */
type Pressed = { at: number; revision: number; snapshot: PressGame };
/** What a press ended with: its result, or null when the scorer dropped it. */
type Answer = Exclude<PressUpdate, { kind: 'words' } | { kind: 'ended' }> | null;
type Choosing = { card: Extract<VoiceCard, { kind: 'choose' }>; readings: Reading[]; pressed: Pressed };
type Ended = { handle: PressHandle; answer(answer: Answer): void };

export function createVoiceController({ voice, game, record, now, savedMs = 1500, readLimitMs = READ_LIMIT_MS, onChange }: VoiceControllerDeps) {
  /** The press the mic is open for. */
  let open: PressHandle | null = null;
  let words = '';
  let choosing: Choosing | null = null;
  let message: string | null = null;
  let banner: string | null = null;
  /** Presses that ended and haven't saved yet, so a teardown can drop them. */
  const ended = new Set<Ended>();
  /** What the Transcript Card says while those presses are read: the newest one's words. */
  let readingWords = '';
  /** Ended presses settle one after another, in the order they ended. */
  let queue: Promise<void> = Promise.resolve();
  let saved = false;
  let savedTimer: ReturnType<typeof setTimeout> | undefined;
  /** The revision our own latest save left the game at. A press behind it saves on top of it, not as stale. */
  let lastOwnRevision: number | null = null;
  /** Counts each time the scorer moves on (a tap, a teardown), so a late refusal can tell it's stale. */
  let turn = 0;
  /** Counts teardowns, so a press that ended before one never saves after it. */
  let generation = 0;
  /** The last play voice saved, for decide()'s duplicate guard (D4). A tap or an undo clears it. */
  let previous: { commands: Command[]; at: number } | undefined;

  const view = (): VoiceView => ({
    listening: open !== null,
    reading: ended.size,
    saved,
    card: open
      ? { kind: 'listening', words }
      : choosing?.card ?? (ended.size ? { kind: 'reading', words: readingWords } : null),
    message,
    banner,
  });
  const publish = () => onChange(view());

  /** The revision the game reaches once our save shows up, which the screen reports a moment after record() answers. */
  async function revisionAfter(from: number): Promise<number | null> {
    // The screen reports a save a render after record() answers, so this waits a few ticks. If it never does, the next
    // press is treated as stale: it is refused and the scorer is told, never saved on a game it wasn't read against.
    for (let wait = 0; wait < 25; wait += 1) {
      const revision = game()?.revision;
      if (revision !== undefined && revision > from) return revision;
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    return null;
  }

  /**
   * A press saves against the game it was read on. If anything else was saved since, the engine sees a stale revision
   * and nothing is written twice. A press behind another voice press of ours saves on top of that press.
   */
  async function commit(action: DemoAction, pressed: Pressed): Promise<boolean> {
    const mine = turn;
    const done = await record(action);
    if (!done) refused(mine);
    else {
      const revision = await revisionAfter(pressed.revision);
      // A tap that landed while this waited has saved on top of us, so there is nothing of ours to build on.
      lastOwnRevision = mine === turn ? revision : null;
    }
    return done;
  }

  const save = async (reading: Reading, pressed: Pressed) => {
    const { commands } = reading;
    const born = generation;
    const mine = turn;
    const done = await commit({ kind: 'voice', at: new Date(pressed.at).toISOString(), expectedRevision: pressed.revision, commands }, pressed);
    // The play is in the book either way, but a screen that was torn down meanwhile isn't told.
    if (done && born === generation) {
      previous = { commands, at: pressed.at };
      showSaved();
      // The banner says what the engine recorded, until the scorer moves on.
      if (mine === turn) {
        message = null;
        banner = reading.banner;
      }
    }
  };

  function showSaved() {
    saved = true;
    clearTimeout(savedTimer);
    savedTimer = setTimeout(() => {
      saved = false;
      publish();
    }, savedMs);
  }

  /** A save or undo the engine refused, as stale or busy: the scorer hears it, unless they've already moved on. */
  function refused(mine: number) {
    if (mine !== turn) return;
    message = unsavedMessage;
    banner = null;
    publish();
  }

  /**
   * What a press is read and saved against. It's the game it started on, the same game the AI was shown. A press behind
   * another voice press of ours goes on top of that press, unless anything else has saved since.
   */
  function pinned(from: Pressed): Pressed {
    const current = game();
    return lastOwnRevision !== null && current?.revision === lastOwnRevision
      ? { at: from.at, revision: lastOwnRevision, snapshot: pressGame(current) }
      : from;
  }

  async function settle(answer: Answer, from: Pressed) {
    // This press's own result replaces any earlier line.
    message = null;
    banner = null;
    if (!answer) return;
    if (answer.kind === 'failed') {
      message = failureMessage(answer.failure);
      return;
    }
    const base = pinned(from);
    // The AI answered about the game it was shown. On a newer game its bases could mean a different runner, so that press
    // doesn't save and the scorer says it again. Only what the phone read itself moves on top of the press before it.
    if (answer.heard.kind === 'answer' && base.revision !== from.revision) {
      message = unsavedMessage;
      return;
    }
    const decision = decide({ game: base.snapshot, transcript: answer.transcript, at: from.at, previous }, answer.heard);
    if (decision.kind === 'save') await save(decision.reading, base);
    else if (decision.kind === 'undo') {
      previous = undefined;
      // Pinned like a save, so an undo said before another save never takes that save back.
      await commit({ kind: 'undo', expectedRevision: base.revision }, base);
    } else if (decision.kind === 'message') message = decision.message;
    else choosing = {
      card: { kind: 'choose', heading: decision.heading, words: answer.transcript, choices: choiceLabels(decision.readings), note: decision.note },
      readings: decision.readings,
      pressed: base,
    };
  }

  /** The mic is closed: the press joins the line, behind the presses that ended before it. */
  function finish(handle: PressHandle, from: Pressed, answer: Promise<Answer>, resolve: Ended['answer']) {
    open = null;
    readingWords = words;
    const slot: Ended = { handle, answer: resolve };
    ended.add(slot);
    // Past the limit the press is dropped and the scorer told, so no answer that never comes can hold the buttons.
    const limit = setTimeout(() => {
      handle.cancel();
      resolve({ kind: 'failed', failure: 'timeout' });
    }, readLimitMs);
    void answer.then(() => clearTimeout(limit));
    const behind = queue;
    const born = generation;
    queue = (async () => {
      const result = await answer;
      await behind;
      ended.delete(slot);
      // A teardown since this press ended drops it, even if its answer had already arrived.
      if (born !== generation) return;
      try {
        await settle(result, from);
      } catch {
        // One press that can't settle must not hold up the ones behind it, so the scorer hears it and the line moves on.
        message = unsavedMessage;
      }
      // A teardown while this press was saving leaves the screen to whatever comes next.
      if (born === generation) publish();
    })();
    publish();
  }

  function begin() {
    const current = game();
    if (!current) return;
    choosing = null;
    banner = null;
    if (!voice) {
      // The bar still answers the touch, so the scorer learns at once to use the buttons.
      message = failureMessage('voice_unavailable');
      return publish();
    }
    message = null;
    words = '';
    // The press is read against the game it started on, the same game the AI is shown.
    const snapshot = pressGame(current);
    const from: Pressed = { at: now(), revision: current.revision, snapshot };
    let answered: (answer: Answer) => void = () => {};
    const answer = new Promise<Answer>((resolve) => { answered = resolve; });
    let handle: PressHandle | null = null;
    const closeIfOpen = () => { if (handle && open === handle) finish(handle, from, answer, answered); };
    handle = startPress(voice, pressInput(snapshot), (update) => {
      if (update.kind === 'words') {
        if (open === handle) {
          words = update.words;
          publish();
        }
        return;
      }
      // A press that ended by itself (the 30 s limit, a mic that wouldn't open) closes before it answers.
      closeIfOpen();
      if (update.kind !== 'ended') answered(update);
    });
    open = handle;
    publish();
  }

  /** The scorer moved on: the open press, any card and any line go, and a late refusal stays quiet. */
  function dropOpen() {
    turn += 1;
    open?.cancel();
    open = null;
    choosing = null;
    message = null;
    banner = null;
    previous = undefined;
    saved = false;
    clearTimeout(savedTimer);
  }

  /** The mic is open: a second tap ends it. */
  const end = () => open?.release();

  return {
    /** A tap on the bar: opens the mic, or ends the press that is open. Any touch counts, however long. */
    tap() {
      if (open) end();
      else begin();
    },
    choose(index: number) {
      const picked = choosing?.readings[index];
      if (!picked || !choosing) return;
      const { pressed } = choosing;
      choosing = null;
      publish();
      const born = generation;
      void save(picked, pressed).catch(() => { message = unsavedMessage; }).then(() => { if (born === generation) publish(); });
    },
    /**
     * The phone's mic is ready, such as after the scorer allowed it in Settings, so a "can't use the microphone" line
     * is stale. It goes, and nothing else does: not another line, and not a press that is listening or on a card.
     */
    micReady() {
      if (open || ended.size || choosing || message !== failureMessage('microphone')) return;
      message = null;
      publish();
    },
    /** A tap on the scorer buttons drops the press that is open. Presses that already ended still save. */
    dismiss() {
      dropOpen();
      lastOwnRevision = null;
      publish();
    },
    dispose() {
      dropOpen();
      generation += 1;
      for (const slot of ended) {
        slot.handle.cancel();
        slot.answer(null);
      }
      ended.clear();
      publish();
    },
  };
}

export type VoiceController = ReturnType<typeof createVoiceController>;
