import { describe, expect, it } from 'vitest';
import { replay } from '@sandlot/engine';
import type { Command, Event } from '@sandlot/engine';
import { classify } from '../src/classify.ts';
import { gameWith, player, said } from './game.ts';

const after = (game: ReturnType<typeof gameWith>, commands: Command[]) => {
  const before = replay(game.setup, game.events);
  const next = replay(game.setup, [...game.events, ...commands.map((command, index) => ({
    ...game.events[0]!, id: `next-${index}`, seq: game.events.length + index + 1, group: 'next', command,
  }) as Event)]);
  if (!before.ok || !next.ok) throw new Error('test play must be legal');
  return classify(before.state, next.state, commands);
};

const ball: Command = { kind: 'pitch', result: 'ball' };
const swing: Command = { kind: 'pitch', result: 'swinging_strike' };
const single: Command[] = [{ kind: 'pitch', result: 'in_play' }, { kind: 'ball_in_play', outcome: 'single', trajectory: null, fielders: ['LF'], advances: [] }];

// The examples table in the spec's section 3, "What counts as simple".
describe('simple or complex', () => {
  it('"Ball" and "ball, ball, strike" move nobody, so they\'re simple', () => {
    expect(after(gameWith([]), [ball])).toBe('simple');
    expect(after(gameWith([]), [ball, ball, swing])).toBe('simple');
  });

  it('a steal with one runner on is simple', () => {
    const game = said(['Soto singles']);
    expect(after(game, [{ kind: 'runner', event: 'stolen_base', runner: player('J. Soto'), to: 2 }])).toBe('simple');
  });

  it('a single with the bases empty is simple', () => {
    expect(after(gameWith([]), single)).toBe('simple');
  });

  it('a strikeout for the first out is simple, and for the third out is complex', () => {
    expect(after(said(['strike looking', 'strike looking']), [swing])).toBe('simple');
    expect(after(said(['Soto flies out', 'Darcy flies out', 'strike looking', 'strike looking']), [swing])).toBe('complex');
  });

  it('a walk with a runner on first moves two players, so it\'s complex', () => {
    expect(after(said(['Soto singles', 'ball', 'ball', 'ball']), [ball])).toBe('complex');
  });

  it('a hit with a runner forced along is complex', () => {
    expect(after(said(['Soto singles']), [single[0]!, { ...single[1]!, advances: [{ runner: player('J. Soto'), to: 2 }] } as Command])).toBe('complex');
  });

  it('an error is always complex', () => {
    expect(after(gameWith([]), [single[0]!, { kind: 'ball_in_play', outcome: 'error', trajectory: null, fielders: ['SS'], advances: [] }])).toBe('complex');
  });
});
