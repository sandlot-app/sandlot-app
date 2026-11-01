import type { Command } from '@sandlot/engine';
import { route, type Reading } from '@sandlot/voice';
import type { VoiceCard } from '../../scorer-ui';
import type { DemoAction, SavedGame } from '../scoring/offline-game.ts';
import { choiceLabels, failureMessage, outcome, pressGame, pressInput, unsavedMessage } from './outcome.ts';
import { startPress, type PressHandle, type PressUpdate, type VoiceDeps } from './press.ts';

// The scoring screen's voice state, kept out of React so tests can drive it: the Transcript Card while the mic is open,
// while a press is read or while it waits for a choice, and a line for anything that falls back to taps. One tap opens
// the mic and a second ends it, or 30 s does (ADR 0007). Ended presses queue: each is read on its own, but they save in
// the order they ended. Every save goes through `record`, so the engine checks it (rule 6).

export type VoiceView = {
  /** The mic is open. */
  listening: boolean;
  /** How many ended presses are still being read or waiting their turn to save. */
  reading: number;
  /** A voice play just saved: the bar says so for a moment, then the button comes back. */
  saved: boolean;
  card: VoiceCard | null;
  message: string | null;
};

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
  onChange(view: VoiceView): void;
};

/** What one press saves against: when it started, and the game it started on. */
type Pressed = { at: number; revision: number };
/** What a press ended with: its result, or null when the scorer dropped it. */
type Answer = Exclude<PressUpdate, { kind: 'words' } | { kind: 'ended' }> | null;
type Choosing = { card: Extract<VoiceCard, { kind: 'choose' }>; readings: Reading[]; pressed: Pressed };
type Ended = { handle: PressHandle; answer(answer: Answer): void };

export function createVoiceController({ voice, game, record, now, savedMs = 1500, onChange }: VoiceControllerDeps) {
  /** The press the mic is open for. */
  let open: PressHandle | null = null;
  let words = '';
  let choosing: Choosing | null = null;
  let message: string | null = null;
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
  /** The last play voice saved, for route()'s duplicate guard (D4). A tap or an undo clears it. */
  let previous: { commands: Command[]; at: number } | undefined;

  const view = (): VoiceView => ({
    listening: open !== null,
    reading: ended.size,
    saved,
    card: open
      ? { kind: 'listening', words }
      : choosing?.card ?? (ended.size ? { kind: 'reading', words: readingWords } : null),
    message,
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

  const save = async (commands: Command[], pressed: Pressed) => {
    const born = generation;
    const done = await commit({ kind: 'voice', at: new Date(pressed.at).toISOString(), expectedRevision: pressed.revision, commands }, pressed);
    // The play is in the book either way, but a screen that was torn down meanwhile isn't told.
    if (done && born === generation) {
      previous = { commands, at: pressed.at };
      showSaved();
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
    publish();
  }

  /** Where a press saves from: on top of our own latest save when nothing else has saved since, else where it started. */
  function pinned(from: Pressed): Pressed {
    const current = game();
    return { at: from.at, revision: lastOwnRevision !== null && current?.revision === lastOwnRevision ? lastOwnRevision : from.revision };
  }

  async function settle(answer: Answer, from: Pressed) {
    // This press's own result replaces any earlier line.
    message = null;
    if (!answer) return;
    if (answer.kind === 'failed') {
      message = failureMessage(answer.failure);
      return;
    }
    const current = game();
    if (!current) return;
    const base = pinned(from);
    const result = outcome(route({ ...pressGame(current), transcript: answer.transcript, at: from.at, previous }, answer.parsed));
    if (result.kind === 'save') await save(result.commands, base);
    else if (result.kind === 'undo') {
      previous = undefined;
      // Pinned like a save, so an undo said before another save never takes that save back.
      await commit({ kind: 'undo', expectedRevision: base.revision }, base);
    } else if (result.kind === 'message') message = result.message;
    else choosing = {
      card: { kind: 'choose', heading: result.heading, words: answer.transcript, choices: choiceLabels(result.choices), note: result.note },
      readings: result.choices,
      pressed: base,
    };
  }

  /** The mic is closed: the press joins the line, behind the presses that ended before it. */
  function finish(handle: PressHandle, from: Pressed, answer: Promise<Answer>, resolve: Ended['answer']) {
    open = null;
    readingWords = words;
    const slot: Ended = { handle, answer: resolve };
    ended.add(slot);
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
    if (!voice) {
      // The bar still answers the touch, so the scorer learns at once to use the buttons.
      message = failureMessage('voice_unavailable');
      return publish();
    }
    message = null;
    words = '';
    const from: Pressed = { at: now(), revision: current.revision };
    let answered: (answer: Answer) => void = () => {};
    const answer = new Promise<Answer>((resolve) => { answered = resolve; });
    let handle: PressHandle | null = null;
    const closeIfOpen = () => { if (handle && open === handle) finish(handle, from, answer, answered); };
    handle = startPress(voice, pressInput(current), (update) => {
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
      void save(picked.commands, pressed).then(() => { if (born === generation) publish(); });
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
