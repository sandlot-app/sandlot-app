import type { ServerRows } from './server-game.ts';
import type { Send } from './upload.ts';

// The web build is the development gallery and browser test. It never signs in or uploads.

export const project = null;
export const token = async (): Promise<string | null> => null;
export const phoneId = async (): Promise<string | null> => null;
export const send: Send | null = null;
export const serverRows: ServerRows | null = null;
