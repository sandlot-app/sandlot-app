// PROTOTYPE, THROWAWAY. A fake OpenAI, so the whole run can be checked end to end with no key and no network.
// Its answers are NOT a model's: reader B's fake answers with each case's ideal answer, spoiled on a fixed schedule
// (a dropped runner, an "unclear", an impossible runner event, a server error) so every counter in the tables moves.
// Reader A's fake is a crude keyword reader. The numbers a fake run prints say nothing about the real models.

import type { OpenAi } from './openai.ts';
import { expandIdeal } from './reader-b.ts';
import type { Case } from './types.ts';

const respond = (text: string, input: string, delay: number): Promise<Response> => new Promise((resolve) => setTimeout(() => resolve(new Response(JSON.stringify({
  status: 'completed',
  output: [{ type: 'message', content: [{ type: 'output_text', text }] }],
  usage: { input_tokens: Math.ceil((input.length + 2500) / 4), output_tokens: Math.ceil(text.length / 4) + 60, input_tokens_details: { cached_tokens: 0 } },
}), { status: 200 })), delay));

const play = (fields: Record<string, unknown>) => ({
  words: '', pitch: null, looking: null, bases: null, trajectory: null, fielder: null, event: null, to: null, who: null, ...fields,
});

function crudeParser(transcript: string) {
  const text = transcript.toLowerCase();
  const bases = /home run|homer|went yard|moonshot|gone/.test(text) ? 4 : /triple/.test(text) ? 3 : /double/.test(text) ? 2 : /single|bloop|dunk|hit/.test(text) ? 1 : 0;
  if (bases) return { result: 'plays', plays: [play({ kind: 'hit', bases, words: transcript.slice(0, 60) })] };
  if (/punched|strikes? out|struck out/.test(text)) return { result: 'plays', plays: [play({ kind: 'strikeout', looking: false, words: 'strikes out' })] };
  if (/\bwho\b|\?|let's go|come on|nice job|ump/.test(text)) return { result: 'not_a_command', plays: [] };
  return { result: 'unclear', plays: [] };
}

export function fakeOpenAi(cases: Case[]): OpenAi {
  return async (path, init) => {
    if (path !== '/v1/responses' || typeof init.body !== 'string') return new Response('{}', { status: 404 });
    const body = JSON.parse(init.body) as { input: string; text: { format: { name: string } } };
    if (body.text.format.name === 'plays') {
      return respond(JSON.stringify(crudeParser(body.input)), body.input, 5 + (body.input.length % 30));
    }
    const index = cases.reduce((best, c, i) => body.input.includes(`"${c.transcript}"`) && (best < 0 || c.transcript.length > cases[best]!.transcript.length) ? i : best, -1);
    if (index < 0) return new Response('{}', { status: 404 });
    const answer = expandIdeal(cases[index]!.ideal);
    if (index % 19 === 2) return new Response(JSON.stringify({ error: { code: 'server_error' } }), { status: 500 });
    if (index % 13 === 6) answer.result = 'unclear';
    if (index % 9 === 4 && answer.ball_in_play?.runners.length) answer.ball_in_play.runners.shift();
    if (index % 17 === 9) answer.runner_events.push({ event: 'caught_stealing', from: '3', to: '1' });
    if (index % 11 === 5 && answer.ball_in_play) Object.assign(answer.ball_in_play, { outcome: 'single', batter_to: '1', runners: [] });
    return respond(JSON.stringify(answer), body.input, 20 + (index * 37) % 90);
  };
}
