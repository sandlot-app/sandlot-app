import type { TeamSide } from '@sandlot/engine';
import { pressContext, type PressGame, type Reading, type RosterEntry } from '@sandlot/voice';
import { playerDisplay } from '../scoring/demo-roster.ts';
import type { SavedGame } from '../scoring/offline-game.ts';
import type { PressInput } from './press.ts';
import type { VoiceFailure } from './voice-api.ts';

// The voice words the controller shows that decide() doesn't own, and the game a press is read against.

export const lostMessage = "The last voice play didn't save. Say it again or tap to score.";
export const unsavedMessage = "That voice play didn't save. Say it again or tap to score.";

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
 * "Strike swinging → count 1–2" names its button "Strike swinging", because the full banner doesn't fit half the
 * card. Only the count goes: every clause stays, and when two buttons would read the same, they show it all.
 */
export function choiceLabels(readings: Reading[]): string[] {
  const short = readings.map((reading) => reading.banner.replace(/ → count [^·]*?(?= ·|$)/g, ''));
  return new Set(short).size === short.length ? short : readings.map((reading) => reading.banner);
}

/** Who's who in the game, by display name and jersey number. Names stay here and in the request; events carry IDs only (rule 5). */
export function roster(game: SavedGame): RosterEntry[] {
  return (['away', 'home'] as const satisfies TeamSide[]).flatMap((side) => game.state.lineups[side].map(({ player }) => ({
    player, side, ...playerDisplay(game.state, side, player),
  })));
}

export function pressGame(game: SavedGame): PressGame {
  return { setup: game.setup, events: game.events, roster: roster(game) };
}

/** What a press sends: the display names for the transcriber's keywords, and the game as the AI sees it, built from the same game decide() reads. */
export function pressInput(game: PressGame): PressInput {
  return { names: game.roster.map((entry) => entry.name), context: pressContext(game) };
}
