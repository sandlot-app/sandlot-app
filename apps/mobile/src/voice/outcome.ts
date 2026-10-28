import type { Command, TeamSide } from '@sandlot/engine';
import type { Decision, PressGame, Reading, RosterEntry } from '@sandlot/voice';
import type { VoiceCard } from '../../scorer-ui';
import { demoSetup } from '../scoring/demo-game.ts';
import { playerDisplay } from '../scoring/demo-roster.ts';
import { playLabel } from '../scoring/play-label.ts';
import type { SavedGame } from '../scoring/offline-game.ts';
import type { PressInput } from './press.ts';
import type { VoiceFailure } from './voice-api.ts';

// What the app does with a routed press. route() decides; this only turns its decision into a save or a card.

/** A Not sure card: nothing on it saves until the scorer taps one of `choices`. */
export type Card = {
  kind: 'choose'; heading: string; words: string; choices: Reading[]; note: string;
  /** The line left when the next press or tap drops the card, so a lost call gets noticed. */
  dropped: string;
  /** The choices replace the last Play rather than adding one. */
  fix?: true;
};

export type Outcome =
  | { kind: 'save'; commands: Command[] }
  | { kind: 'undo' }
  | Card
  | { kind: 'message'; message: string }
  /** ADR 0006: `commands` save at once as the press's Play, and `rest` is the card or line for the calls after them. */
  | { kind: 'partial'; commands: Command[]; rest: Card | { kind: 'message'; message: string } };

const unsure = 'Tap one, or use the buttons below. Nothing is saved yet.';
const capital = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
const notSaved = (calls: string[]) => `${calls.length} ${calls.length === 1 ? 'call' : 'calls'} not saved: ${capital(calls.join(', '))}`;

/** "Change single to double?", or a plainer heading when the two plays have the same name. */
function fixHeading(was: Reading, now: Reading[]): string {
  const before = playLabel(was.commands);
  const after = now.length === 1 ? playLabel(now[0]!.commands) : before;
  return before === after ? 'Fix the last play?' : `Change ${before.toLowerCase()} to ${after.toLowerCase()}?`;
}

/** `heard` is the press as said: its whole transcript, and the words of each call in it. */
export function outcome(decision: Decision, heard: { transcript: string; calls: string[] }): Outcome {
  const words = heard.transcript;
  switch (decision.kind) {
    case 'save': return { kind: 'save', commands: decision.reading.commands };
    case 'undo': return { kind: 'undo' };
    case 'ask': return { kind: 'choose', heading: 'Not sure — which one?', words, choices: decision.options, note: `${decision.prompt} ${unsure}`, dropped: notSaved(heard.calls) };
    case 'confirm': return { kind: 'choose', heading: 'Check this play', words, choices: [decision.reading], note: unsure, dropped: notSaved(heard.calls) };
    case 'reject': return decision.savePart
      ? { kind: 'choose', heading: 'Save part of it?', words, choices: [decision.savePart], note: decision.message, dropped: notSaved(heard.calls) }
      : { kind: 'message', message: decision.message };
    case 'partial': {
      const { rest, calls } = decision;
      const saved = `${choiceLabels([decision.reading])[0]} saved`;
      const card = (heading: string, choices: Reading[], note: string): Card => ({ kind: 'choose', heading, words: calls.join(', '), choices, note, dropped: notSaved(calls) });
      const kept = `${saved}, and Undo takes back just that.`;
      return {
        kind: 'partial',
        commands: decision.reading.commands,
        rest: rest.kind === 'ask' ? card('Not sure — which one?', rest.options, `${rest.prompt} ${kept} Tap one, or use the buttons below.`)
          : rest.kind === 'confirm' ? card('Check this play', [rest.reading], `${kept} Tap to save the rest, or use the buttons below.`)
          : rest.savePart ? card('Save part of it?', [rest.savePart], `${saved}. ${rest.message}`)
          : { kind: 'message', message: `${saved}. ${rest.message}` },
      };
    }
    case 'fix': return {
      kind: 'choose', heading: fixHeading(decision.was, decision.options), words, choices: decision.options, fix: true,
      note: `${decision.prompt ? `${decision.prompt} ` : ''}Was: ${choiceLabels([decision.was])[0]}. Tap to fix it, or use the buttons below. Nothing is changed yet.`,
      dropped: `Fix not saved: ${decision.calls.join(', ')}`,
    };
    case 'didnt_catch': return { kind: 'message', message: "Didn't catch that. Hold and try again, or tap to score." };
    case 'no_play': return { kind: 'message', message: "That wasn't a play, so nothing was saved." };
    case 'unknown_phrase': return { kind: 'message', message: decision.message };
  }
}

export const lostMessage = "The last voice play didn't save. Say it again or tap to score.";
export const unsavedMessage = "That voice play didn't save. Say it again or tap to score.";
export const unfixedMessage = "That fix didn't save. Undo the play and say it again, or tap to score.";

export function failureMessage(failure: VoiceFailure): string {
  switch (failure) {
    case 'microphone': return 'Sandlot can’t use the microphone. Allow it in Settings, or tap to score.';
    case 'slow_down': return 'Too many voice plays at once. Tap to score for now.';
    case 'too_long': return 'That was too long to read. Tap to score.';
    case 'unauthenticated':
    case 'auth_unavailable': return 'Sign-in is busy right now. Tap to score for now.';
    default: return 'Voice is unavailable right now. Tap to score.';
  }
}

/**
 * "Strike swinging → count 1–2" names its button "Strike swinging", because the full read-back doesn't fit half the
 * card. Only the count goes: every clause stays, and when two buttons would read the same, they show it all.
 */
export function choiceLabels(readings: Reading[]): string[] {
  const short = readings.map((reading) => reading.readBack.replace(/ → count [^·]*?(?= ·|$)/g, ''));
  return new Set(short).size === short.length ? short : readings.map((reading) => reading.readBack);
}

/** The result dot: a ball's green, everything else the strike yellow, as the Pitch Row marks them. */
export function tone(commands: Command[]): 'ball' | 'strike' {
  const first = commands[0];
  return first?.kind === 'pitch' && (first.result === 'ball' || first.result === 'hit_by_pitch') ? 'ball' : 'strike';
}

/** While held, the card says "Got it" once the words so far would save on release. */
export function liveCard(decision: Decision, words: string): VoiceCard {
  return decision.kind === 'save'
    ? { kind: 'got_it', words, result: decision.reading.readBack, tone: tone(decision.reading.commands) }
    : { kind: 'listening', words };
}

/** The lineup the parser names players from. Names stay here and in the request; events carry IDs only (rule 5). */
export function roster(game: SavedGame): RosterEntry[] {
  return (['away', 'home'] as const satisfies TeamSide[]).flatMap((side) => game.state.lineups[side].map(({ player }) => ({
    player, side, ...playerDisplay(game.state, side, player),
  })));
}

export function pressGame(game: SavedGame): PressGame {
  return { setup: demoSetup, events: game.events, roster: roster(game) };
}

export function pressInput(game: SavedGame): PressInput {
  const entries = roster(game);
  const batting: TeamSide = game.state.half === 'top' ? 'away' : 'home';
  const named = (side: TeamSide) => entries.filter((entry) => entry.side === side).map((entry) => entry.name);
  const runners = ([1, 2, 3] as const).flatMap((base) => {
    const runner = game.state.bases[base]?.player;
    return runner ? [playerDisplay(game.state, batting, runner).name] : [];
  });
  return {
    names: entries.map((entry) => entry.name),
    context: { batting: named(batting), fielding: named(batting === 'away' ? 'home' : 'away'), runners },
  };
}
