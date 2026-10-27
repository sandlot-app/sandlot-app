import type { Command, TeamSide } from '@sandlot/engine';
import type { Decision, PressGame, Reading, RosterEntry } from '@sandlot/voice';
import type { VoiceCard } from '../../scorer-ui';
import { demoSetup } from '../scoring/demo-game.ts';
import { playerDisplay } from '../scoring/demo-roster.ts';
import type { SavedGame } from '../scoring/offline-game.ts';
import type { PressInput } from './press.ts';
import type { VoiceFailure } from './voice-api.ts';

// What the app does with a routed press. route() decides; this only turns its decision into a save or a card.

export type Outcome =
  | { kind: 'save'; commands: Command[] }
  | { kind: 'undo' }
  /** Nothing saves until the scorer taps one of `choices`. */
  | { kind: 'choose'; heading: string; choices: Reading[]; note: string }
  | { kind: 'message'; message: string };

const unsure = 'Tap one, or use the buttons below. Nothing is saved yet.';

export function outcome(decision: Decision): Outcome {
  switch (decision.kind) {
    case 'save': return { kind: 'save', commands: decision.reading.commands };
    case 'undo': return { kind: 'undo' };
    case 'ask': return { kind: 'choose', heading: 'Not sure — which one?', choices: decision.options, note: `${decision.prompt} ${unsure}` };
    case 'confirm': return { kind: 'choose', heading: 'Check this play', choices: [decision.reading], note: unsure };
    case 'reject': return decision.savePart
      ? { kind: 'choose', heading: 'Save part of it?', choices: [decision.savePart], note: decision.message }
      : { kind: 'message', message: decision.message };
    case 'didnt_catch': return { kind: 'message', message: "Didn't catch that. Hold and try again, or tap to score." };
    case 'no_play': return { kind: 'message', message: "That wasn't a play, so nothing was saved." };
    case 'unknown_phrase': return { kind: 'message', message: decision.message };
  }
}

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

/** "Strike swinging → count 1–2" names the button "Strike swinging"; the card already shows the count. */
export const choiceLabel = (reading: Reading) => reading.readBack.split(' → ')[0]!;

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
