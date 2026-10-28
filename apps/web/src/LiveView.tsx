import { useState } from 'react';
import emblem from './assets/logo-emblem.svg';
import { clipUrl, streamUrl } from './clips.ts';
import { Field } from './components/Field.tsx';
import { PlayList, playInning } from './components/PlayList.tsx';
import { inningText, Scoreboard } from './components/Scoreboard.tsx';
import { NoStream, StreamCard, type StreamView } from './components/StreamCard.tsx';
import type { LiveGame } from './live.ts';
import type { Play } from './plays.ts';

function Logo() {
  return (
    <header className="top">
      <h1 className="logo">
        sandlot
        <img className="logo-emblem" src={emblem} alt="" />
      </h1>
    </header>
  );
}

export function Message({ children }: { children: string }) {
  return (
    <main className="page">
      <Logo />
      <p className="message card">{children}</p>
    </main>
  );
}

export const TABS = [
  { id: 'field', label: 'Field' },
  { id: 'video', label: 'Video' },
  { id: 'plays', label: 'Plays' },
] as const;

export type Tab = (typeof TABS)[number]['id'];

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

function Tabs({ tab, onSelect }: { tab: Tab; onSelect: (tab: Tab) => void }) {
  return (
    <div className="tabs" role="tablist" aria-label="Game views">
      {TABS.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          role="tab"
          id={`tab-${id}`}
          aria-selected={tab === id}
          aria-controls="tab-panel"
          className="tab"
          onClick={() => onSelect(id)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

export function LiveView({ game, initialTab = 'field' }: { game: LiveGame; initialTab?: Tab }) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [watching, setWatching] = useState<Play | null>(null);
  if (game.status === 'not_found') return <Message>Game not found or not public.</Message>;
  const view = streamView(game, watching);
  const watch = (play: Play) => {
    setWatching(play);
    setTab('video');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const panel = () => {
    if (!game.state) return <p className="message card">Waiting for the game to start.</p>;
    switch (tab) {
      case 'field':
        return <Field state={game.state} />;
      case 'video':
        return view ? <StreamCard view={view} onBackToLive={() => setWatching(null)} /> : <NoStream />;
      case 'plays':
        return <PlayList plays={game.plays} live={game.state.status === 'in_progress'} onWatch={game.recording ? watch : undefined} />;
    }
  };
  return (
    <main className="page">
      <Logo />
      {game.pins === null ? (
        <p className="message card">Loading the game.</p>
      ) : (
        <>
          {game.state && <Scoreboard state={game.state} connection={game.status} />}
          <Tabs tab={tab} onSelect={setTab} />
          <p className="banner card">Public link · Names are hidden, so players show by jersey number.</p>
          <div id="tab-panel" role="tabpanel" aria-labelledby={`tab-${tab}`}>
            {panel()}
          </div>
        </>
      )}
    </main>
  );
}
