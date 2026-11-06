import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { OpponentId, PlayerId } from '@sandlot/engine';
import { rosterFor } from '../src/roster.ts';
import { pins } from './helpers.ts';

const SRC = join(import.meta.dirname, '../src');

describe('rosterFor', () => {
  it('names the engine sample game Marlins at Hawks and its players by jersey number', () => {
    const roster = rosterFor(pins().setup);

    expect(roster.teams).toMatchObject({ away: { name: 'Marlins' }, home: { name: 'Hawks' } });
    expect(roster.number('away-1')).toBe('17');
    expect(roster.label('home-1')).toBe('#15');
  });

  it('names the phone’s demo game Hawks at Marlins, with all ten Hawks numbered', () => {
    const hawks = Array.from({ length: 10 }, (_, index) => ({ kind: 'player', id: `home-${index + 1}` as PlayerId }) as const);
    const marlins = Array.from({ length: 9 }, (_, index) => ({ kind: 'opponent', id: `away-${index + 1}` as OpponentId }) as const);
    const roster = rosterFor({ roster: { away: hawks, home: marlins } });

    expect(roster.teams).toMatchObject({ away: { name: 'Hawks', short: 'HAW' }, home: { name: 'Marlins', short: 'MAR' } });
    expect(roster.numbered).toBe(true);
    expect(roster.label('home-10')).toBe('#18');
    expect(roster.number('away-1')).toBe('17');
  });

  it('calls any other game Away and Home and gives its players no number', () => {
    const roster = rosterFor({
      roster: {
        away: [{ kind: 'opponent', id: 'opp-a' as OpponentId }],
        home: [
          { kind: 'player', id: 'home-1' as PlayerId },
          { kind: 'player', id: 'p-2' as PlayerId },
        ],
      },
    });

    expect(roster.teams).toMatchObject({ away: { name: 'Away' }, home: { name: 'Home' } });
    expect(roster.numbered).toBe(false);
    expect(roster.label('home-1')).toBe('home-1');
    expect(roster.number('p-2')).toBe('–');
  });

  it('is built from numbers only: the page never imports the phone app or its demo names', () => {
    const files = readdirSync(SRC, { recursive: true, encoding: 'utf8' }).filter((file) => /\.tsx?$/.test(file));
    for (const file of files) expect(readFileSync(join(SRC, file), 'utf8')).not.toMatch(/from '[^']*(apps\/mobile|demo-roster)/);
    expect(readFileSync(join(SRC, 'roster.ts'), 'utf8')).not.toMatch(/name: '[A-Z]\. /);
  });
});
