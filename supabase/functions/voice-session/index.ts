import { reply, voiceEndpoint } from '../_shared/voice.ts';
import { admit, getUser, openAi } from '../_shared/wiring.ts';
import { startSession } from './handler.ts';

const openai = openAi();
const model = Deno.env.get('VOICE_TRANSCRIBE_MODEL') ?? 'gpt-live-transcribe';

Deno.serve(voiceEndpoint({ getUser, access: (userId) => admit(userId, 'voice') }, (body) =>
  openai ? startSession(body, openai, model) : Promise.resolve(reply(502, { error: 'voice_unavailable' }))));
