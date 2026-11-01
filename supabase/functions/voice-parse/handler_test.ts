import { deepStrictEqual, strictEqual } from 'node:assert/strict';
import type { OpenAi } from '../_shared/voice.ts';
import { MAX_AUDIO_BYTES, parseVoice, wav } from './handler.ts';

const context = { batting: ['J. Soto', 'L. Darcy'], fielding: ['K. Moss'], runners: ['J. Soto on 1st'] };
const models = { parser: 'gpt-6-luna', clip: 'gpt-transcribe' };
const play = (fields: Record<string, unknown>) => ({
  words: '', pitch: null, looking: null, bases: null, trajectory: null, fielder: null, event: null, to: null, who: null, ...fields,
});

function fakeOpenAi(answers: Record<string, { status: number; body: unknown }>) {
  const calls: { path: string; body: unknown }[] = [];
  const openai: OpenAi = (path, init) => {
    calls.push({ path, body: typeof init.body === 'string' ? JSON.parse(init.body) : init.body });
    const answer = answers[path] ?? { status: 404, body: {} };
    return Promise.resolve(new Response(JSON.stringify(answer.body), { status: answer.status }));
  };
  return { openai, calls };
}

const modelSays = (answer: unknown) => ({
  '/v1/responses': { status: 200, body: { output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(answer) }] }] } },
});

Deno.test('voice-parse reads what the local grammar knows without calling the model', async () => {
  const { openai, calls } = fakeOpenAi({});
  const result = await parseVoice({ transcript: 'Soto singles to left', context }, openai, models);
  deepStrictEqual(result, { status: 200, body: { transcript: 'Soto singles to left', parsed: {
    kind: 'plays', plays: [{ kind: 'hit', bases: 1, fielder: 'LF', batter: { name: 'soto' } }], parts: ['soto singles to left'],
  } } });
  strictEqual(calls.length, 0);
});

Deno.test('voice-parse asks the model for phrases the grammar does not know, with the schema and the lineup', async () => {
  const { openai, calls } = fakeOpenAi(modelSays({ result: 'plays', plays: [play({ kind: 'hit', bases: 2, fielder: 'LF', words: 'rips one into the corner' })] }));
  const result = await parseVoice({ transcript: 'Soto rips one into the left field corner, stands on second', context }, openai, models);
  strictEqual(result.status, 200);
  deepStrictEqual((result.body as { parsed: unknown }).parsed, {
    kind: 'plays', plays: [{ kind: 'hit', bases: 2, fielder: 'LF' }], parts: ['rips one into the corner'], model: true,
  });
  const request = calls[0]!.body as Record<string, any>;
  strictEqual(calls[0]!.path, '/v1/responses');
  strictEqual(request.model, 'gpt-6-luna');
  strictEqual(request.store, false);
  strictEqual(request.text.format.type, 'json_schema');
  strictEqual(request.text.format.strict, true);
  strictEqual(request.instructions.includes('Batting team: J. Soto, L. Darcy.'), true);
});

Deno.test('B9: a model answer that is not valid JSON or breaks the schema is unclear, never a play', async () => {
  const garbled = { '/v1/responses': { status: 200, body: { output: [{ type: 'message', content: [{ type: 'output_text', text: 'single!' }] }] } } };
  deepStrictEqual((await parseVoice({ transcript: 'he tagged and took two', context }, fakeOpenAi(garbled).openai, models)).body,
    { transcript: 'he tagged and took two', parsed: { kind: 'unclear' } });
  deepStrictEqual((await parseVoice({ transcript: 'he tagged and took two', context }, fakeOpenAi(modelSays({ result: 'plays', plays: [play({ kind: 'teleport' })] })).openai, models)).body,
    { transcript: 'he tagged and took two', parsed: { kind: 'unclear' } });
});

Deno.test('A4/A5: a recorded clip is transcribed as WAV, then read like a transcript', async () => {
  const { openai, calls } = fakeOpenAi({ '/v1/audio/transcriptions': { status: 200, body: { text: 'ball' } } });
  const audio = btoa(String.fromCharCode(...new Uint8Array(4800)));
  const result = await parseVoice({ audio, context }, openai, models);
  deepStrictEqual(result, { status: 200, body: { transcript: 'ball', parsed: { kind: 'plays', plays: [{ kind: 'pitch', result: 'ball' }], parts: ['ball'] } } });
  const form = calls[0]!.body as FormData;
  strictEqual(form.get('model'), 'gpt-transcribe');
  strictEqual((form.get('file') as File).size, 44 + 4800);
});

Deno.test('A6: an empty clip comes back with no parse, so the phone shows "didn\'t catch that"', async () => {
  const { openai } = fakeOpenAi({ '/v1/audio/transcriptions': { status: 200, body: { text: '  ' } } });
  deepStrictEqual((await parseVoice({ audio: btoa('\0\0'), context }, openai, models)).body, { transcript: '  ', parsed: null });
});

Deno.test('voice-parse refuses bodies it cannot use, and clips past 30 seconds', async () => {
  const { openai, calls } = fakeOpenAi({});
  strictEqual((await parseVoice({ transcript: 'ball' }, openai, models)).status, 400);
  strictEqual((await parseVoice({ context }, openai, models)).status, 400);
  strictEqual((await parseVoice({ transcript: 'x'.repeat(501), context }, openai, models)).status, 400);
  strictEqual((await parseVoice({ audio: '%%%', context }, openai, models)).status, 400);
  strictEqual((await parseVoice({ audio: btoa('\0'), context }, openai, models)).status, 400);
  const tooLong = 'A'.repeat(((MAX_AUDIO_BYTES + 6) / 3) * 4);
  strictEqual((await parseVoice({ audio: tooLong, context }, openai, models)).status, 413);
  strictEqual(calls.length, 0);
});

Deno.test('A10: OpenAI failing is "voice unavailable"', async () => {
  deepStrictEqual(await parseVoice({ transcript: 'he tagged and took two', context }, fakeOpenAi({ '/v1/responses': { status: 503, body: {} } }).openai, models),
    { status: 502, body: { error: 'voice_unavailable' } });
  deepStrictEqual(await parseVoice({ audio: btoa('\0\0'), context }, fakeOpenAi({}).openai, models), { status: 502, body: { error: 'voice_unavailable' } });
});

Deno.test('wav() writes a 16-bit mono 24 kHz header', () => {
  const file = wav(new Uint8Array([1, 2, 3, 4]));
  const view = new DataView(file.buffer);
  strictEqual(new TextDecoder().decode(file.subarray(0, 4)), 'RIFF');
  strictEqual(view.getUint32(24, true), 24000);
  strictEqual(view.getUint16(34, true), 16);
  strictEqual(view.getUint32(40, true), 4);
  strictEqual(file.length, 48);
});
