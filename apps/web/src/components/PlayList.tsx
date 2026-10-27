import type { Play } from '../plays.ts';

export function playInning(play: Play): string | null {
  if (play.inning === null || play.half === null) return null;
  return `${play.half === 'top' ? 'Top' : 'Bottom'} ${play.inning}`;
}

function detail(play: Play): string | null {
  const inning = playInning(play);
  if (inning === null) return null;
  return play.scoreAfter ? `${inning} · Away ${play.scoreAfter.away}, Home ${play.scoreAfter.home}` : inning;
}

function scored(play: Play, previous: Play | undefined): boolean {
  if (!play.scoreAfter || !previous?.scoreAfter) return false;
  return play.scoreAfter.away + play.scoreAfter.home > previous.scoreAfter.away + previous.scoreAfter.home;
}

/** Newest first. With `onWatch`, each play on the field offers its clip from the game's recording. */
export function PlayList({ plays, onWatch }: { plays: Play[]; onWatch?: ((play: Play) => void) | undefined }) {
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
            {onWatch && play.onField && (
              <button type="button" className="play-watch" onClick={() => onWatch(play)}>
                Watch
              </button>
            )}
          </li>
        ))}
    </ol>
  );
}
