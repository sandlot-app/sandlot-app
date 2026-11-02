// The live AI run on the voice test set, for a Mac with an OpenAI key. It never runs in CI.
//
//   OPENAI_API_KEY=... node --experimental-strip-types scripts/live-answers.ts [--model gpt-6-luna] [--write] [file.jsonl ...]
//
// For each press the phone can't read alone, it sends the same request voice-parse sends, reads the reply with the
// same strict reader (the model's notes go no further), and runs decide() and the engine on it. It prints each case
// that doesn't do what the test set expects, and the time each answer took. With --write it stores each answer in the
// case's `recorded` field, so the tests replay what the model really said. The answers hold the names the scorer said,
// which are the sample roster's names, never a real child's.

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { pressContext } from '../src/context.ts';
import { decide } from '../src/decide.ts';
import { readLocally } from '../src/local.ts';
import { modelRequest, readModelReply } from '../src/model.ts';
import { buildGame, withLastPlay } from '../test/game.ts';
import type { Case } from '../test/evals.test.ts';

const args = process.argv.slice(2);
const key = process.env.OPENAI_API_KEY;
if (!key) throw new Error('Set OPENAI_API_KEY');
const model = args.includes('--model') ? args[args.indexOf('--model') + 1]! : 'gpt-6-luna';
const write = args.includes('--write');
const folder = new URL('../evals/', import.meta.url);
const files = args.filter((arg) => arg.endsWith('.jsonl'));
const chosen = files.length ? files : readdirSync(folder).filter((file) => file.endsWith('.jsonl'));

let right = 0;
let asked = 0;
for (const file of chosen) {
  const cases = readFileSync(new URL(file, folder), 'utf8').split('\n').filter((line) => line.trim()).map((line) => JSON.parse(line) as Case);
  for (const c of cases) {
    if (readLocally(c.transcript)) continue;
    const start = buildGame(c.sit);
    const game = c.last ? withLastPlay(start, c.last) : start;
    const began = Date.now();
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify(modelRequest(model, c.transcript, pressContext(game))),
    });
    const answer = response.ok ? readModelReply(await response.json()) : null;
    const ms = Date.now() - began;
    const decision = decide({ game, transcript: c.transcript, at: 10_000 }, answer ? { kind: 'answer', answer } : { kind: 'unusable' });
    const shown = decision.kind === 'save' ? decision.reading.banner : decision.kind === 'choose' ? decision.readings.map((reading) => reading.banner).join(' | ')
      : decision.kind === 'message' ? decision.message : 'undo';
    const expected = c.expect.do === 'save' ? c.expect.banner : c.expect.do === 'choose' ? c.expect.banners.join(' | ')
      : c.expect.do === 'message' ? c.expect.message : 'undo';
    asked += 1;
    if (decision.kind === c.expect.do && shown === expected) right += 1;
    else console.log(`${file} ${c.id} (${ms} ms)\n  expected: ${expected}\n  got:      ${shown}${response.ok ? '' : ` (HTTP ${response.status})`}`);
    if (write && answer) c.recorded = answer;
  }
  if (write) writeFileSync(new URL(file, folder), cases.map((c) => JSON.stringify(c)).join('\n') + '\n');
}
console.log(`${right} of ${asked} presses read the AI did as the test set expects.`);
