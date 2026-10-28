import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { initialLiveGame, liveReducer } from '../src/live.ts';
import { LiveView, TABS, type Tab } from '../src/LiveView.tsx';
import { sampleEvents, snapshot } from './helpers.ts';

const render = (events: ReturnType<typeof sampleEvents>, status: 'live' | 'reconnecting' = 'live', tab: Tab = 'field') => {
  const loaded = liveReducer(initialLiveGame, { type: 'snapshot', snapshot: snapshot(events) });
  return renderToStaticMarkup(<LiveView game={liveReducer(loaded, { type: 'connection', status })} initialTab={tab} />);
};

describe('LiveView', () => {
  it('opens on the field with the score, the count and the runner on second', () => {
    const html = render(sampleEvents().filter((event) => event.seq <= 8));

    expect(html).toContain('Top 1');
    expect(html).toContain('runner on 2nd');
    expect(html).toContain('Live');
    expect(html).toContain('aria-selected="true" aria-controls="tab-panel" class="tab">Field');
    expect(html).toMatch(/class="chip batting"[^>]*><span class="chip-disc">17<\/span><span class="chip-label">Runner/);
  });

  it('lists the newest play first under its half-inning, with the outs and runners after it', () => {
    const html = render(sampleEvents().filter((event) => event.seq <= 8), 'live', 'plays');

    expect(html).toContain('Top 1</span><span class="half-batting">· Marlins batting');
    expect(html.indexOf('#17 steals 2nd')).toBeLessThan(html.indexOf('#17 singles to left (LF)'));
    expect(html).toContain('0 outs · runner on 2nd');
  });

  it('shows the reconnecting indicator', () => {
    expect(render(sampleEvents(), 'reconnecting')).toContain('Reconnecting');
  });

  it('shows no video and no clip buttons while the game has no recording', () => {
    expect(render(sampleEvents(), 'live', 'video')).toContain('No stream for this game');
    expect(render(sampleEvents(), 'live', 'plays')).not.toContain('Watch');
  });

  it('plays the recording under the live score and offers a clip of every play', () => {
    const loaded = liveReducer(initialLiveGame, { type: 'snapshot', snapshot: snapshot(sampleEvents()) });
    const withVideo = liveReducer(loaded, { type: 'recording', recording: { playbackId: 'abc123', clockOffsetMs: 0 } });
    const video = renderToStaticMarkup(<LiveView game={withVideo} initialTab="video" />);
    const plays = renderToStaticMarkup(<LiveView game={withVideo} initialTab="plays" />);

    expect(video).toContain('<video');
    expect(video).toContain(`Marlins ${withVideo.state?.score.away}, Hawks ${withVideo.state?.score.home}`);
    expect(video).toContain('The stream can run a few seconds behind the score.');
    const onField = withVideo.plays.filter((play) => play.onField);
    expect(onField.length).toBeGreaterThan(0);
    expect(onField.length).toBeLessThan(withVideo.plays.length);
    expect(plays.match(/>Watch</g)).toHaveLength(onField.length);
  });

  it('shows players by number and never by name', () => {
    for (const tab of TABS) {
      const html = render(sampleEvents().filter((event) => event.seq <= 8), 'live', tab.id);
      for (const name of ['Soto', 'Darcy', 'Vance', 'Nguyen', 'Ortiz']) expect(html).not.toContain(name);
    }
  });

  it('tells a family when the game is not public', () => {
    const hidden = liveReducer(initialLiveGame, { type: 'snapshot', snapshot: null });

    expect(renderToStaticMarkup(<LiveView game={hidden} />)).toContain('Game not found or not public.');
  });
});
