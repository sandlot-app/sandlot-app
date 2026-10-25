import type { Event, GameState } from '@sandlot/engine';
import { buildTimeline, type Play } from './plays.ts';
import type { Pins, Snapshot } from './snapshot.ts';

export type ConnectionStatus = 'connecting' | 'live' | 'reconnecting' | 'not_found';

export type LiveGame = {
  revision: number;
  pins: Pins | null;
  events: Event[];
  plays: Play[];
  state: GameState | null;
  status: ConnectionStatus;
};

export type LiveAction =
  | { type: 'snapshot'; snapshot: Snapshot | null }
  | { type: 'connection'; status: Exclude<ConnectionStatus, 'not_found'> };

export const initialLiveGame: LiveGame = {
  revision: 0,
  pins: null,
  events: [],
  plays: [],
  state: null,
  status: 'connecting',
};

export function liveReducer(game: LiveGame, action: LiveAction): LiveGame {
  switch (action.type) {
    case 'connection':
      return game.status === 'not_found' ? game : { ...game, status: action.status };
    case 'snapshot': {
      const { snapshot } = action;
      if (snapshot === null) return { ...initialLiveGame, status: 'not_found' };
      if (game.pins !== null && snapshot.revision <= game.revision) return game;
      const seen = lastSeq(game);
      const events = [...game.events, ...snapshot.events.filter((event) => event.seq > seen)];
      const { engineVersion, schemaVersion, rules, setup } = snapshot;
      const pins: Pins = { engineVersion, schemaVersion, rules, setup };
      const { plays, state } = buildTimeline(pins, events, snapshot.state);
      return {
        revision: snapshot.revision,
        pins,
        events,
        plays,
        state,
        status: game.status === 'not_found' ? 'live' : game.status,
      };
    }
  }
}

/** Whether a message or snapshot that carries `revision` is news to this page. */
export function needsFetch(game: LiveGame, revision: number): boolean {
  return game.pins === null || revision > game.revision;
}

export function lastSeq(game: LiveGame): number {
  return game.events.at(-1)?.seq ?? 0;
}
