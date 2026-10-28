import type { GameShare } from './game-share.ts';

/** The Figma sample game (section 221:13593), for the dev-only picker preview. The app never shares it. */
export const sampleShare: GameShare = {
  team: 'Hawks', number: '6', first: 'Javier', last: 'Ruiz', position: 'SHORTSTOP', date: 'SAT, OCT 24', division: 'Mustang',
  season: 'FALL 2026', stats: [{ label: 'AB', value: 3 }, { label: 'H', value: 2 }, { label: '2B', value: 1 }, { label: 'BB', value: 1 }],
  gameLine: '2 FOR 3 · DOUBLE · WALK', bestPlay: 'Doubled to center in the 3rd.',
};
