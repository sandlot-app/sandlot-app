import { Calibrate } from './components/Calibrate.tsx';
import { PlayTimer } from './components/PlayTimer.tsx';
import { supabaseConfig, type SupabaseConfig } from './config.ts';
import { LiveView, Message } from './LiveView.tsx';
import { useLiveGame } from './useLiveGame.ts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Filming-day tools, opened by adding `&calibrate` or `&timer` to the game's link. Both only read the public game. */
type Tool = 'calibrate' | 'timer' | null;

function FollowGame({ config, gameId, tool }: { config: SupabaseConfig; gameId: string; tool: Tool }) {
  const game = useLiveGame(config, gameId);
  if (tool === 'calibrate') return <Calibrate game={game} gameId={gameId} />;
  return (
    <>
      <LiveView game={game} />
      {tool === 'timer' && <PlayTimer plays={game.plays} loaded={game.pins !== null} />}
    </>
  );
}

export function App() {
  const params = new URLSearchParams(window.location.search);
  const gameId = params.get('game');
  if (gameId === null || !UUID.test(gameId)) return <Message>Game not found or not public.</Message>;
  if (supabaseConfig === null) return <Message>This page is missing its Supabase settings.</Message>;
  const tool: Tool = params.has('calibrate') ? 'calibrate' : params.has('timer') ? 'timer' : null;
  return <FollowGame config={supabaseConfig} gameId={gameId} tool={tool} />;
}
