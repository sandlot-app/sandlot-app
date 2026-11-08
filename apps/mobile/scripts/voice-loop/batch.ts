// Runs every clip, with and without the start cut off, under each live transcription setting, straight against OpenAI
// with OPENAI_API_KEY, and prints the results as markdown tables for docs/research/voice-noise-and-capture.md (issue #86).
// Progress goes to stderr; the tables go to stdout. Nothing printed holds a transcript, a player name, audio or the key.
//
//   OPENAI_API_KEY=<your key> pnpm --filter @sandlot/mobile voice-batch > results.md
//
// Each run streams a clip in real time, so a full run takes several minutes. The settings take turns on each clip and
// cut, so they all see OpenAI in the same mood.
import { parseArgs } from 'node:util';
import { classify } from './classify.ts';
import { apiKey, fail, whole } from './cli.ts';
import { CLIPS, clipPath, clipsDir, LINEUP, missingClips, type Noise, readPcm } from './clips.ts';
import { directSession, SETTINGS } from './settings.ts';
import { cut, streamClip } from './stream.ts';
import { buildTable, type Run } from './table.ts';

const usage = `Usage: node --experimental-strip-types scripts/voice-loop/batch.ts [options]
  --clips <dir>        where the clips are (default: $SANDLOT_VOICE_CLIPS, then ~/Downloads/sandlot-voice-clips)
  --settings <names>   comma-separated, from: ${SETTINGS.map((setting) => setting.name).join(', ')} (default: all)
  --cuts <ms,ms,...>   audio dropped from the start of each clip (default 0,300,600)
  --repeats <n>        runs of each case, since transcripts vary (default 1)
  --chunk-ms <n>       how much audio to send at a time (default 100)
  --model <name>       the transcription model (default gpt-live-transcribe)`;

let parsed;
try {
  parsed = parseArgs({
    options: {
      clips: { type: 'string' },
      settings: { type: 'string' },
      cuts: { type: 'string', default: '0,300,600' },
      repeats: { type: 'string', default: '1' },
      'chunk-ms': { type: 'string', default: '100' },
      model: { type: 'string', default: 'gpt-live-transcribe' },
    },
  });
} catch (error) {
  fail(`${(error as Error).message}\n\n${usage}`);
}
const { values } = parsed;

const key = apiKey();
const dir = clipsDir(values.clips);
const missing = missingClips(dir);
if (missing.length) fail(`${missing.length} clip files are missing from ${dir}. See README.md for how to regenerate them, or pass --clips.`);

const names = values.settings?.split(',').map((name) => name.trim());
const settings = names ? names.map((name) => SETTINGS.find((setting) => setting.name === name) ?? fail(`Unknown setting "${name}".\n\n${usage}`)) : SETTINGS;
const cuts = values.cuts.split(',').map((text) => whole(text.trim(), '--cuts'));
const repeats = whole(values.repeats, '--repeats', 1);
const chunkMs = whole(values['chunk-ms'], '--chunk-ms', 1);
const noises: Noise[] = ['clean', 'noisy'];

const cases = CLIPS.flatMap((clip) => noises.flatMap((noise) => cuts.flatMap((cutMs) => Array.from({ length: repeats }, () => ({ clip, noise, cutMs })))));
const total = cases.length * settings.length;
const seconds = cases.reduce((sum, each) => sum + readPcm(clipPath(dir, each.clip, each.noise)).length / 48_000 + 2, 0) * settings.length;
console.error(`${total} runs (${settings.length} settings x ${cases.length} cases), about ${Math.ceil(seconds / 60)} minutes.`);

const runs: Run[] = [];
const turnedDown = new Map<string, string>();
let done = 0;
for (const { clip, noise, cutMs } of cases) {
  const pcm = cut(readPcm(clipPath(dir, clip, noise)), cutMs, 0);
  for (const setting of settings) {
    done += 1;
    if (turnedDown.has(setting.name)) continue;
    const session = await directSession(setting, LINEUP, key, values.model);
    let run: Run = { setting: setting.name, noise, cutMs, outcome: 'no-session', finalMs: null };
    if (session.ok) {
      const { transcript, finalMs } = await streamClip(session, pcm, chunkMs);
      run = { ...run, outcome: transcript === null ? 'failed' : classify(clip, transcript), finalMs: transcript === null ? null : finalMs };
    } else if (session.failure === 'auth') {
      fail(`OpenAI authentication failed (${session.why}). Check the key and project access before comparing settings.`);
    } else if (session.failure === 'setting') {
      turnedDown.set(setting.name, session.why);
      console.error(`[${done}/${total}] ${setting.name}: OpenAI turned it down (${session.why}); skipping the rest of its runs`);
      continue;
    }
    runs.push(run);
    console.error(`[${done}/${total}] ${setting.name}, ${noise === 'noisy' ? 'crowd' : 'clean'}, first ${cutMs} ms cut: ${run.outcome}${run.finalMs === null ? '' : `, ${run.finalMs} ms`}`);
  }
}

if (!runs.length) {
  console.error(`No run finished. ${[...turnedDown].map(([name, why]) => `${name}: ${why}`).join('; ')}`);
  process.exit(1);
}
const lines = [
  `Voice noise settings, run on ${new Date().toISOString().slice(0, 10)}: model ${values.model}, ${CLIPS.length} phrases, clean and with crowd noise, first cut ${cuts.join('/')} ms, ${repeats} run${repeats === 1 ? '' : 's'} of each, ${chunkMs} ms chunks.`,
  '',
  '### By setting',
  '',
  buildTable(runs, ['setting']),
  '',
  '### By setting, crowd noise and first cut',
  '',
  buildTable(runs, ['setting', 'noise', 'cut']),
];
if (turnedDown.size) lines.push('', 'Turned down by OpenAI, so not in the tables:', ...[...turnedDown].map(([name, why]) => `- ${name}: ${why}`));
console.log(lines.join('\n'));
