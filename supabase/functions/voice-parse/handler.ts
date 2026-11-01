import { modelRequest, readContext, readLocally, readModelReply } from '../../../packages/voice/src/server.ts';
import { type OpenAi, reply, type Reply, unavailable } from '../_shared/voice.ts';

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

/**
 * The server half of every press the phone can't read alone. It checks the game the phone sent, transcribes a clip if
 * it got one (A4/A5, the slow-connection fallback), asks the model once with the whole game in view, and returns the
 * answer with the model's notes already gone. It never decides anything: the phone maps the answer to commands and
 * the engine decides (rule 6). `answer` is null for an empty transcript, for words the phone reads itself (pitch
 * calls, a lone undo), and for a reply that was refused, cut off or broke the schema.
 */
export async function parseVoice(body: unknown, openai: OpenAi, models: Models): Promise<Reply> {
  if (!body || typeof body !== 'object') return reply(400, { error: 'invalid' });
  const raw = body as Record<string, unknown>;
  const context = readContext(raw.context);
  if (!context) return reply(400, { error: 'invalid' });
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
  if (readLocally(transcript)) return reply(200, { transcript, answer: null });
  const response = await openai('/v1/responses', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(modelRequest(models.parser, transcript, context)),
  }).catch(() => null);
  if (!response?.ok) return unavailable;
  return reply(200, { transcript, answer: readModelReply(await response.json().catch(() => null)) });
}
