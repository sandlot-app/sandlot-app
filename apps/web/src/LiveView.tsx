import { useState, type KeyboardEvent } from 'react';
import type { GroupId } from '@sandlot/engine';
import emblem from './assets/logo-emblem.svg';
import { clipUrl, streamUrl } from './clips.ts';
import { Field } from './components/Field.tsx';
import { PlayList, playInning } from './components/PlayList.tsx';
import { inningText, Scoreboard, statusPill } from './components/Scoreboard.tsx';
import { StreamCard, type StreamView } from './components/StreamCard.tsx';
import type { ConnectionStatus, LiveGame } from './live.ts';
import type { Play } from './plays.ts';
import { rosterFor } from './roster.ts';

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

/** Before there is a scoreboard to show it, the connection shows on its own. */
function Connection({ status }: { status: Exclude<ConnectionStatus, 'not_found'> }) {
  const { text, kind } = statusPill(null, status);
  return (
    <p className={`connection ${kind}`} role="status">
      {text}
    </p>
  );
}

/** The live stream, or the clip of the play a family picked. Null when the game has no recording or hasn't started. */
export function streamView(game: LiveGame, selectedGroup: GroupId | null): StreamView | null {
  if (!game.recording) return null;
  const watching = game.plays.find((play) => play.group === selectedGroup && play.onField);
  if (watching) {
    const src = clipUrl(game.recording, watching.at);
    return { kind: 'clip', src, score: watching.scoreAfter, inning: playInning(watching), text: watching.text };
  }
  if (!game.state) return null;
  return { kind: 'live', src: streamUrl(game.recording.playbackId), score: game.state.score, inning: inningText(game.state) };
}

const ARROW_STEP: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1 };

/** WAI-ARIA tabs: one Tab stop, arrow keys and Home and End move between tabs. */
function Tabs({ tabs, tab, onSelect }: { tabs: readonly (typeof TABS)[number][]; tab: Tab; onSelect: (tab: Tab) => void }) {
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const index = tabs.findIndex(({ id }) => id === tab);
    const step = ARROW_STEP[event.key];
    const next =
      step !== undefined ? tabs[(index + step + tabs.length) % tabs.length] : event.key === 'Home' ? tabs[0] : event.key === 'End' ? tabs.at(-1) : undefined;
    if (!next) return;
    event.preventDefault();
    onSelect(next.id);
    document.getElementById(`tab-${next.id}`)?.focus();
  };
  return (
    <div className="tabs" role="tablist" aria-label="Game views" onKeyDown={onKeyDown}>
      {tabs.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          role="tab"
          id={`tab-${id}`}
          aria-selected={tab === id}
          aria-controls="tab-panel"
          tabIndex={tab === id ? 0 : -1}
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
  const [chosen, setTab] = useState<Tab>(initialTab);
  const [watching, setWatching] = useState<GroupId | null>(null);
  if (game.status === 'not_found') return <Message>Game not found or not public.</Message>;
  if (game.pins === null) {
    return (
      <main className="page">
        <Logo />
        <Connection status={game.status} />
        <p className="message card">Loading the game.</p>
      </main>
    );
  }
  const roster = rosterFor(game.pins.setup);
  const view = streamView(game, watching);
  // Only a game with a recording has a Video tab, the same rule the page had before tabs (#42).
  const tabs = game.recording ? TABS : TABS.filter(({ id }) => id !== 'video');
  const tab = tabs.some(({ id }) => id === chosen) ? chosen : 'field';
  const watch = (play: Play) => {
    setWatching(play.group);
    setTab('video');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const panel = () => {
    if (!game.state) return <p className="message card">Waiting for the game to start.</p>;
    switch (tab) {
      case 'field':
        return <Field state={game.state} roster={roster} />;
      case 'video':
        return view && <StreamCard view={view} teams={roster.teams} onBackToLive={() => setWatching(null)} />;
      case 'plays':
        return (
          <PlayList
            plays={game.plays}
            teams={roster.teams}
            live={game.state.status === 'in_progress'}
            onWatch={game.recording ? watch : undefined}
          />
        );
    }
  };
  return (
    <main className="page">
      <Logo />
      {game.state ? (
        <Scoreboard state={game.state} teams={roster.teams} connection={game.status} />
      ) : (
        <Connection status={game.status} />
      )}
      <Tabs tabs={tabs} tab={tab} onSelect={setTab} />
      {tab !== 'video' && (
        <p className="banner card">
          {roster.numbered ? 'Public link · Names are hidden, so players show by jersey number.' : 'Public link · Names are hidden.'}
        </p>
      )}
      <div id="tab-panel" role="tabpanel" aria-labelledby={`tab-${tab}`}>
        {panel()}
      </div>
    </main>
  );
}
