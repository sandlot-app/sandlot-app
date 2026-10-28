import type { Half } from '@sandlot/engine';
import baseball from '../assets/baseball.svg';
import type { Play, Score } from '../plays.ts';
import { TEAM_NAMES } from '../roster.ts';
import { runnersText } from './Scoreboard.tsx';

export function playInning(play: Play): string | null {
  if (play.inning === null || play.half === null) return null;
  return `${play.half === 'top' ? 'Top' : 'Bottom'} ${play.inning}`;
}

/** One half-inning's plays, oldest first, with the runs the batting team scored in it. */
type HalfInning = { key: string; title: string; half: Half | null; plays: Play[]; runs: number | null };

const total = (score: Score) => score.away + score.home;

function halfInnings(plays: Play[]): HalfInning[] {
  const halves: HalfInning[] = [];
  let scoreBefore: Score | null = { away: 0, home: 0 };
  let start: Score | null = scoreBefore;
  for (const play of plays) {
    const title = playInning(play) ?? 'Plays';
    let last = halves.at(-1);
    if (!last || last.title !== title) {
      start = scoreBefore;
      last = { key: `${title}-${play.group}`, title, half: play.half, plays: [], runs: null };
      halves.push(last);
    }
    last.plays.push(play);
    last.runs = start && play.scoreAfter ? total(play.scoreAfter) - total(start) : null;
    scoreBefore = play.scoreAfter;
  }
  return halves;
}

function situationText(play: Play): string | null {
  if (!play.situation) return null;
  const { outs, runners } = play.situation;
  const outText = `${outs} out${outs === 1 ? '' : 's'}`;
  return outs === 3 || runners.length === 0 ? outText : `${outText} · ${runnersText(runners)}`;
}

function isOut(play: Play, previous: Play | undefined): boolean {
  if (!play.situation) return false;
  const sameHalf = previous && previous.inning === play.inning && previous.half === play.half;
  const outsBefore = sameHalf && previous.situation && previous.situation.outs < 3 ? previous.situation.outs : 0;
  return play.situation.outs > outsBefore;
}

function scored(play: Play, previous: Play | undefined): boolean {
  if (!play.scoreAfter) return false;
  return total(play.scoreAfter) > (previous?.scoreAfter ? total(previous.scoreAfter) : 0);
}

function PlayRow({ play, previous, onWatch }: { play: Play; previous: Play | undefined; onWatch: ((play: Play) => void) | undefined }) {
  const out = isOut(play, previous);
  const scoring = scored(play, previous);
  const detail = play.onField ? situationText(play) : null;
  return (
    <li className={scoring ? 'play scored' : 'play'}>
      <span className={out ? 'play-icon out' : play.onField ? 'play-icon ball' : 'play-icon note'} aria-hidden="true">
        {!out && play.onField && <img src={baseball} alt="" />}
      </span>
      <span className="play-body">
        <span className="play-text">{play.text}</span>
        {detail && <span className="play-detail">{detail}</span>}
      </span>
      <span className="play-right">
        {scoring && play.scoreAfter && (
          <span className="score-pill">
            {TEAM_NAMES.away} {play.scoreAfter.away}, {TEAM_NAMES.home} {play.scoreAfter.home}
          </span>
        )}
        {onWatch && play.onField && (
          <button type="button" className="play-watch" onClick={() => onWatch(play)}>
            Watch
          </button>
        )}
      </span>
    </li>
  );
}

/** Half-innings newest first, the current one open. With `onWatch`, each play on the field offers its clip. */
export function PlayList({ plays, live, onWatch }: { plays: Play[]; live: boolean; onWatch?: ((play: Play) => void) | undefined }) {
  if (plays.length === 0) return <p className="empty card">No plays yet.</p>;
  const previous = new Map(plays.map((play, index) => [play.group, plays[index - 1]]));
  return (
    <div className="plays" aria-label="Play by play">
      {halfInnings(plays)
        .reverse()
        .map((half, index) => (
          <details key={half.key} className="half card" open={index === 0}>
            <summary>
              {live && index === 0 && <span className="live-dot" aria-hidden="true" />}
              <span className="half-title">{half.title}</span>
              {half.half && <span className="half-batting">· {TEAM_NAMES[half.half === 'top' ? 'away' : 'home']} batting</span>}
              {half.runs !== null && <span className="half-runs">{half.runs} R</span>}
            </summary>
            <ol>
              {[...half.plays].reverse().map((play) => (
                <PlayRow key={play.group} play={play} previous={previous.get(play.group)} onWatch={onWatch} />
              ))}
            </ol>
          </details>
        ))}
      <p className="hint">Tap an inning to open or close it</p>
    </div>
  );
}
