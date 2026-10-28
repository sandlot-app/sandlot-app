import { applyGroup } from '@sandlot/engine';
import type { Command, GroupId, RejectCode } from '@sandlot/engine';
import { rejectMessage, route, type Decision, type ParseResult, type Reading } from '@sandlot/voice';
import type { VoiceCard } from '../../scorer-ui';
import { demoSetup } from '../scoring/demo-game.ts';
import type { DemoAction, SavedGame } from '../scoring/offline-game.ts';
import {
  choiceLabels, failureMessage, fixNotReadyMessage, liveCard, lostMessage, outcome, pressGame, pressInput, unfixedMessage, unsavedMessage, type Card,
} from './outcome.ts';
import { startPress, type PressHandle, type VoiceDeps } from './press.ts';

// The scoring screen's voice state, kept out of React so tests can drive it: the Transcript Card while a press is
// held or waiting for a choice, and a line for anything that falls back to taps. Every save goes through `record`,
// so the engine checks it (rule 6). A card never blocks: the next press or tap drops it, and a line says what it held
// (ADR 0006).

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

/** What one press saves against: when it started, and the game it started on. */
type Pressed = { at: number; revision: number };
/**
 * `from` is the game an answer saves against: after a partial save, the game once the clear calls saved, or null if they
 * didn't. `fixes` is the Play a Fix card's answer replaces.
 */
type Choosing = { card: Extract<VoiceCard, { kind: 'choose' }>; readings: Reading[]; from: Promise<Pressed | null>; dropped: string; fixes: GroupId | null };

/**
 * Asks the engine whether it can correct the last Play with any of a fix's choices, before the scorer sees a preview
 * (rule 6). Returns the line to show instead, or null when the fix can be offered.
 */
function fixRefused(game: SavedGame, decision: Extract<Decision, { kind: 'fix' }>): string | null {
  let code: RejectCode | null = null;
  for (const option of decision.options) {
    const result = applyGroup(demoSetup, game.events, [{ kind: 'correct', target: decision.target, replacement: option.commands }]);
    if (result.ok) return null;
    code = result.code;
  }
  return code === 'not_implemented' ? fixNotReadyMessage : code ? rejectMessage(code) : null;
}

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
  /** The last play voice saved, for route()'s duplicate guard (D4). A tap or an undo clears it. */
  let previous: { commands: Command[]; at: number } | undefined;

  const publish = () => onChange({ listening, card: live ?? choosing?.card ?? null, message });

  /**
   * A press saves against the game it started on. If anything was saved since, the engine sees a stale revision and
   * nothing is written twice.
   */
  async function save(commands: Command[], from: Pressed): Promise<Pressed | null> {
    const mine = turn;
    const saved = await record({ kind: 'voice', at: new Date(from.at).toISOString(), expectedRevision: from.revision, commands });
    if (!saved) {
      refused(mine);
      return null;
    }
    previous = { commands, at: from.at };
    // The game's revision counts its events, so the next answer saves against the game with these commands in it.
    return { at: from.at, revision: from.revision + commands.length };
  }

  /** A Fix replaces the last Play, and is pinned like a save so it never replaces a play saved after its press began. */
  async function fix(target: GroupId, commands: Command[], from: Pressed) {
    const mine = turn;
    const fixed = await record({ kind: 'fix', at: new Date(from.at).toISOString(), expectedRevision: from.revision, target, commands });
    previous = undefined;
    if (!fixed) refused(mine, unfixedMessage);
  }

  /** A save or undo the engine refused, as stale or busy: the scorer hears it, unless they've already moved on. */
  function refused(mine: number, line = unsavedMessage) {
    if (mine !== turn) return;
    message = line;
    publish();
  }

  const choosingFor = (card: Card, from: Promise<Pressed | null>, fixes: GroupId | null = null): Choosing => ({
    card: { kind: 'choose', heading: card.heading, words: card.words, choices: choiceLabels(card.choices), note: card.note },
    readings: card.choices, from, dropped: card.dropped, fixes,
  });

  /** Drops the card on screen, if any, and returns the line saying what it held. */
  function drop(): string | null {
    const dropped = choosing?.dropped ?? null;
    choosing = null;
    return dropped;
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
    const unanswered = drop();
    if (!voice) {
      // The bar still answers the touch, so the scorer learns at once to use the buttons.
      message = failureMessage('voice_unavailable');
      return publish();
    }
    message = dropped ? lostMessage : unanswered;
    listening = true;
    live = { kind: 'listening', words: '' };
    const from: Pressed = { at: now(), revision: current.revision };
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
      // This press's own result replaces any earlier line, such as the one saying the last press was lost. The line for
      // a card this press dropped stays until the scorer moves on again, so a lost call gets noticed.
      message = unanswered;
      const say = (line: string) => { message = unanswered ? `${unanswered}. ${line}` : line; };
      if (update.kind === 'failed') {
        say(failureMessage(update.failure));
        return publish();
      }
      const calls = update.parsed.kind === 'plays' ? update.parsed.parts : [update.transcript];
      const decision = routed(update.transcript, update.parsed);
      const refusal = decision.kind === 'fix' ? fixRefused(game() ?? current, decision) : null;
      const result = refusal ? { kind: 'message' as const, message: refusal } : outcome(decision, { transcript: update.transcript, calls });
      if (result.kind === 'save') void save(result.commands, from);
      else if (result.kind === 'undo') {
        previous = undefined;
        // Pinned like a save, so an undo said before another save never takes that save back.
        const mine = turn;
        void record({ kind: 'undo', expectedRevision: from.revision }).then((undone) => { if (!undone) refused(mine); });
      } else if (result.kind === 'message') say(result.message);
      else if (result.kind === 'choose') choosing = choosingFor(result, Promise.resolve(from), decision.kind === 'fix' ? decision.target : null);
      else {
        // ADR 0006: the clear calls save now as the press's Play. Their card, if any, answers on the game after them.
        const saved = save(result.commands, from);
        if (result.rest.kind === 'message') say(result.rest.message);
        else {
          const card = choosingFor(result.rest, saved);
          choosing = card;
          void saved.then((next) => {
            if (next || choosing !== card) return;
            choosing = null;
            publish();
          });
        }
      }
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
    /** Answering a card is a tap, so it records a Play of its own (ADR 0006). */
    choose(index: number) {
      const current = choosing;
      const picked = current?.readings[index];
      if (!current || !picked) return;
      choosing = null;
      publish();
      void current.from.then((from) => {
        if (!from) return;
        if (current.fixes) void fix(current.fixes, picked.commands, from);
        else void save(picked.commands, from);
      });
    },
    /** A tap on the scorer buttons takes over from voice, including a press that's still being read or a card. */
    dismiss() {
      stop();
      message = drop();
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
