// PROTOTYPE, THROWAWAY. Not production code; lives on branch prototype/ai-first-voice and never goes to main.
//
// THE QUESTION
//   Does an AI-first reader, which sees the whole game state and returns the whole play's result, understand natural,
//   flowing parent speech far better than today's pipeline (the phone's phrase patterns first, then a timid AI parser)?
//
// HOW IT ANSWERS
//   cases.jsonl holds made-up parent sentences, each with a starting game and the expected END STATE (runs, runners,
//   outs, count). Every case is run through two readers and the end states are compared, never command lists:
//     A. today's pipeline: parsePhrase, then voice-parse's AI parser when that is unclear, then route() and the engine.
//     B. AI-first: one call with the whole game as text, answering by role and base; mapped to Commands; engine decides.
//
// RUN (from the repo root)
//   read -rs "OPENAI_API_KEY?OpenAI key: " && export OPENAI_API_KEY
//   pnpm --filter @sandlot/voice ai-first
//   No key needed:  ... ai-first --check   (cases against the engine only)     ... ai-first --fake   (scripted OpenAI)
//   Other switches: --only=<case id>, AI_FIRST_MODEL, VOICE_PARSER_MODEL, AI_FIRST_CONCURRENCY, PRICE_IN, PRICE_OUT.

import { checkCase, loadCases, prepare } from './cases.ts';
import { fakeOpenAi } from './fake.ts';
import { baseUrl, dollars, metered, price, realOpenAi, type OpenAi } from './openai.ts';
import { readerA } from './reader-a.ts';
import { answerSchema, readerB, type Read } from './reader-b.ts';
import { sameEnd, showEnd, showExpect, type End } from './game.ts';
import type { Outcome, Prepared } from './types.ts';
import { parserSchema } from '../src/index.ts';

const args = process.argv.slice(2);
const checkOnly = args.includes('--check');
const fake = args.includes('--fake') || process.env.AI_FIRST_FAKE === '1';
const only = args.find((arg) => arg.startsWith('--only='))?.slice('--only='.length);

// The key is checked before anything else, so a missing key never costs a call. It is never printed.
const key = process.env.OPENAI_API_KEY;
if (!checkOnly && !fake && !key) {
  console.error('OPENAI_API_KEY is not set. Nothing was called.\nEnter it for this shell with:\n  read -rs "OPENAI_API_KEY?OpenAI key: " && export OPENAI_API_KEY');
  process.exit(2);
}

/** Strict Structured Outputs wants every object closed and every property required. Catches a schema slip with no call. */
function lintStrict(schema: any, path = '$'): string[] {
  if (!schema || typeof schema !== 'object') return [];
  const problems: string[] = [];
  if (schema.type === 'object') {
    const keys = Object.keys(schema.properties ?? {});
    const required: string[] = schema.required ?? [];
    if (schema.additionalProperties !== false) problems.push(`${path}: additionalProperties must be false`);
    if (keys.length !== required.length || keys.some((name) => !required.includes(name))) problems.push(`${path}: every property must be required`);
    for (const [name, child] of Object.entries(schema.properties ?? {})) problems.push(...lintStrict(child, `${path}.${name}`));
  }
  if (schema.items) problems.push(...lintStrict(schema.items, `${path}[]`));
  for (const [index, child] of (schema.anyOf ?? []).entries()) problems.push(...lintStrict(child, `${path}|${index}`));
  return problems;
}

// ---------------------------------------------------------------- load and check the cases (no network)

const all = loadCases();
const cases = only ? all.filter((c) => c.id === only) : all;
if (!cases.length) { console.error(`No case named ${only}.`); process.exit(1); }
const problems: string[] = [];
if (new Set(all.map((c) => c.id)).size !== all.length) problems.push('case ids are not unique');
if (all.length < 40) problems.push(`only ${all.length} cases, need at least 40`);
problems.push(...lintStrict(answerSchema, 'answerSchema'), ...lintStrict(parserSchema, 'parserSchema'));
const prepared: Prepared[] = [];
for (const c of cases) {
  try {
    const p = prepare(c);
    const bad = checkCase(p);
    if (bad) problems.push(`${c.id}: ${bad}`);
    prepared.push(p);
  } catch (thrown) {
    problems.push(`${c.id}: ${thrown instanceof Error ? thrown.message : 'did not build'}`);
  }
}
if (problems.length) {
  console.error(`The case set has ${problems.length} problem(s). Nothing was called.\n- ${problems.join('\n- ')}`);
  process.exit(1);
}
const kindCounts = [...new Set(all.map((c) => c.kind))].map((kind) => `${kind} ${all.filter((c) => c.kind === kind).length}`).join(', ');
if (checkOnly) {
  console.log(`OK: ${all.length} cases, every ideal answer lands on its expected end state through the engine, both schemas pass the strict-mode lint.\nBy kind: ${kindCounts}.`);
  process.exit(0);
}

// ---------------------------------------------------------------- run both readers on every case

