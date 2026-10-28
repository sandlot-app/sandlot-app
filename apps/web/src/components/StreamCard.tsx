import { useCallback, useEffect, useRef, useState } from 'react';
import type { Score } from '../plays.ts';
import type { Roster } from '../roster.ts';

/**
 * Plays an HLS stream. Safari plays HLS itself, and every other browser loads hls.js only when a game has video, so
 * games without a stream don't download it.
 */
function HlsVideo({ src, onError }: { src: string; onError: () => void }) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = src;
      return () => {
        video.removeAttribute('src');
        video.load();
      };
    }
    let destroy = () => {};
    let cancelled = false;
    void import('hls.js/light').then(({ default: Hls }) => {
      if (cancelled) return;
      if (!Hls.isSupported()) return onError();
      const hls = new Hls();
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) onError();
      });
      hls.loadSource(src);
      hls.attachMedia(video);
      destroy = () => hls.destroy();
    });
    return () => {
      cancelled = true;
      destroy();
    };
  }, [src, onError]);

  return <video ref={ref} className="stream-video" controls playsInline muted autoPlay onError={onError} />;
}

/** What the video shows: the live stream under the live score, or one play's clip under the score after it. */
export type StreamView =
  | { kind: 'live'; src: string; score: Score; inning: string }
  | { kind: 'clip'; src: string; score: Score | null; inning: string | null; text: string };

const ERROR_TEXT: Record<StreamView['kind'], string> = {
  live: 'The video isn’t playing. The score and plays still update.',
  clip: 'This clip can’t play. A clip is ready about 15 seconds after its play, and only plays after the video started have one.',
};

function scoreText(teams: Roster['teams'], score: Score | null, inning: string | null): string {
  const parts = [score && `${teams.away.name} ${score.away}, ${teams.home.name} ${score.home}`, inning];
  return parts.filter(Boolean).join(' · ');
}

export function StreamCard({ view, teams, onBackToLive }: { view: StreamView; teams: Roster['teams']; onBackToLive: () => void }) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const onError = useCallback(() => setFailedSrc(view.src), [view.src]);
  const score = scoreText(teams, view.score, view.inning);

  return (
    <section className="stream" aria-label="Video">
      <div className="stream-card card">
        <div className="stream-frame">
          {failedSrc === view.src ? (
            <div className="stream-error">
              <p>{ERROR_TEXT[view.kind]}</p>
              <button type="button" onClick={() => setFailedSrc(null)}>
                Try again
              </button>
            </div>
          ) : (
            <HlsVideo src={view.src} onError={onError} />
          )}
          <span className={`stream-badge ${view.kind}`}>{view.kind === 'live' ? 'Live' : 'Clip'}</span>
        </div>
        <div className="stream-info">
          <p className="stream-title">{view.kind === 'live' ? `${teams.away.name} vs. ${teams.home.name}` : view.text}</p>
          <p className="stream-score">
            {view.kind === 'live' ? <span className="stream-live">Live</span> : 'After the play'}
            {score && ` · ${score}`}
          </p>
        </div>
      </div>
      {view.kind === 'clip' ? (
        <button type="button" className="stream-back" onClick={onBackToLive}>
          Back to live
        </button>
      ) : (
        <p className="stream-caption">The stream can run a few seconds behind the score.</p>
      )}
    </section>
  );
}
