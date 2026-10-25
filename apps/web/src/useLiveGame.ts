import { createClient } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';
import type { SupabaseConfig } from './config.ts';
import { initialLiveGame, lastSeq, liveReducer, needsFetch, type LiveAction, type LiveGame } from './live.ts';
import { snapshotFetcher } from './snapshotFetcher.ts';

const REFRESH_MS = 30_000;

/** Follows one public game: fetches a snapshot on load, on every subscribe, on a newer revision, and every 30 seconds. */
export function useLiveGame({ url, anonKey }: SupabaseConfig, gameId: string): LiveGame {
  const [game, setGame] = useState(initialLiveGame);

  useEffect(() => {
    const client = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    let current = initialLiveGame;
    let closed = false;
    let subscribed = false;

    const send = (action: LiveAction) => {
      const next = liveReducer(current, action);
      if (closed || next === current) return;
      current = next;
      setGame(next);
    };

    const fetchSnapshot = snapshotFetcher(
      (afterSeq, signal) => client.rpc('get_snapshot', { p_game_id: gameId, p_after_seq: afterSeq }).abortSignal(signal),
      { afterSeq: () => lastSeq(current), send, subscribed: () => subscribed, closed: () => closed },
    );

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
        subscribed = status === 'SUBSCRIBED';
        if (subscribed) {
          send({ type: 'connection', status: 'live' });
          void fetchSnapshot();
        } else {
          send({ type: 'connection', status: 'reconnecting' });
        }
      });

    // Load and poll even while Realtime is down, so the score still shows and catches up.
    void fetchSnapshot();
    const refresh = setInterval(() => void fetchSnapshot(), REFRESH_MS);

    return () => {
      closed = true;
      clearInterval(refresh);
      void client.removeChannel(channel);
    };
  }, [url, anonKey, gameId]);

  return game;
}
