import { PlayList } from './components/PlayList.tsx';
import { Scoreboard } from './components/Scoreboard.tsx';
import { Situation } from './components/Situation.tsx';
import type { ConnectionStatus, LiveGame } from './live.ts';

export function Message({ children }: { children: string }) {
  return (
    <main className="page">
      <p className="message">{children}</p>
    </main>
  );
}

const STATUS_TEXT: Record<Exclude<ConnectionStatus, 'not_found'>, string> = {
  connecting: 'Connecting',
  live: 'Live',
  reconnecting: 'Reconnecting',
};

export function LiveView({ game }: { game: LiveGame }) {
  if (game.status === 'not_found') return <Message>Game not found or not public.</Message>;
  return (
    <main className="page">
      <header className="top">
        <h1>Sandlot</h1>
        <p className={`status ${game.status}`} role="status">
          {STATUS_TEXT[game.status]}
        </p>
      </header>
      {game.pins === null ? (
        <p className="message">Loading the game.</p>
      ) : (
        <>
          {game.state ? (
            <>
              <Scoreboard state={game.state} />
              {game.state.status === 'in_progress' && <Situation state={game.state} />}
            </>
          ) : (
            <p className="message">Waiting for the game to start.</p>
          )}
          <PlayList plays={game.plays} />
        </>
      )}
    </main>
  );
}
