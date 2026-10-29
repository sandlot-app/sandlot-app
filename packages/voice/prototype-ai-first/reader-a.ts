// PROTOTYPE, THROWAWAY. Reader A, today's pipeline, run the way production runs it.
// voice-parse's own `parseVoice` does the phone-grammar-then-AI-parser step (so the prompt, strict schema, model and
// Responses call are exactly the handler's), and then the phone's `route()` decides what to do with its answer.

import { applyGroup } from '@sandlot/engine';
import type { Command } from '@sandlot/engine';
import { parseVoice } from '../../../supabase/functions/voice-parse/handler.ts';
import { route, type ParseResult, type Press } from '../src/index.ts';
import { entryFor } from '../src/players.ts';
import { append, endState, sameEnd, stateOf } from './game.ts';
import type { OpenAi } from './openai.ts';
import type { Read } from './reader-b.ts';
import type { Prepared } from './types.ts';

/** What the phone sends as `context`: the batting names, the fielding names, and the runners' names (outcome.ts pressInput). */
function contextFor(prep: Prepared) {
  const state = stateOf(prep.game);
  const batting = state.half === 'top' ? 'away' : 'home';
  const names = (side: 'home' | 'away') => state.lineups[side].flatMap(({ player }) => entryFor(prep.game.roster, player)?.name ?? []);
  const runners = ([1, 2, 3] as const).flatMap((base) => {
    const player = state.bases[base]?.player;
    return player ? entryFor(prep.game.roster, player)?.name ?? [] : [];
  });
  return { batting: names(batting), fielding: names(batting === 'away' ? 'home' : 'away'), runners };
}

export async function readerA(prep: Prepared, openai: OpenAi, parserModel: string): Promise<Read> {
  const press: Press = { ...prep.game, transcript: prep.transcript, at: 10_000 };
  const reply = await parseVoice({ transcript: prep.transcript, context: contextFor(prep) }, openai, { parser: parserModel, clip: 'unused' });
  if (reply.status !== 200) return { did: 'failed', note: `voice-parse ${reply.status}` };
  const { parsed } = reply.body as { parsed: ParseResult | null };
  const decision = parsed ? route(press, parsed) : route(press);
  const before = stateOf(prep.game);
  const endOf = (commands: Command[]) => {
    const result = applyGroup(prep.game.setup, prep.game.events, commands);
    return result.ok ? endState(prep.game, before, result.state) : null;
  };
  const rightAmong = (list: Command[][]) => prep.expect.do === 'save' && list.some((commands) => {
    const end = endOf(commands);
    return end !== null && sameEnd(end, prep.expect as Extract<typeof prep.expect, { do: 'save' }>);
  });

  switch (decision.kind) {
    case 'save': {
      const end = endOf(decision.reading.commands);
      return end ? { did: 'saved', end, note: decision.reading.readBack } : { did: 'rejected', note: 'the engine refused a reading route() called legal' };
    }
    case 'confirm':
      return { did: 'asked', cardRight: rightAmong([decision.reading.commands]), note: `card (${decision.reasons.join(', ')}): ${decision.reading.readBack}` };
    case 'ask':
      return { did: 'asked', cardRight: rightAmong(decision.options.map((option) => option.commands)), note: `asks "${decision.prompt}"` };
    case 'unknown_phrase':
      return { did: 'asked', note: "didn't understand" };
    case 'reject':
      return { did: 'rejected', note: decision.message };
    case 'no_play':
      return { did: 'no_play', note: decision.question ? 'a question, not a play' : 'not a play' };
    case 'didnt_catch':
      return { did: 'no_play', note: "didn't catch that" };
    case 'undo': {
      // Today "undo" and "scratch that" undo the last play. With a last play saved, that is a save of an undo.
      const last = prep.game.events.at(-1);
      if (!last || last.group === 'setup') return { did: 'rejected', note: 'undo, with nothing to undo' };
      const undone = append(prep.game, 'undo', [{ kind: 'undo', target: last.group }]);
      return { did: 'saved', end: endState(prep.game, before, stateOf(undone)), note: 'undoes the last play' };
    }
  }
}
