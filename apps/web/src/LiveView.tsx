import { useState } from 'react';
import { clipUrl, streamUrl } from './clips.ts';
import { PlayList, playInning } from './components/PlayList.tsx';
import { inningText, Scoreboard } from './components/Scoreboard.tsx';
import { StreamCard, type StreamView } from './components/StreamCard.tsx';
import { Situation } from './components/Situation.tsx';
import type { ConnectionStatus, LiveGame } from './live.ts';
import type { Play } from './plays.ts';

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

/** The live stream, or the clip of the play a family picked. Null when the game has no recording or hasn't started. */
function streamView(game: LiveGame, watching: Play | null): StreamView | null {
  if (!game.recording) return null;
  if (watching) {
    const src = clipUrl(game.recording, watching.at);
    return { kind: 'clip', src, score: watching.scoreAfter, inning: playInning(watching), text: watching.text };
  }
  if (!game.state) return null;
  return { kind: 'live', src: streamUrl(game.recording.playbackId), score: game.state.score, inning: inningText(game.state) };
}

export function LiveView({ game }: { game: LiveGame }) {
  const [watching, setWatching] = useState<Play | null>(null);
  if (game.status === 'not_found') return <Message>Game not found or not public.</Message>;
  const view = streamView(game, watching);
  const watch = (play: Play) => {
    setWatching(play);
    document.getElementById('video')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
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
          {view && <StreamCard view={view} onBackToLive={() => setWatching(null)} />}
          <PlayList plays={game.plays} onWatch={game.recording ? watch : undefined} />
        </>
      )}
    </main>
  );
}
