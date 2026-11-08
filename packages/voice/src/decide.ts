import { applyGroup, replay } from '@sandlot/engine';
import type { Base, Command, Position, RejectCode } from '@sandlot/engine';
import type { Answer, AnswerReading } from './answer.ts';
import { toCommands } from './commands.ts';
import { readBack } from './explain.ts';
import { normalize, type Local } from './local.ts';
import { checkNames, type NameRefusal } from './names.ts';
import { standingPlays } from './context.ts';
import { entryFor, fits, samePlayer, words } from './players.ts';
import { batterUp, passesRunner, stateAfter, type PressGame } from './state.ts';

// Everything after a press ends, in one pure function: what was heard (the phone's own reading or the AI's answer)
// goes in with the game the press started on, and what the screen does comes out. The engine decides what's legal
// (rule 6), and every banner is built from the commands it accepted, never from the model's words.

/** What one press heard: the phone's own reading, the AI's answer, or an AI reply with no answer to use. */
export type Heard = Local | { kind: 'answer'; answer: Answer } | { kind: 'unusable' };

export type Press = {
  /** The game the press started on. The context sent to the AI came from this same game, so its bases mean these runners. */
  game: PressGame;
  transcript: string;
  /** When the press started, in milliseconds. */
  at: number;
  /** The play voice saved just before, for the duplicate guard (D4). */
  previous?: { commands: Command[]; at: number };
  /** The scorer's "confirm everything" setting. */
  confirmEverything?: boolean;
};

/** One way to record the press that the engine accepted, and the banner that says what it records. */
export type Reading = { commands: Command[]; banner: string };

export type Decision =
  /** Save at once, and show the banner with Undo. */
  | { kind: 'save'; reading: Reading }
  /** A card. Nothing saves until the scorer taps one of `readings`. */
  | { kind: 'choose'; heading: string; note: string; readings: Reading[] }
  | { kind: 'undo' }
  /** One line under the bar. Nothing saves. */
  | { kind: 'message'; message: string };

export const messages = {
  empty: "Didn't catch that. Hold and try again, or tap to score.",
  unusable: "Couldn't read that. Tap to score.",
  notAPlay: "That wasn't a play, so nothing was saved.",
  unclear: (transcript: string) => `Didn't understand "${transcript.trim()}". Tap to score.`,
  /** A voice Fix needs the engine's `correct` (#97). Until then a Fix never saves, and never saves as a new play. */
  fixNotYet: "Fixing a play by voice isn't ready yet. Tap Undo, then say the play again.",
};

const cards = {
  twoReadings: { heading: 'Not sure — which one?', note: 'Tap one, or use the buttons below. Nothing is saved yet.' },
  duplicate: { heading: 'Same play again?', note: 'You just saved this play. Tap it to save it again, or use the buttons below.' },
  confirmEverything: { heading: 'Check this play', note: 'Tap it to save, or use the buttons below. Nothing is saved yet.' },
};

const baseWords: Record<Base, string> = { 1: 'first', 2: 'second', 3: 'third' };
const positionWords: Record<Position, string> = {
  P: 'pitcher', C: 'catcher', '1B': 'first base', '2B': 'second base', '3B': 'third base', SS: 'shortstop',
  LF: 'left field', CF: 'center field', RF: 'right field', ROVER: 'rover',
};

/** Engine reject codes in the spec's message-catalog words (section 10). */
export function rejectMessage(code: RejectCode): string {
  switch (code) {
    case 'bunting_not_allowed': return "Bunting isn't allowed in this division.";
    case 'stealing_home_not_allowed': return "Stealing home isn't allowed in this division.";
    case 'balks_not_allowed': return "Balks aren't called in this division.";
    case 'pitcher_reentry_not_allowed': return "Re-entry isn't allowed in this division.";
    case 'runner_not_on_base': return "That runner isn't on base.";
    case 'base_occupied': return 'That base is already occupied.';
    case 'too_many_outs': return "That's more than three outs.";
    case 'game_over': return 'This game is over.';
    case 'game_not_started': return "The game hasn't started.";
    case 'runner_passed': return "A runner can't pass the runner ahead of them.";
    default: return "That play can't be recorded right now.";
  }
}

/** Why one reading can't save. */
type Refusal = NameRefusal | { kind: 'no_runner'; base: Base } | { kind: 'engine'; code: RejectCode } | { kind: 'passes' } | { kind: 'unusable' };

function refusalMessage(refusal: Refusal, transcript: string): string {
  switch (refusal.kind) {
    case 'no_runner': return `No runner on ${baseWords[refusal.base]}.`;
    case 'engine': return rejectMessage(refusal.code);
    case 'passes': return "A runner can't pass the runner ahead of them.";
    case 'unusable': return messages.unusable;
    case 'unaccounted': return messages.unclear(transcript);
    case 'nobody': {
      const { role } = refusal;
      if (role.kind === 'fielder') return `Nobody is playing ${positionWords[role.position]}.`;
      if (role.kind === 'runner') return `No runner on ${baseWords[role.base]}.`;
      if (role.kind === 'pitcher') return 'Nobody is pitching.';
      return messages.unclear(transcript);
    }
    case 'wrong_role': {
      const { role, holder, other } = refusal;
      const where = role.kind === 'batter' ? 'is up' : role.kind === 'earlier_batter' ? 'was up' : role.kind === 'pitcher' ? 'is pitching'
        : role.kind === 'runner' ? `is on ${baseWords[role.base]}` : `is playing ${positionWords[role.position]}`;
      return `${holder.name} ${where}${other ? `, not ${other.name}` : ''}.`;
    }
  }
}

/**
 * One reading, checked: mapped to commands against the game before the press, its names checked against who holds
 * each role, then the engine and the passing-runner check. A name that doesn't fit refuses even when the engine
 * would accept the play.
 */
