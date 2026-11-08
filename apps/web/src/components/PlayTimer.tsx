import { useEffect, useRef, useState } from 'react';
import type { GroupId } from '@sandlot/engine';
import type { Play } from '../plays.ts';
import { summarizeDelays } from '../tools.ts';

type Arrival = { group: GroupId; text: string; delayMs: number };

const seconds = (ms: number) => `${(ms / 1000).toFixed(1)} s`;

/**
 * How long each play took from the scorer's action to this page. Plays in the first snapshot are old news, so only
 * later ones count. Both clocks must be set automatically, or their difference shows up in every number.
 */
export function PlayTimer({ plays, loaded }: { plays: Play[]; loaded: boolean }) {
  const seen = useRef<Set<GroupId> | null>(null);
  const [arrivals, setArrivals] = useState<Arrival[]>([]);

  useEffect(() => {
    if (!loaded) return;
    const shownAt = Date.now();
    if (seen.current === null) {
      seen.current = new Set(plays.map(({ group }) => group));
      return;
    }
    const known = seen.current;
    const fresh = plays.filter(({ group }) => !known.has(group));
    if (fresh.length === 0) return;
    fresh.forEach(({ group }) => known.add(group));
    setArrivals((sofar) => [...fresh.map(({ group, text, at }) => ({ group, text, delayMs: shownAt - Date.parse(at) })), ...sofar]);
  }, [plays, loaded]);

  const summary = summarizeDelays(arrivals.map(({ delayMs }) => delayMs));
  return (
    <aside className="play-timer" aria-label="Play to page">
      <p className="play-timer-summary">
        {summary
          ? `${summary.count} plays · median ${seconds(summary.medianMs)} · slowest ${seconds(summary.maxMs)}`
          : 'Waiting for the next play'}
      </p>
      <ol>
        {arrivals.slice(0, 5).map(({ group, text, delayMs }) => (
          <li key={group}>
            {seconds(delayMs)} · {text}
          </li>
        ))}
      </ol>
    </aside>
  );
}
