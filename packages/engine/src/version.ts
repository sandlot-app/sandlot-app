/** Bump whenever a fixture's result changes. A new game is pinned to this version. */
export const ENGINE_VERSION = '0.2.0';
/**
 * Every engine version whose games this engine replays and continues, its own first. A game keeps the version it
 * was pinned to and replays under this engine only while that version is listed here. An older version stays listed
 * only while `compat/` holds its fixture results and every one still comes out the same (docs/contract.md, Version pins).
 */
export const REPLAYABLE_ENGINE_VERSIONS: readonly string[] = [ENGINE_VERSION, '0.1.1'];
/** Bump whenever the shape of a stored event changes. */
export const EVENT_SCHEMA_VERSION = 2;

/** Whether this engine replays a game pinned to `engineVersion`. The server, the phone and the live page all ask this. */
export function canReplay(engineVersion: string): boolean {
  return REPLAYABLE_ENGINE_VERSIONS.includes(engineVersion);
}