function check(press: Press, reading: AnswerReading, fromAi: boolean): { ok: true; reading: Reading } | { ok: false; refusal: Refusal } {
  const { game } = press;
  const start = replay(game.setup, game.events);
  if (!start.ok) return { ok: false, refusal: { kind: 'engine', code: start.code } };
  const mapped = toCommands(game, start.state, reading);
  if (!mapped.ok) return { ok: false, refusal: mapped.why };
  // The phone's own pitch readings hold no names, so only the AI's answers need their names checked.
  const names = fromAi ? checkNames(game, start.state, mapped, reading, press.transcript) : null;
  if (names) return { ok: false, refusal: names };
  const result = applyGroup(game.setup, game.events, mapped.commands);
  if (!result.ok) return { ok: false, refusal: { kind: 'engine', code: result.code } };
  if (passesRunner(game, mapped.commands)) return { ok: false, refusal: { kind: 'passes' } };
  return { ok: true, reading: { commands: mapped.commands, banner: readBack(game, mapped.commands) } };
}

const same = (a: Command[], b: Command[]) => JSON.stringify(a) === JSON.stringify(b);

/**
 * A press that starts the way a correction does ("no, that was a double", "actually, a triple"), right after a play,
 * is treated as a fix even when the answer doesn't say so, so a fix never saves as a new play. "No. 17" is a number.
 */
function soundsLikeAFix(press: Press, answer: Answer): boolean {
  const { game, transcript } = press;
  let text = normalize(transcript).replace(/^[,;. ]+/, '');
  // "No!" and "No way" are cheers, so what comes after them decides: "No! That was a double." is still a fix. And
  // "oh" counts only before "wait" ("Oh no, Soto beans her" is a cheer too).
  if (/^\W*no\s*(?:!|way\b)/i.test(transcript)) text = text.replace(/^no(?: way)?[,;. ]*/, '');
  const opening = /^(?:no|nope|actually|wait|oh,? wait|oops|whoops|my bad|sorry|correction|i mean|make that|make it|change that|scratch that|strike that|undo that|hold on|hang on|that was|it was)\b(?![ .]*\d)/;
  const notA = /\bnot an? (?:single|double|triple|home run|homer|walk|strikeout|ball|strike|out|error)\b/;
  if (!opening.test(text) && !notA.test(text)) return false;
  const plays = standingPlays(game.events);
  const last = plays.at(-1);
  if (!last) return false;
  // "Wait, Cole singles" names a new batter who is up now, so it's a new play. The name has to be in the words, and
  // the batter has to have changed since the last play, or it's the last play being fixed.
  const now = stateAfter(game, []);
  // standingPlays hands back the game's own event objects, so indexOf finds where the last play starts.
  const then = stateAfter({ ...game, events: game.events.slice(0, game.events.indexOf(last[0]!)) }, []);
  const batter = now && batterUp(now);
  const before = then && batterUp(then);
  const holder = batter && entryFor(game.roster, batter);
  const named = answer.readings[0]?.batter;
  const said = new Set(words(transcript));
  const inWords = named !== undefined && (named.name !== null ? words(named.name).every((word) => said.has(word))
    : named.number !== null && new RegExp(`\\b${named.number}\\b`).test(text));
  const newBatter = Boolean(batter && before && !samePlayer(batter, before));
  return !(holder && named && inWords && newBatter && fits(game.roster, holder, named));
}

function fromAnswer(press: Press, answer: Answer, fromAi: boolean): Decision {
  if (answer.result === 'not_a_play') return { kind: 'message', message: messages.notAPlay };
  if (answer.result === 'unclear') return { kind: 'message', message: messages.unclear(press.transcript) };
  if (answer.fix_last || (fromAi && soundsLikeAFix(press, answer))) return { kind: 'message', message: messages.fixNotYet };
  const checked = answer.readings.map((reading) => check(press, reading, fromAi));
  // The names said are the same in every reading. A reading refused for a name means the answer misplaced it, so
  // no reading of that answer saves.
  const misnamed = checked.find((result) => !result.ok && (result.refusal.kind === 'wrong_role' || result.refusal.kind === 'unaccounted'));
  if (misnamed && !misnamed.ok) return { kind: 'message', message: refusalMessage(misnamed.refusal, press.transcript) };
  const accepted = checked.flatMap((result) => result.ok ? [result.reading] : [])
    .filter((reading, index, all) => all.findIndex((other) => same(other.commands, reading.commands)) === index);
  if (!accepted.length) {
    const first = checked[0]!;
    return { kind: 'message', message: first.ok ? messages.unusable : refusalMessage(first.refusal, press.transcript) };
  }
  if (accepted.length > 1) return { kind: 'choose', ...cards.twoReadings, readings: accepted };
  // One reading left. A question whose other reading the engine refused is a play: the rules picked it.
  const reading = accepted[0]!;
  const { previous } = press;
  if (previous && press.at - previous.at <= 3000 && same(previous.commands, reading.commands)) return { kind: 'choose', ...cards.duplicate, readings: [reading] };
  if (press.confirmEverything) return { kind: 'choose', ...cards.confirmEverything, readings: [reading] };
  return { kind: 'save', reading };
}

/** Everything after a press ends. The first step that answers wins. */
export function decide(press: Press, heard: Heard): Decision {
  switch (heard.kind) {
    case 'empty': return { kind: 'message', message: messages.empty };
    case 'undo': return { kind: 'undo' };
    case 'unusable': return { kind: 'message', message: messages.unusable };
    case 'pitches': return fromAnswer(press, heard.answer, false);
    case 'answer': return fromAnswer(press, heard.answer, true);
  }
}
