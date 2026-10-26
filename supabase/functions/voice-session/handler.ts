import { names, type OpenAi, reply, type Reply, unavailable } from '../_shared/voice.ts';

export const SAMPLE_RATE = 24000;
export const SECRET_SECONDS = 60;
export const REALTIME_URL = 'wss://api.openai.com/v1/realtime?intent=transcription';

/** Scoring words the transcriber should expect, alongside the lineup's names. */
export const SCORING_WORDS = [
  'ball', 'strike', 'foul', 'foul tip', 'looking', 'swinging', 'strikeout', 'walk', 'hit by pitch',
  'single', 'double', 'triple', 'home run', 'ground out', 'fly out', 'line out', 'pop out', 'error',
  'steals', 'caught stealing', 'picked off', 'wild pitch', 'passed ball', 'scores', 'scratch that',
  'shortstop', 'first base', 'second base', 'third base', 'left field', 'center field', 'right field',
];

/**
 * Starts one press's live transcription (spec A4/A5 fall back to voice-parse). The phone gets a client secret that
 * lasts a minute and works only for a transcription session, so the server's OpenAI key never leaves the server.
 */
export async function startSession(body: unknown, openai: OpenAi, model: string): Promise<Reply> {
  const lineup = names(body && typeof body === 'object' ? (body as Record<string, unknown>).names : undefined);
  if (!lineup) return reply(400, { error: 'invalid' });
  const response = await openai('/v1/realtime/client_secrets', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      expires_after: { anchor: 'created_at', seconds: SECRET_SECONDS },
      session: {
        type: 'transcription',
        audio: {
          input: {
            format: { type: 'audio/pcm', rate: SAMPLE_RATE },
            transcription: { model, languages: ['en'], keywords: [...SCORING_WORDS, ...lineup] },
            turn_detection: null,
          },
        },
      },
    }),
  }).catch(() => null);
  if (!response?.ok) return unavailable;
  const secret = await response.json().catch(() => null) as { value?: unknown; expires_at?: unknown } | null;
  if (typeof secret?.value !== 'string' || typeof secret.expires_at !== 'number') return unavailable;
  return reply(200, { url: REALTIME_URL, secret: secret.value, expiresAt: secret.expires_at, sampleRate: SAMPLE_RATE });
}
