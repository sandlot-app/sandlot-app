import { reply, voiceEndpoint } from '../_shared/voice.ts';
import { admit, getUser, openAi } from '../_shared/wiring.ts';
import { parseVoice } from './handler.ts';

const openai = openAi();
const models = {
  parser: Deno.env.get('VOICE_PARSER_MODEL') ?? 'gpt-6-luna',
  clip: Deno.env.get('VOICE_CLIP_MODEL') ?? 'gpt-transcribe',
};

Deno.serve(voiceEndpoint({ getUser, access: (userId) => admit(userId, 'voice') }, (body) =>
  openai ? parseVoice(body, openai, models) : Promise.resolve(reply(502, { error: 'voice_unavailable' }))));
