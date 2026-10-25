import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { initialLiveGame, liveReducer } from '../src/live.ts';
import { LiveView } from '../src/LiveView.tsx';
import { sampleEvents, snapshot } from './helpers.ts';

const render = (events: ReturnType<typeof sampleEvents>, status: 'live' | 'reconnecting' = 'live') => {
  const loaded = liveReducer(initialLiveGame, { type: 'snapshot', snapshot: snapshot(events) });
  return renderToStaticMarkup(<LiveView game={liveReducer(loaded, { type: 'connection', status })} />);
};

describe('LiveView', () => {
  it('shows the inning, the runner on second and the newest play first', () => {
    const html = render(sampleEvents().filter((event) => event.seq <= 8));

    expect(html).toContain('Top 1');
    expect(html).toContain('Runners on 2nd');
    expect(html).toContain('Live');
    expect(html.indexOf('away-1 steals 2nd')).toBeLessThan(html.indexOf('away-1 singles to left (LF)'));
  });

  it('shows the reconnecting indicator', () => {
    expect(render(sampleEvents(), 'reconnecting')).toContain('Reconnecting');
  });

  it('tells a family when the game is not public', () => {
    const hidden = liveReducer(initialLiveGame, { type: 'snapshot', snapshot: null });

    expect(renderToStaticMarkup(<LiveView game={hidden} />)).toContain('Game not found or not public.');
  });
});
