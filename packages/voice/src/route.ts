import { applyGroup } from '@sandlot/engine';
import type { Command, Event, PlayerRef, RejectCode } from '@sandlot/engine';
import { classify } from './classify.ts';
import { echoMismatch, unsaid } from './echo.ts';
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
/** "No runner on second." reads "no runner on second" after a colon. A message that opens with a player's name keeps it. */
const lowerFirst = (game: PressGame, text: string) => {
  const trimmed = text.replace(/\.$/, '');
  return game.roster.some((entry) => trimmed.startsWith(entry.name)) ? trimmed : trimmed.charAt(0).toLowerCase() + trimmed.slice(1);
};

/** A call's words as the transcript has them, since the phone's reader lowercases them and drops what isn't a word. */
function asSaid(transcript: string, words: string): string {
  const pattern = words.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean).join('[^a-z0-9]+');
  return (pattern && transcript.match(new RegExp(pattern, 'i'))?.[0]) || words;
}

/**
 * "Couldn't record 'steals third': no runner on second. Nothing was saved." with the earlier calls on the press's one
 * card, for when they can't save on their own (ADR 0006).
 */
function cantRecord(game: PressGame, parts: string[], clause: number, before: Command[], reason: string): Decision {
  if (clause > 0 && legal(game, before)) {
    return { kind: 'reject', message: `Couldn't record "${parts[clause]}": ${lowerFirst(game, reason)}. Nothing was saved.`, savePart: reading(game, before) };
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
    if (!result.ok) return cantRecord(game, parts, clause, draft.commands.slice(0, start), rejectMessage(result.code));
  }
  return { kind: 'reject', message: "That play can't be recorded right now." };
}

type Plays = Extract<ParseResult, { kind: 'plays' }>;

const slice = (parsed: Plays, from: number, to?: number): Plays =>
  ({ ...parsed, plays: parsed.plays.slice(from, to), parts: parsed.parts.slice(from, to) });

/** The same press on another version of the game, with no earlier play to compare against and no confirm setting. */
const withEvents = (press: Press, events: Event[]): Press =>
  ({ setup: press.setup, roster: press.roster, transcript: press.transcript, at: press.at, events });

/** The game as it stands once `commands` save, so the calls after them are read against it. */
function onceSaved(press: Press, commands: Command[]): Press {
  const last = press.events.at(-1)!;
  const saved = commands.map((command, index) =>
    ({ ...last, id: `${last.id}+${index + 1}`, seq: last.seq + index + 1, group: `${last.group}+press`, command }) as Event);
  return withEvents(press, [...press.events, ...saved]);
}

/**
 * Reads a press as one Play, with no split. `part` marks the calls on one side of a split: the parser model's words for
 * them can't be checked against the whole transcript, which holds the other calls too, so only what they record must
 * have been said.
 */
