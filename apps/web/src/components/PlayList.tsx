import type { Play } from '../plays.ts';

function detail(play: Play): string | null {
  if (play.inning === null || play.half === null) return null;
  const inning = `${play.half === 'top' ? 'Top' : 'Bottom'} ${play.inning}`;
  return play.scoreAfter ? `${inning} · Away ${play.scoreAfter.away}, Home ${play.scoreAfter.home}` : inning;
}

function scored(play: Play, previous: Play | undefined): boolean {
  if (!play.scoreAfter || !previous?.scoreAfter) return false;
  return play.scoreAfter.away + play.scoreAfter.home > previous.scoreAfter.away + previous.scoreAfter.home;
}

/** Newest first. */
export function PlayList({ plays }: { plays: Play[] }) {
  if (plays.length === 0) return <p className="empty">No plays yet.</p>;
  return (
    <ol className="plays" aria-label="Play by play">
      {plays
        .map((play, index) => ({ play, scoring: scored(play, plays[index - 1]) }))
        .reverse()
        .map(({ play, scoring }) => (
          <li key={play.group} className={scoring ? 'play scored' : 'play'}>
            <span className="play-text">{play.text}</span>
            {detail(play) && <span className="play-detail">{detail(play)}</span>}
          </li>
        ))}
    </ol>
  );
}
