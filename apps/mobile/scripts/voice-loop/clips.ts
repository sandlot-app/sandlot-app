import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, join } from 'node:path';
import type { Expected } from './classify.ts';

// The recorded test clips (see README.md). Audio stays out of git, so these are only the words each clip says.

/** Made-up names, sent as the lineup the way the phone sends one. */
export const LINEUP = ['T. Nguyen', 'M. Ortiz', 'D. Park', 'S. Bell', 'A. Kindle', 'J. Ruiz', 'R. Hale', 'K. Moss', 'E. Brooks',
  'J. Soto', 'L. Darcy', 'C. Vance', 'N. Cole', 'P. Shah', 'R. Diaz', 'G. Ford', 'H. Lin', 'M. Webb'];

export type Clip = Expected & { id: string };

/** One file per clip and noise: `<id>.clean.pcm` and `<id>.noisy.pcm`, 16-bit mono PCM at 24 kHz. */
export const CLIPS: Clip[] = [
  { id: 'ball', phrase: 'Ball.', names: [] },
  { id: 'nguyen-walks', phrase: 'Nguyen walks.', names: ['Nguyen'] },
  { id: 'darcy-singles', phrase: 'Darcy singles, Soto to third.', names: ['Darcy', 'Soto'] },
  { id: 'soto-hits-ruiz', phrase: 'Soto hits Ruiz, Ruiz takes first.', names: ['Soto', 'Ruiz'] },
];

export type Noise = 'clean' | 'noisy';

/** The flag, then SANDLOT_VOICE_CLIPS, then a folder outside the repo. */
export const clipsDir = (flag?: string) => flag ?? process.env.SANDLOT_VOICE_CLIPS ?? join(homedir(), 'Downloads', 'sandlot-voice-clips');

export const clipPath = (dir: string, clip: Clip, noise: Noise) => join(dir, `${clip.id}.${noise}.pcm`);

/** The clip a file name stands for, such as `audio/nguyen-walks.noisy.pcm`. */
export function findClip(path: string): { clip: Clip; noise: Noise } | null {
  const match = /^(.+)\.(clean|noisy)\.pcm$/.exec(basename(path));
  const clip = CLIPS.find((each) => each.id === match?.[1]);
  return clip ? { clip, noise: match![2] as Noise } : null;
}

/** The names of the clip files missing from `dir`. */
export const missingClips = (dir: string) =>
  CLIPS.flatMap((clip) => (['clean', 'noisy'] as Noise[]).map((noise) => clipPath(dir, clip, noise))).filter((path) => !existsSync(path));

export const readPcm = (path: string) => new Uint8Array(readFileSync(path));