function whole(press: Press, parsed: Plays, part = false): Decision {
  const resolved = resolve(press, parsed.plays);
  if (resolved.kind === 'issue') {
    const { issue } = resolved;
    if (issue.kind === 'who_is' || issue.kind === 'wrong_batter') {
      const players = issue.kind === 'who_is' ? issue.choices.map((choice) => choice.player) : [issue.due];
      const options = players.flatMap((player) => readingsFor(press, choose(parsed.plays, issue.clause, player)));
      if (options.length) return { kind: 'ask', prompt: issueMessage(press, issue), options };
    }
    return cantRecord(press, parsed.parts, resolved.clause, resolved.before, issueMessage(press, issue));
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
  const misheard = parsed.model && part ? unsaid(press.transcript, commands) : echoMismatch(parsed.model ? press.transcript : parsed.parts.join(', '), commands);
  if (misheard) reasons.push('echo');
  if (press.previous && press.at - press.previous.at <= 3000 && JSON.stringify(press.previous.commands) === JSON.stringify(commands)) reasons.push('duplicate');
  if (press.confirmEverything) reasons.push('confirm_everything');
  const result = reading(press, commands);
  return reasons.length ? { kind: 'confirm', reading: result, reasons } : { kind: 'save', reading: result };
}

/**
 * ADR 0006: when a press has no one reading, the clear calls before the first unclear one save as its Play, and only the
 * rest goes on one card. A runner's move belongs to the play before it, so a split never falls between them. When the
 * clear calls would need a card of their own, the whole press keeps its one card instead.
 */
function split(press: Press, parsed: Plays, full: Decision): Decision {
  if (full.kind !== 'ask' && full.kind !== 'reject') return full;
  const starts = parsed.plays.flatMap((play, index) => index > 0 && (play.kind === 'moves' || play.kind === 'scores') ? [] : [index]);
  let clear: { end: number; decision: Decision } | null = null;
  for (const end of starts.slice(1)) {
    const decision = whole(press, slice(parsed, 0, end), true);
    if (decision.kind !== 'save' && decision.kind !== 'confirm') break;
    clear = { end, decision };
  }
  if (clear?.decision.kind !== 'save') return full;
  const saved = clear.decision.reading;
  const rest = whole(onceSaved(press, saved.commands), slice(parsed, clear.end), true);
  const calls = parsed.parts.slice(clear.end).map((words) => asSaid(press.transcript, words));
  if (rest.kind === 'reject') {
    const message = rest.savePart ? rest.message : `Couldn't record "${calls[0]}": ${lowerFirst(press, rest.message)}.`;
    return { kind: 'partial', reading: saved, rest: { ...rest, message }, calls };
  }
  return rest.kind === 'ask' || rest.kind === 'confirm' ? { kind: 'partial', reading: saved, rest, calls } : full;
}

const fixStarts = 'no|actually|that was|undo that';
const fixStart = new RegExp(`^\\s*(?:${fixStarts})\\b`, 'i');
/** The starts, and the words that tend to follow them: "no wait, it was a double". */
const fixLead = new RegExp(`^[\\s,.;:!-]*(?:(?:${fixStarts}|wait|it was|that's|it's|make (?:that|it)|i mean|sorry)\\b[\\s,.;:!-]*)*`, 'i');

/**
 * The calls of a press that fixes the last Play ("no, that was a double", "actually ball four", "undo that, double"),
 * or null when the press doesn't start like a fix. The phone's reader reads them with the lead-in taken off.
 */
export function fixWords(transcript: string): string | null {
  if (!fixStart.test(transcript)) return null;
  const words = transcript.replace(fixLead, '').trim();
  return words && !isEmptyTranscript(words) ? words : null;
}

const playCommands = new Set<Command['kind']>(['pitch', 'ball_in_play', 'runner', 'batter_out']);

/** The latest play not undone, and the events before it. `fixed` means it's a Fix itself, which a voice fix doesn't replace. */
function lastPlay(events: Event[]): { play: Event[]; before: Event[] } | 'fixed' | null {
  const groups: Event[][] = [];
  for (const event of events) {
    const group = groups.at(-1);
    if (group?.[0]!.group === event.group) group.push(event);
    else groups.push([event]);
  }
  const active: Event[][] = [];
  for (const group of groups) {
    if (group[0]!.command.kind === 'undo') active.pop();
    else active.push(group);
  }
  const play = active.at(-1);
  if (play?.[0]!.command.kind === 'correct') return 'fixed';
  if (!play?.every((event) => playCommands.has(event.command.kind))) return null;
  return { play, before: events.slice(0, events.indexOf(play[0]!)) };
}

/** A Fix of the last Play: its new calls are read against the game before it, and nothing saves until the scorer taps. */
function fix(press: Press, words: string, parsed: ParseResult): Decision {
  const local = parsePhrase(words);
  if (local.kind === 'not_a_command') return { kind: 'no_play', question: local.question };
  const read = local.kind === 'plays' ? local : parsed.kind === 'plays' && parsed.model ? parsed : null;
  if (!read || read.plays.some((play) => play.kind === 'undo')) {
    return { kind: 'unknown_phrase', message: `Didn't understand "${press.transcript.trim()}". Tap to score.` };
  }
  const last = lastPlay(press.events);
  if (last === 'fixed') return { kind: 'reject', message: 'The last play is already a fix. Undo it, then say the play again.' };
  if (!last) return { kind: 'reject', message: "There's no play to fix yet." };
  const before = withEvents(press, last.before);
  const was = reading(before, last.play.map((event) => event.command));
  const target = last.play[0]!.group;
  const calls = read.parts.map((part) => asSaid(words, part));
  const replacement = whole(before, read);
  const options = replacement.kind === 'save' || replacement.kind === 'confirm' ? [replacement.reading]
    : replacement.kind === 'ask' ? replacement.options : null;
  if (!options) return replacement.kind === 'reject' ? { kind: 'reject', message: replacement.message } : replacement;
  const changed = options.filter((option) => JSON.stringify(option.commands) !== JSON.stringify(was.commands));
  if (!changed.length) return { kind: 'reject', message: "That's already the last play." };
  return replacement.kind === 'ask'
    ? { kind: 'fix', target, was, options: changed, prompt: replacement.prompt, calls }
    : { kind: 'fix', target, was, options: changed, calls };
}

/** Routes one press, in the spec's section 3 order. The first match wins. */
export function route(press: Press, parsed: ParseResult = parsePhrase(press.transcript)): Decision {
  if (isEmptyTranscript(press.transcript)) return { kind: 'didnt_catch' };
  const words = fixWords(press.transcript);
  if (words) return fix(press, words, parsed);
  if (parsed.kind === 'not_a_command') return { kind: 'no_play', question: parsed.question };
  if (parsed.kind === 'unclear') return { kind: 'unknown_phrase', message: `Didn't understand "${press.transcript.trim()}". Tap to score.` };
  if (parsed.plays.some((play) => play.kind === 'undo')) {
    return parsed.plays.length === 1 ? { kind: 'undo' } : { kind: 'unknown_phrase', message: `Didn't understand "${press.transcript.trim()}". Tap to score.` };
  }
  return split(press, parsed, whole(press, parsed));
}
