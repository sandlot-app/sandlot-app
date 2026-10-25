import { supabaseConfig, type SupabaseConfig } from './config.ts';
import { LiveView, Message } from './LiveView.tsx';
import { useLiveGame } from './useLiveGame.ts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function FollowGame({ config, gameId }: { config: SupabaseConfig; gameId: string }) {
  const game = useLiveGame(config, gameId);
  return <LiveView game={game} />;
}

export function App() {
  const gameId = new URLSearchParams(window.location.search).get('game');
  if (gameId === null || !UUID.test(gameId)) return <Message>Game not found or not public.</Message>;
  if (supabaseConfig === null) return <Message>This page is missing its Supabase settings.</Message>;
  return <FollowGame config={supabaseConfig} gameId={gameId} />;
}
