import type { Event, GameSetup, GameState, RuleSet } from '@sandlot/engine';

/** What `get_snapshot` returns for a game the caller can see. Events are only those after the requested seq. */
export type Snapshot = {
  gameId: string;
  revision: number;
  engineVersion: string;
  schemaVersion: number;
  rules: RuleSet;
  setup: Omit<GameSetup, 'rules'>;
  state: GameState | null;
  events: Event[];
};

/** What a game is fixed to when it is created. */
export type Pins = Pick<Snapshot, 'engineVersion' | 'schemaVersion' | 'rules' | 'setup'>;

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

/** Checks the envelope only. Events are trusted as far as the engine and the text tables can read them. */
export function isSnapshot(value: unknown): value is Snapshot {
  return (
    isObject(value) &&
    typeof value.revision === 'number' &&
    typeof value.engineVersion === 'string' &&
    typeof value.schemaVersion === 'number' &&
    isObject(value.rules) &&
    isObject(value.setup) &&
    Array.isArray(value.events)
  );
}
