import type { GameShare } from './game-share.ts';

// Dev-only picker previews (`/share?game=<key>`). The app never shares them. `sample` is the Figma sample game
// (section 221:13593). The worst cases are the break-ui row (Figma 236:13863), so the Mac proof can show nothing clips.

const sample: GameShare = {
  team: 'Hawks', number: '6', first: 'Javier', last: 'Ruiz', position: 'SHORTSTOP', date: 'SAT, OCT 24', division: 'Mustang',
  season: 'FALL 2026', stats: [{ label: 'AB', value: 3 }, { label: 'H', value: 2 }, { label: '2B', value: 1 }, { label: 'BB', value: 1 }],
  gameLine: '2 FOR 3 · DOUBLE · WALK', bestPlay: 'Doubled to center in the 3rd.',
};

export const sampleShares: Record<string, GameShare> = {
  sample,
  /** A long hyphenated name, a two-digit number, a long team name, all walks and the longest best play. */
  'worst-long': {
    ...sample, team: 'Lamorinda Thunderbolts', number: '88', first: 'Christopher', last: 'Oberhauser-Wettstein', position: 'CENTER FIELD',
    stats: [{ label: 'AB', value: 0 }, { label: 'H', value: 0 }, { label: 'BB', value: 3 }], gameLine: '3 WALKS',
    bestPlay: 'Hit a ground-rule double in the 12th.',
  },
  /** Stacked accents, number 0, 0 for 3 and no best play. */
  'worst-accent': {
    ...sample, number: '0', first: 'Đặng', last: 'Nguyễn', position: 'CATCHER',
    stats: [{ label: 'AB', value: 3 }, { label: 'H', value: 0 }], gameLine: '0 FOR 3', bestPlay: null,
  },
};