const parserModel = process.env.VOICE_PARSER_MODEL ?? 'gpt-6-luna'; // voice-parse's default (supabase/functions/voice-parse/index.ts)
const aiFirstModel = process.env.AI_FIRST_MODEL ?? parserModel;
const concurrency = Math.max(1, Number(process.env.AI_FIRST_CONCURRENCY ?? 4));
const base: OpenAi = fake ? fakeOpenAi(all) : realOpenAi(key!);

type Row = { c: Prepared; a: Outcome; b: Outcome };

async function run(reader: 'A' | 'B', c: Prepared): Promise<Outcome> {
  const { openai, meter } = metered(base);
  const start = performance.now();
  let read: Read;
  try {
    read = reader === 'A' ? await readerA(c, openai, parserModel) : await readerB(c, openai, aiFirstModel);
  } catch (thrown) {
    read = { did: 'failed', note: `crashed: ${thrown instanceof Error ? thrown.name : 'error'}` };
  }
  const first = meter.errors[0];
  if (read.did === 'failed' && first && !first.startsWith(read.note) && !read.note.includes(first)) read.note += ` (${first})`;
  return { ...read, ms: performance.now() - start, calls: meter.calls, inTokens: meter.inTokens, cachedTokens: meter.cachedTokens, outTokens: meter.outTokens };
}

const rows: Row[] = [];
const both = async (c: Prepared): Promise<Row> => ({ c, a: await run('A', c), b: await run('B', c) });

console.log(`# Prototype: AI-first voice reader vs today's pipeline${fake ? '  [FAKE OpenAI: scripted answers, the numbers say nothing about real models]' : ''}\n`);
console.log(`${prepared.length} cases (${kindCounts}). Reader A model: ${parserModel}. Reader B model: ${aiFirstModel}. Concurrency ${concurrency}.`);
console.log(`Price used: $${price.in.toFixed(2)} / 1M input, $${price.out.toFixed(2)} / 1M output, $${price.cached.toFixed(3)} / 1M cached input (${price.model}; ${price.source}).`);
if (!fake && baseUrl !== 'https://api.openai.com') console.log(`NOTE: calls go to ${new URL(baseUrl).host}, not OpenAI (AI_FIRST_BASE_URL is set).`);
if (!fake && aiFirstModel !== 'gpt-6-luna') console.log(`WARNING: the price above is gpt-6-luna's, not ${aiFirstModel}'s. Set PRICE_IN and PRICE_OUT.`);
console.log('');

// The first case goes alone: if every call failed (bad key, wrong model name) we stop before spending on the rest.
rows[0] = await both(prepared[0]!);
if (!fake && [rows[0].a, rows[0].b].every((o) => o.did === 'failed')) {
  console.error(`The first case failed for both readers, so the run stopped.\nReader A: ${rows[0].a.note}\nReader B: ${rows[0].b.note}`);
  process.exit(1);
}
let finished = 1;
let next = 1;
await Promise.all(Array.from({ length: concurrency }, async () => {
  while (next < prepared.length) {
    const index = next++;
    rows[index] = await both(prepared[index]!);
    finished += 1;
    if (process.stderr.isTTY) process.stderr.write(`\r  ${finished} of ${prepared.length} cases done`);
  }
}));
if (process.stderr.isTTY) process.stderr.write('\n');

// ---------------------------------------------------------------- score

type Verdict = 'right' | 'wrong_save' | 'held_back' | 'rejected_failed' | 'other_miss';

function verdict(c: Prepared, o: Outcome): Verdict {
  if (o.did === 'rejected' || o.did === 'failed') return 'rejected_failed';
  const { expect } = c;
  if (o.did === 'saved') return expect.do === 'save' && o.end && sameEnd(o.end, expect) ? 'right' : 'wrong_save';
  if (expect.do === 'save') return 'held_back';
  if (expect.do === 'no_play') return o.did === 'no_play' ? 'right' : 'other_miss';
  return o.did === 'asked' ? 'right' : 'other_miss';
}

const verdicts = rows.map(({ c, a, b }) => ({ a: verdict(c, a), b: verdict(c, b) }));
const count = (reader: 'a' | 'b', wanted: Verdict) => verdicts.filter((v) => v[reader] === wanted).length;
const outcomes = (reader: 'a' | 'b') => rows.map((row) => row[reader]);
const pct = (n: number) => `${n} of ${rows.length} (${Math.round((n / rows.length) * 100)}%)`;
const seconds = (ms: number) => ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(1)} s`;
const median = (list: number[]) => { const s = [...list].sort((x, y) => x - y); return s.length % 2 ? s[(s.length - 1) / 2]! : (s[s.length / 2 - 1]! + s[s.length / 2]!) / 2; };
const money = (x: number) => `$${x.toFixed(5)}`;

function cost(reader: 'a' | 'b'): string {
  const list = outcomes(reader);
  const total = list.reduce((sum, o) => sum + dollars(o), 0);
  const called = list.filter((o) => o.calls > 0).length;
  const per = `${money(total / list.length)} per press`;
  return reader === 'a' && called ? `${per} (${money(total / called)} per AI-called press; ${called} of ${list.length} needed AI)` : per;
}

const cardRight = (reader: 'a' | 'b') => rows.filter((row, i) => verdicts[i]![reader] === 'held_back' && row[reader].cardRight).length;
const line = (label: string, a: string, b: string) => `| ${label} | ${a} | ${b} |`;
const table = (title: string, head: string[], body: string[]) => console.log(`## ${title}\n\n| ${head.join(' | ')} |\n|${head.map(() => '---').join('|')}|\n${body.join('\n')}\n`);

