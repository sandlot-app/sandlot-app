// voice-parse's side of voice: read the phone's context, ask the model once, read its reply. The phone imports index.ts.
export type { Answer } from './answer.ts';
export { readContext, type PressContext } from './context.ts';
export { readLocally } from './local.ts';
export { modelRequest, readModelReply } from './model.ts';
