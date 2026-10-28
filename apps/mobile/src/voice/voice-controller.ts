import type { Command } from '@sandlot/engine';
import { route, type ParseResult, type Reading } from '@sandlot/voice';
import type { VoiceCard } from '../../scorer-ui';
import type { DemoAction, SavedGame } from '../scoring/offline-game.ts';
import { choiceLabels, failureMessage, liveCard, lostMessage, outcome, pressGame, pressInput, unsavedMessage } from './outcome.ts';
import { startPress, type PressHandle, type VoiceDeps } from './press.ts';

// The scoring screen's voice state, kept out of React so tests can drive it: the Transcript Card while a press is
// held or waiting for a choice, and a line for anything that falls back to taps. Every save goes through `record`,
// so the engine checks it (rule 6).

export type VoiceView = { listening: boolean; card: VoiceCard | null; message: string | null };

export type VoiceControllerDeps = {
  /** Null when voice isn't set up on this phone. */
  voice: VoiceDeps | null;
  /** The newest saved game. */
  game(): SavedGame | null;
  /** The newest record(), which reads the newest screen state. */
  record(action: DemoAction): Promise<boolean>;
  now(): number;
  onChange(view: VoiceView): void;
};

type Choosing = { card: Extract<VoiceCard, { kind: 'choose' }>; readings: Reading[] };
/** What one press saves against: when it started, and the game it started on. */
type Pressed = { at: number; revision: number };

export function createVoiceController({ voice, game, record, now, onChange }: VoiceControllerDeps) {
  let listening = false;
  let live: VoiceCard | null = null;
  let choosing: Choosing | null = null;
  let message: string | null = null;
  let press: PressHandle | null = null;
  /** True once the finger is up and the press is still being read. */
  let reading = false;
  /** Counts each time the scorer moves on (a new press, a tap, a teardown), so a late refusal can tell it's stale. */
  let turn = 0;
  let pressed: Pressed | null = null;
  /** The last play voice saved, for route()'s duplicate guard (D4). A tap or an undo clears it. */
  let previous: { commands: Command[]; at: number } | undefined;

  const publish = () => onChange({ listening, card: live ?? choosing?.card ?? null, message });

  /**
   * A press saves against the game it started on. If anything was saved since, the engine sees a stale revision and
   * nothing is written twice.
   */
  async function save(commands: Command[], from: Pressed) {
    const mine = turn;
    const saved = await record({ kind: 'voice', at: new Date(from.at).toISOString(), expectedRevision: from.revision, commands });
    if (saved) previous = { commands, at: from.at };
    else refused(mine);
  }

  /** A save or undo the engine refused, as stale or busy: the scorer hears it, unless they've already moved on. */
  function refused(mine: number) {
    if (mine !== turn) return;
    message = unsavedMessage;
    publish();
  }

  function stop() {
    turn += 1;
    press?.cancel();
    press = null;
    reading = false;
    listening = false;
    live = null;
  }

  function start() {
    const current = game();
    if (!current) return;
    // A press still being read is cancelled by this one, so the scorer knows that play needs saying again.
    const dropped = reading;
    stop();
    choosing = null;
    if (!voice) {
      // The bar still answers the touch, so the scorer learns at once to use the buttons.
      message = failureMessage('voice_unavailable');
      return publish();
    }
    message = dropped ? lostMessage : null;
    listening = true;
    live = { kind: 'listening', words: '' };
    const from: Pressed = { at: now(), revision: current.revision };
    pressed = from;
    const routed = (transcript: string, parsed?: ParseResult) =>
      route({ ...pressGame(game() ?? current), transcript, at: from.at, previous }, parsed);
    const handle = startPress(voice, pressInput(current), (update) => {
      if (press !== handle) return;
      if (update.kind === 'words') {
        live = liveCard(routed(update.words), update.words);
        return publish();
      }
      press = null;
      reading = false;
      listening = false;
      live = null;
      // This press's own result replaces any earlier line, such as the one saying the last press was lost.
      message = null;
      if (update.kind === 'failed') {
        message = failureMessage(update.failure);
        return publish();
      }
      const result = outcome(routed(update.transcript, update.parsed));
      if (result.kind === 'save') void save(result.commands, from);
      else if (result.kind === 'undo') {
        previous = undefined;
        // Pinned like a save, so an undo said before another save never takes that save back.
        const mine = turn;
        void record({ kind: 'undo', expectedRevision: from.revision }).then((undone) => { if (!undone) refused(mine); });
      } else if (result.kind === 'message') message = result.message;
      else choosing = {
        card: { kind: 'choose', heading: result.heading, words: update.transcript, choices: choiceLabels(result.choices), note: result.note },
        readings: result.choices,
      };
      publish();
    });
    press = handle;
    publish();
  }

  return {
    start,
    /** The finger came up on the bar: the press finishes and its result arrives later. */
    release() {
      if (press) {
        reading = true;
        press.release();
      } else {
        listening = false;
        live = null;
      }
      publish();
    },
    /** The finger slid off the bar. */
    cancel() {
      stop();
      publish();
    },
    choose(index: number) {
      const picked = choosing?.readings[index];
      if (!picked || !pressed) return;
      choosing = null;
      publish();
      void save(picked.commands, pressed);
    },
    /**
     * The phone's mic is ready, such as after the scorer allowed it in Settings, so a "can't use the microphone" line
     * is stale. It goes, and nothing else does: not another line, and not a press that is listening or on a card.
     */
    micReady() {
      if (listening || live || choosing || message !== failureMessage('microphone')) return;
      message = null;
      publish();
    },
    /** A tap on the scorer buttons takes over from voice, including a press that's still being read. */
    dismiss() {
      stop();
      choosing = null;
      message = null;
      previous = undefined;
      publish();
    },
    dispose() {
      stop();
      choosing = null;
      message = null;
      publish();
    },
  };
}

export type VoiceController = ReturnType<typeof createVoiceController>;
