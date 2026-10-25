import { createClient } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';
import type { SupabaseConfig } from './config.ts';
import { initialLiveGame, lastSeq, liveReducer, needsFetch, type LiveAction, type LiveGame } from './live.ts';
import { isSnapshot } from './snapshot.ts';

const REFRESH_MS = 30_000;

/** Follows one public game: fetches a snapshot on every subscribe, on a newer revision, and every 30 seconds while connected. */
export function useLiveGame({ url, anonKey }: SupabaseConfig, gameId: string): LiveGame {
  const [game, setGame] = useState(initialLiveGame);

  useEffect(() => {
    const client = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    let current = initialLiveGame;
    let closed = false;
    let subscribed = false;
    let fetching = false;
    let fetchAgain = false;
    let refresh: ReturnType<typeof setInterval> | undefined;

    const send = (action: LiveAction) => {
      const next = liveReducer(current, action);
      if (closed || next === current) return;
      current = next;
      setGame(next);
    };

    // One request at a time, so two replies can never arrive out of order and leave a gap in the events.
    const fetchSnapshot = async () => {
      if (fetching) {
        fetchAgain = true;
        return;
      }
      fetching = true;
      try {
        do {
          fetchAgain = false;
          const { data, error } = await client.rpc('get_snapshot', { p_game_id: gameId, p_after_seq: lastSeq(current) });
          if (error || (data !== null && !isSnapshot(data))) {
            send({ type: 'connection', status: 'reconnecting' });
          } else {
            send({ type: 'snapshot', snapshot: data });
            if (subscribed) send({ type: 'connection', status: 'live' });
          }
        } while (fetchAgain && !closed);
      } finally {
        fetching = false;
      }
    };

    const channel = client
      .channel(`game:${gameId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'games', filter: `id=eq.${gameId}` },
        (payload) => {
          const revision: unknown = payload.new.revision;
          if (typeof revision === 'number' && needsFetch(current, revision)) void fetchSnapshot();
        },
      )
      .subscribe((status) => {
        clearInterval(refresh);
        subscribed = status === 'SUBSCRIBED';
        if (subscribed) {
          send({ type: 'connection', status: 'live' });
          void fetchSnapshot();
          refresh = setInterval(() => void fetchSnapshot(), REFRESH_MS);
        } else {
          send({ type: 'connection', status: 'reconnecting' });
        }
      });

    return () => {
      closed = true;
      clearInterval(refresh);
      void client.removeChannel(channel);
    };
  }, [url, anonKey, gameId]);

  return game;
}
