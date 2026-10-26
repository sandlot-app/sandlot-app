import { applyGroup } from '@sandlot/engine';
import type { Command, PlayerRef, RejectCode } from '@sandlot/engine';
import { classify } from './classify.ts';
import { echoMismatch } from './echo.ts';
import { heldRunners, readBack } from './explain.ts';
import { isEmptyTranscript, parsePhrase } from './parse.ts';
import { nameOf } from './players.ts';
import { passesRunner, resolve, stateAfter, type Draft, type Issue, type PressGame } from './resolve.ts';
import type { ConfirmReason, Decision, ParseResult, Reading, Spoken } from './types.ts';

export type Press = PressGame & {
  transcript: string;
  /** When the press started, in milliseconds. */
  at: number;
  /** The play saved just before this press, for the duplicate guard (D4). */
  previous?: { commands: Command[]; at: number };
  /** The scorer's "confirm everything" setting. */
  confirmEverything?: boolean;
};

const baseName = { 1: 'first', 2: 'second', 3: 'third' } as const;

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
    default: return "That play can't be recorded right now.";
  }
}

function issueMessage(game: PressGame, issue: Issue): string {
  switch (issue.kind) {
    case 'wrong_side': return `${nameOf(game.roster, issue.player)} is in the field this half.`;
    case 'not_on_base': return `${nameOf(game.roster, issue.player)} isn't on base.`;
    case 'no_runner': return issue.base ? `No runner on ${baseName[issue.base]}.` : 'No runners on base.';
    case 'not_strike_three': return `That would be strike ${issue.strike}, not strike three.`;
    case 'not_ball_four': return `That would be ball ${issue.ball}, not ball four.`;
    case 'needs_how': return 'Say how the runner moved, like "wild pitch, runner scores".';
    case 'who_is': return `Who is ${issue.heard.replace(/\b(?!number\b)[a-z]/g, (letter) => letter.toUpperCase())}?`;
    case 'wrong_batter': return `${nameOf(game.roster, issue.due)} is up, not ${nameOf(game.roster, issue.named)}.`;
  }
}

const reading = (game: PressGame, commands: Command[]): Reading => ({ commands, readBack: readBack(game, commands) });
const legal = (game: PressGame, commands: Command[]) =>
  commands.length > 0 && applyGroup(game.setup, game.events, commands).ok && !passesRunner(game, commands);

/** Drops readings that record the same commands as an earlier one, so no two buttons do the same thing. */
const distinct = (drafts: Draft[]) => drafts.filter((draft, index) =>
  drafts.findIndex((other) => JSON.stringify(other.commands) === JSON.stringify(draft.commands)) === index);
const lowerFirst = (text: string) => text.charAt(0).toLowerCase() + text.slice(1).replace(/\.$/, '');

/** "Couldn't record 'steals third': no runner on second. Nothing was saved." with the earlier clauses offered on their own (B6). */
function partial(game: PressGame, parts: string[], clause: number, before: Command[], reason: string): Decision {
  if (clause > 0 && legal(game, before)) {
    return { kind: 'reject', message: `Couldn't record "${parts[clause]}": ${lowerFirst(reason)}. Nothing was saved.`, savePart: reading(game, before) };
  }
  return { kind: 'reject', message: reason };
}

/** Replaces who a clause names with a chosen player, for the answers to "Who is …?" and "… is up". */
function choose(plays: Spoken[], clause: number, player: PlayerRef): Spoken[] {
  return plays.map((play, index) => {
    if (index !== clause) return play;
    if (['pitch', 'walk', 'strikeout', 'hit', 'out', 'error', 'reached'].includes(play.kind)) return { ...play, batter: { player } } as Spoken;
    return { ...play, runner: { player } } as Spoken;
  });
}

function readingsFor(game: PressGame, plays: Spoken[]): Reading[] {
  const resolved = resolve(game, plays);
  if (resolved.kind !== 'drafts') return [];
  return distinct(resolved.drafts.filter((draft) => legal(game, draft.commands))).map((draft) => reading(game, draft.commands));
}

function failure(game: PressGame, parts: string[], draft: Draft): Decision {
  for (const [clause, start] of draft.starts.entries()) {
    const end = draft.starts[clause + 1] ?? draft.commands.length;
    const result = applyGroup(game.setup, game.events, draft.commands.slice(0, end));
    if (!result.ok) return partial(game, parts, clause, draft.commands.slice(0, start), rejectMessage(result.code));
  }
  return { kind: 'reject', message: "That play can't be recorded right now." };
}

/** Routes one press, in the spec's section 3 order. The first match wins. */
export function route(press: Press, parsed: ParseResult = parsePhrase(press.transcript)): Decision {
  if (isEmptyTranscript(press.transcript)) return { kind: 'didnt_catch' };
  if (parsed.kind === 'not_a_command') return { kind: 'no_play', question: parsed.question };
  if (parsed.kind === 'unclear') return { kind: 'unknown_phrase', message: `Didn't understand "${press.transcript.trim()}". Tap to score.` };
  if (parsed.plays.some((play) => play.kind === 'undo')) {
    return parsed.plays.length === 1 ? { kind: 'undo' } : { kind: 'unknown_phrase', message: `Didn't understand "${press.transcript.trim()}". Tap to score.` };
  }
  const resolved = resolve(press, parsed.plays);
  if (resolved.kind === 'issue') {
    const { issue } = resolved;
    if (issue.kind === 'who_is' || issue.kind === 'wrong_batter') {
      const players = issue.kind === 'who_is' ? issue.choices.map((choice) => choice.player) : [issue.due];
      const options = players.flatMap((player) => readingsFor(press, choose(parsed.plays, issue.clause, player)));
      if (options.length) return { kind: 'ask', prompt: issueMessage(press, issue), options };
    }
    return partial(press, parsed.parts, resolved.clause, resolved.before, issueMessage(press, issue));
  }
  const drafts = distinct(resolved.drafts.filter((draft) => legal(press, draft.commands)));
  if (!drafts.length) return failure(press, parsed.parts, resolved.drafts[0]!);
  if (drafts.length > 1) {
    return { kind: 'ask', prompt: resolved.question ?? 'Which one?', options: drafts.map((draft) => reading(press, draft.commands)) };
  }
  const commands = drafts[0]!.commands;
  const before = stateAfter(press, [])!;
  const after = stateAfter(press, commands)!;
  const reasons: ConfirmReason[] = [];
  if (classify(before, after, commands) === 'complex') reasons.push('complex');
  if (heldRunners(press, commands).length) reasons.push('runner_held');
  if (echoMismatch(parsed.parts.join(', '), commands)) reasons.push('echo');
  if (press.previous && press.at - press.previous.at <= 3000 && JSON.stringify(press.previous.commands) === JSON.stringify(commands)) reasons.push('duplicate');
  if (press.confirmEverything) reasons.push('confirm_everything');
  const result = reading(press, commands);
  return reasons.length ? { kind: 'confirm', reading: result, reasons } : { kind: 'save', reading: result };
}
