import { fromModel, parserInstructions, parserSchema, type ParserContext } from '../../../packages/voice/src/model.ts';
import { isEmptyTranscript, parsePhrase } from '../../../packages/voice/src/parse.ts';
import type { ParseResult } from '../../../packages/voice/src/types.ts';
import { names, type OpenAi, reply, type Reply, unavailable } from '../_shared/voice.ts';

export const SAMPLE_RATE = 24000;
/** 15 seconds of 16-bit mono audio, the longest press (A2). */
export const MAX_AUDIO_BYTES = 15 * SAMPLE_RATE * 2;
const MAX_TRANSCRIPT = 500;

export type Models = { parser: string; clip: string };

/** Wraps raw 16-bit mono PCM in a WAV header, so the transcription endpoint can read it. */
export function wav(pcm: Uint8Array): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(44 + pcm.length);
  const view = new DataView(out.buffer);
  const text = (at: number, value: string) => [...value].forEach((char, index) => view.setUint8(at + index, char.charCodeAt(0)));
  text(0, 'RIFF');
  view.setUint32(4, 36 + pcm.length, true);
  text(8, 'WAVE');
  text(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, SAMPLE_RATE * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, 'data');
  view.setUint32(40, pcm.length, true);
  out.set(pcm, 44);
  return out;
}

function decode(base64: string): Uint8Array | null {
  try {
    return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
  } catch {
    return null;
  }
}

function context(value: unknown): ParserContext | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  const batting = names(raw.batting);
  const fielding = names(raw.fielding);
  const runners = names(raw.runners, 3);
  return batting && fielding && runners ? { batting, fielding, runners } : null;
}

/** The text the Responses API returned, from its output message. */
function outputText(response: unknown): string | null {
  const output = (response as { output?: unknown } | null)?.output;
  if (!Array.isArray(output)) return null;
  for (const item of output) {
    for (const part of (item as { content?: unknown }).content as unknown[] ?? []) {
      const { type, text } = part as { type?: unknown; text?: unknown };
      if (type === 'output_text' && typeof text === 'string') return text;
    }
  }
  return null;
}

async function transcribe(openai: OpenAi, model: string, pcm: Uint8Array): Promise<string | null> {
  const form = new FormData();
  form.append('model', model);
  form.append('language', 'en');
  form.append('file', new Blob([wav(pcm)], { type: 'audio/wav' }), 'press.wav');
  const response = await openai('/v1/audio/transcriptions', { method: 'POST', body: form }).catch(() => null);
  if (!response?.ok) return null;
  const result = await response.json().catch(() => null) as { text?: unknown } | null;
  return typeof result?.text === 'string' ? result.text : null;
}

async function parse(openai: OpenAi, model: string, transcript: string, game: ParserContext): Promise<ParseResult | null> {
  const response = await openai('/v1/responses', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      model,
      instructions: parserInstructions(game),
      input: transcript,
      max_output_tokens: 800,
      store: false,
      text: { format: { type: 'json_schema', name: 'plays', strict: true, schema: parserSchema } },
    }),
  }).catch(() => null);
  if (!response?.ok) return null;
  const text = outputText(await response.json().catch(() => null));
  if (text === null) return { kind: 'unclear' };
  try {
    return fromModel(JSON.parse(text));
  } catch {
    return { kind: 'unclear' };
  }
}

/**
 * The server half of a press the phone couldn't finish alone. With `audio` it transcribes the clip first (A4/A5, the
 * slow-connection fallback). Then the local grammar reads the words, and the parser model gets only what it can't read.
 * The result is the same ParseResult the phone routes; the model only proposes, and `route` and the engine decide.
 */
export async function parseVoice(body: unknown, openai: OpenAi, models: Models): Promise<Reply> {
  if (!body || typeof body !== 'object') return reply(400, { error: 'invalid' });
  const raw = body as Record<string, unknown>;
  const game = context(raw.context);
  if (!game) return reply(400, { error: 'invalid' });
  let transcript: string | null;
  if (typeof raw.transcript === 'string') {
    if (raw.transcript.length > MAX_TRANSCRIPT) return reply(400, { error: 'invalid' });
    transcript = raw.transcript;
  } else if (typeof raw.audio === 'string') {
    const pcm = decode(raw.audio);
    if (pcm && pcm.length > MAX_AUDIO_BYTES) return reply(413, { error: 'too_long' });
    if (!pcm || pcm.length % 2) return reply(400, { error: 'invalid' });
    transcript = await transcribe(openai, models.clip, pcm);
    if (transcript === null) return unavailable;
  } else {
    return reply(400, { error: 'invalid' });
  }
  if (isEmptyTranscript(transcript)) return reply(200, { transcript, parsed: null });
  const local = parsePhrase(transcript);
  if (local.kind !== 'unclear') return reply(200, { transcript, parsed: local });
  const parsed = await parse(openai, models.parser, transcript, game);
  return parsed ? reply(200, { transcript, parsed }) : unavailable;
}
