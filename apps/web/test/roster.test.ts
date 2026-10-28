import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { OpponentId, PlayerId } from '@sandlot/engine';
import { rosterFor } from '../src/roster.ts';
import { pins } from './helpers.ts';

const SRC = join(import.meta.dirname, '../src');

describe('rosterFor', () => {
  it('names the demo game Marlins at Hawks and its players by jersey number', () => {
    const roster = rosterFor(pins().setup);

    expect(roster.teams).toMatchObject({ away: { name: 'Marlins' }, home: { name: 'Hawks' } });
    expect(roster.number('away-1')).toBe('17');
    expect(roster.label('home-1')).toBe('#15');
  });

  it('calls any other game Away and Home and leaves its players unnumbered in sentences', () => {
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
    expect(roster.label('home-1')).toBe('home-1');
    expect(roster.number('p-2')).toBe('2');
  });

  it('is built from numbers only: the page never imports the phone app or its demo names', () => {
    const files = readdirSync(SRC, { recursive: true, encoding: 'utf8' }).filter((file) => /\.tsx?$/.test(file));
    for (const file of files) expect(readFileSync(join(SRC, file), 'utf8')).not.toMatch(/from '[^']*(apps\/mobile|demo-roster)/);
    expect(readFileSync(join(SRC, 'roster.ts'), 'utf8')).not.toMatch(/name: '[A-Z]\. /);
  });
});
