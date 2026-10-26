import { rateLimit, reply, voiceEndpoint } from '../_shared/voice.ts';
import { getUser, openAi } from '../_shared/wiring.ts';
import { startSession } from './handler.ts';

const openai = openAi();
const model = Deno.env.get('VOICE_TRANSCRIBE_MODEL') ?? 'gpt-live-transcribe';

Deno.serve(voiceEndpoint({ getUser, allow: rateLimit(30, 60_000), now: Date.now }, (body) =>
  openai ? startSession(body, openai, model) : Promise.resolve(reply(502, { error: 'voice_unavailable' }))));
