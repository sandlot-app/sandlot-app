import { useCallback, useEffect, useRef, useState } from 'react';
import type { Score } from '../plays.ts';

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

export function StreamCard({ view, onBackToLive }: { view: StreamView; onBackToLive: () => void }) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const onError = useCallback(() => setFailedSrc(view.src), [view.src]);

  return (
    <section id="video" className="stream" aria-label="Video">
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
        <p className="stream-score">
          {view.score && `Away ${view.score.away} · Home ${view.score.home}`}
          {view.score && view.inning && ' · '}
          {view.inning}
        </p>
      </div>
      {view.kind === 'clip' ? (
        <div className="stream-clip">
          <p className="stream-caption">{view.text}</p>
          <button type="button" className="stream-back" onClick={onBackToLive}>
            Back to live
          </button>
        </div>
      ) : (
        <p className="stream-caption">The stream can run a few seconds behind the score.</p>
      )}
    </section>
  );
}