table('Headline', ['', "A. Today's pipeline", 'B. AI-first'], [
  line('Cases right (end state matches)', pct(count('a', 'right')), pct(count('b', 'right'))),
  line('**Wrong saves** (it saved and the end state is wrong)', pct(count('a', 'wrong_save')), pct(count('b', 'wrong_save'))),
  line('Held back: asked, carded or said "not a play" when a save was right', pct(count('a', 'held_back')), pct(count('b', 'held_back'))),
  line('...of those, the card or question offered the right reading', `${cardRight('a')}`, 'n/a'),
  line('Rejected by the engine or failed', pct(count('a', 'rejected_failed')), pct(count('b', 'rejected_failed'))),
  line('Other misses (expected "not a play" or "ask", got the other)', pct(count('a', 'other_miss')), pct(count('b', 'other_miss'))),
  line('AI calls made', `${outcomes('a').reduce((n, o) => n + o.calls, 0)}`, `${outcomes('b').reduce((n, o) => n + o.calls, 0)}`),
  line('Median time per press', seconds(median(outcomes('a').map((o) => o.ms))), seconds(median(outcomes('b').map((o) => o.ms)))),
  line('Slowest press', seconds(Math.max(...outcomes('a').map((o) => o.ms))), seconds(Math.max(...outcomes('b').map((o) => o.ms)))),
  line("Presses over 10 s (voice-parse's own timeout)", `${outcomes('a').filter((o) => o.ms > 10_000).length}`, `${outcomes('b').filter((o) => o.ms > 10_000).length}`),
  line('Estimated cost', cost('a'), cost('b')),
]);

const kinds = [...new Set(rows.map((row) => row.c.kind))];
table('By kind of speech', ['Kind', 'Cases', 'A right', 'B right'], kinds.map((kind) => {
  const of = rows.map((row, i) => ({ row, v: verdicts[i]! })).filter(({ row }) => row.c.kind === kind);
  const cell = (reader: 'a' | 'b') => {
    const right = of.filter(({ v }) => v[reader] === 'right').length;
    const wrong = of.filter(({ v }) => v[reader] === 'wrong_save').length;
    return `${right} of ${of.length}${wrong ? `, ${wrong} wrong save${wrong > 1 ? 's' : ''}` : ''}`;
  };
  return `| ${kind} | ${of.length} | ${cell('a')} | ${cell('b')} |`;
}));

const short = (text: string, max = 78) => (text.length > max ? `${text.slice(0, max - 3)}...` : text).replace(/\|/g, '/');
const what = (c: Prepared, o: Outcome, v: Verdict) => {
  const end: End | undefined = o.end;
  const mark = v === 'right' ? 'RIGHT' : v === 'wrong_save' ? 'WRONG SAVE' : v === 'held_back' ? 'held back' : v === 'rejected_failed' ? o.did : 'miss';
  const detail = o.did === 'saved' && v === 'wrong_save' && end ? `${short(o.note, 40)}; ended [${showEnd(end)}]` : short(o.note, 60);
  return `${mark}: ${detail}${o.cardRight ? ' (right reading on the card)' : ''}`;
};
const differing = rows.map((row, i) => ({ row, v: verdicts[i]! })).filter(({ row, v }) =>
  v.a !== v.b || (row.a.end && row.b.end && showEnd(row.a.end) !== showEnd(row.b.end)));
console.log(`## Where the two readers differ (${differing.length} of ${rows.length} cases)\n`);
if (differing.length) {
  console.log('| Case | Kind | Transcript (made-up sample) | Expected | A | B |\n|---|---|---|---|---|---|');
  for (const { row, v } of differing) {
    console.log(`| ${row.c.id} | ${row.c.kind} | ${short(row.c.transcript, 90)} | ${showExpect(row.c.expect)} | ${what(row.c, row.a, v.a)} | ${what(row.c, row.b, v.b)} |`);
  }
}

const failures = (reader: 'a' | 'b') => {
  const reasons = new Map<string, number>();
  for (const o of outcomes(reader)) if (o.did === 'failed') reasons.set(o.note, (reasons.get(o.note) ?? 0) + 1);
  return [...reasons].map(([reason, n]) => `${reason} x${n}`).join('; ');
};
const failed = [['A', failures('a')], ['B', failures('b')]].filter(([, text]) => text);
if (failed.length) console.log(`\nFailures: ${failed.map(([reader, text]) => `${reader}: ${text}`).join(' | ')}`);
const spent = rows.reduce((sum, row) => sum + dollars(row.a) + dollars(row.b), 0);
console.log(`\nThis run cost an estimated ${money(spent)} in total${fake ? ' (invented token counts)' : ''}.`);
