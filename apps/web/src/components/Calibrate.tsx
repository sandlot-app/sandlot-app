import { useCallback, useRef, useState } from 'react';
import { clipUrl, streamUrl } from '../clips.ts';
import type { LiveGame } from '../live.ts';
import { Message } from '../LiveView.tsx';
import { clockOffsetMs, offsetSql } from '../tools.ts';
import { playInning } from './PlayList.tsx';
import { HlsVideo, type RecordingClock } from './StreamCard.tsx';

/**
 * Measures the clap offset from the video itself: Kevin scrubs the recording to the clap, picks the play the clap
 * matches, and gets the offset as SQL, with that play's clip to check it.
 */
export function Calibrate({ game, gameId }: { game: LiveGame; gameId: string }) {
  const clock = useRef<RecordingClock | null>(null);
  const [chosen, setChosen] = useState<string | null>(null);
  const [offset, setOffset] = useState<number | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const onError = useCallback(() => setProblem('The recording isn’t playing.'), []);

  if (game.status === 'not_found') return <Message>Game not found or not public.</Message>;
  if (game.pins === null) return <Message>Loading the game.</Message>;
  if (!game.recording) return <Message>This game has no recording yet. Add its row as apps/web/README.md says, then reload.</Message>;
  const plays = game.plays.filter((play) => play.onField);
  const play = plays.find(({ group }) => group === chosen) ?? plays[0];
  if (!play) return <Message>Score the first pitch, then reload.</Message>;

  const mark = () => {
    const clapMs = clock.current?.() ?? null;
    if (clapMs === null) return setProblem('This video carries no clock, so the offset can’t be read from it.');
    setProblem(null);
    setOffset(clockOffsetMs(clapMs, play.at));
  };

  return (
    <main className="page calibrate">
      <h1 className="calibrate-title">Clap offset</h1>
      <p>1. Pause the recording on the clap.</p>
      <HlsVideo src={streamUrl(game.recording.playbackId)} onError={onError} clock={clock} />
      <label>
        2. The clap is at this play:{' '}
        <select
          value={play.group}
          onChange={(event) => {
            setChosen(event.target.value);
            setOffset(null);
          }}
        >
          {plays.map((option) => (
            <option key={option.group} value={option.group}>
              {[playInning(option), option.text].filter(Boolean).join(' · ')}
            </option>
          ))}
        </select>
      </label>
      <button type="button" onClick={mark}>
        3. The clap is here
      </button>
      {problem && <p role="alert">{problem}</p>}
      {offset !== null && (
        <>
          <p>
            Offset {offset} ms. The game now uses {game.recording.clockOffsetMs} ms. Run this in the Supabase SQL editor:
          </p>
          <pre className="calibrate-sql">{offsetSql(gameId, offset)}</pre>
          <p>The play’s clip with this offset. The clap should come about 12 seconds in.</p>
          <HlsVideo src={clipUrl({ ...game.recording, clockOffsetMs: offset }, play.at)} onError={onError} />
        </>
      )}
    </main>
  );
}
