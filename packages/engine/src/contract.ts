import type { Event, SessionId } from './types.ts';

/** One play sent from the scorer's phone to `sync-events`. See docs/contract.md. */
export type UploadRequest = { sessionId: SessionId; events: Event[] };
