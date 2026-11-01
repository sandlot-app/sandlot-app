import { describe, expect, it } from 'vitest';
import { readAnswer } from '../src/answer.ts';
import { decide, type Decision } from '../src/decide.ts';
import { batting, stateAfter, type PressGame, type RosterEntry } from '../src/state.ts';
import { buildGame, stateOf, withLastPlay } from './game.ts';
import { expandShort, type Short } from './short.ts';

// Holes the adversarial review found in #103, kept as regression tests. Each answer is one the strict schema allows,
// and each test states what the intent requires: a name in the wrong role never saves as another player, and nothing
// the words didn't say saves without showing on the banner.

function run(game: PressGame, transcript: string, short: Short) {
  const answer = readAnswer(expandShort(short));
  if (!answer) throw new Error('answer does not read');
  const decision = decide({ game, transcript, at: 10_000 }, { kind: 'answer', answer });
  return { decision, summary: summarize(game, decision) };
}

function summarize(game: PressGame, decision: Decision) {
  if (decision.kind !== 'save') return decision;
  const before = stateOf(game);
  const after = stateAfter(game, decision.reading.commands)!;
  return {
    kind: 'save',
    banner: decision.reading.banner,
    runs: after.score[batting(before)] - before.score[batting(before)],
    advances: decision.reading.commands.flatMap((c) => c.kind === 'ball_in_play' ? c.advances.map((a) => `${a.runner.id}->${a.to}${'outType' in a && a.outType ? `(${a.outType})` : ''}`) : []),
    bases: Object.fromEntries(([1, 2, 3] as const).flatMap((b) => after.bases[b] ? [[b, game.roster.find((e) => e.player.id === after.bases[b]!.player.id)?.name]] : [])),
    outs: after.outs, half: after.half,
  };
}

const rename = (game: PressGame, from: string, to: string): PressGame =>
  ({ ...game, roster: game.roster.map((entry: RosterEntry) => entry.name === from ? { ...entry, name: to } : entry) });


describe('A. name-dropped answers save as the batter', () => {
  it('A1 spec test (b): "Parker" said, Soto up, no Parker on the batting team, model leaves batter name null', () => {
    const game = buildGame({ outs: 0, on: { '1': 'L. Darcy' }, up: 'J. Soto' });
    const { decision } = run(game, 'Parker hits a double and runner scores', { bip: { o: 'double', b: '2', r: ['1>home'] } });
    expect(decision.kind).toBe('message');
  });

  it('A2 a fielding-team player named as the batter, model leaves batter name null', () => {
    const game = buildGame({ outs: 0, up: 'J. Soto' });
    const { decision } = run(game, 'Park doubles to left', { bip: { o: 'double', f: ['LF'], b: '2' } });
    expect(decision.kind).toBe('message');
  });

  it('A3 a two-letter surname on the batting team is never checked', () => {
    const game = rename(buildGame({ outs: 0, up: 'J. Soto' }), 'H. Lin', 'H. Li');
    const { decision } = run(game, 'Li doubles', { bip: { o: 'double', b: '2' } });
    expect(decision.kind).toBe('message');
  });

  it('A4 a first name the policy accepts ("Danny" for "Danny Park") is never checked by the second witness', () => {
    let game = buildGame({ outs: 0, up: 'J. Soto' });
    game = rename(rename(game, 'J. Soto', 'Jose Soto'), 'L. Darcy', 'Danny Darcy');
    const { decision } = run(game, 'Danny doubles', { bip: { o: 'double', b: '2' } });
    expect(decision.kind).toBe('message');
  });
});

describe('B. second witness satisfied by a slot with no effect', () => {
  it('B1 "Soto doubles" with Soto on first and Darcy up: Soto reported only in forced_runners on a ball in play', () => {
    const game = buildGame({ outs: 0, on: { '1': 'J. Soto' }, up: 'L. Darcy' });
    const { decision } = run(game, 'Soto doubles', { bip: { o: 'double', b: '2', r: ['1>home'] }, fr: ['1:Soto'] });
    // A forced runner only means something after ball four or a hit by pitch, so this answer is unusable.
    expect(decision).toEqual({ kind: 'message', message: "Couldn't read that. Tap to score." });
  });
});

describe('C. name policy: a full first name is compared by its first letter only', () => {
  it('C1 twins Danny Park (up) and Dave Park (on first): "Dave Park doubles" with batter "Dave Park" saves as Danny', () => {
    let game = buildGame({ outs: 0, on: { '1': 'L. Darcy' }, up: 'J. Soto' });
    game = rename(rename(game, 'J. Soto', 'Danny Park'), 'L. Darcy', 'Dave Park');
    const { decision } = run(game, 'Dave Park doubles', { batter: 'Dave Park', bip: { o: 'double', b: '2', r: ['1>3'] } });
    expect(decision).toMatchObject({ kind: 'message', message: 'Danny Park is up, not Dave Park.' });
  });
});

describe('D. force classification', () => {
  it('D1 two outs, 1st and 3rd, line drive short-hopped, force at second for the third out: run must not count', () => {
    const game = buildGame({ outs: 2, on: { '1': 'L. Darcy', '3': 'C. Vance' }, up: 'N. Cole' });
    const { summary } = run(game, 'Line drive, short knocks it down and throws to second for the force, inning over',
      { bip: { o: 'fielders_choice', t: 'line', f: ['SS', '2B'], b: '1', r: ['3>home', '1>out'] } });
    expect(summary).toMatchObject({ kind: 'save', runs: 0 });
  });

  it('D1-control same play with trajectory ground', () => {
    const game = buildGame({ outs: 2, on: { '1': 'L. Darcy', '3': 'C. Vance' }, up: 'N. Cole' });
    const { summary } = run(game, 'Ground ball to short, throws to second for the force, inning over',
      { bip: { o: 'fielders_choice', t: 'ground', f: ['SS', '2B'], b: '1', r: ['3>home', '1>out'] } });
    expect(summary).toMatchObject({ kind: 'save', runs: 0 });
  });

  it('D2 one out, 1st and 3rd, 3-6 double play (batter out first, runner tagged), run scored before the tag', () => {
    const game = buildGame({ outs: 1, on: { '1': 'L. Darcy', '3': 'C. Vance' }, up: 'N. Cole' });
    const { summary } = run(game, 'Grounder to first, he steps on the bag then throws to second and they tag Darcy, Vance scored before the tag',
      { bip: { o: 'double_play', t: 'ground', f: ['1B', 'SS'], b: 'out', r: ['3>home:Vance', '1>out:Darcy'], first: true } });
    expect(summary).toMatchObject({ kind: 'save', runs: 1 });
  });
});

describe('E. passing check ignores the batter', () => {
  it('E1 triple with the runner from first stopping at second saves (batter passed the runner)', () => {
    const game = buildGame({ outs: 0, on: { '1': 'L. Darcy' }, up: 'J. Soto' });
    const { decision } = run(game, 'Soto triples, Darcy only gets to second', { batter: 'Soto', bip: { o: 'triple', b: '3', r: ['1>2:Darcy'] } });
    expect(decision).toEqual({ kind: 'message', message: "A runner can't pass the runner ahead of them." });
  });

  it('E2 double with the runner from second going back to first saves', () => {
    const game = buildGame({ outs: 0, on: { '2': 'C. Vance' }, up: 'N. Cole' });
    const { decision } = run(game, 'Cole doubles, Vance goes back to first', { batter: 'Cole', bip: { o: 'double', b: '2', r: ['2>1:Vance'] } });
    expect(decision.kind).toBe('message');
  });
});

describe('F. a fix the model did not flag', () => {
  it('F1 "No, that was a double." with fix_last false saves a new play for the next batter', () => {
    const base = buildGame({ outs: 0, up: 'C. Vance', next: ['N. Cole'] });
    // the eval file's fix case, but with fix_last false
    const game = withLastPlay(base, { batter: 'Vance', bip: { o: 'single', f: ['LF'], b: '1' } });
    const { decision } = run(game, 'No, that was a double.', { bip: { o: 'double', f: ['LF'], b: '2' } });
    expect(decision.kind).toBe('message');
  });
});

describe('C2. hyphenated surname read as first name + surname', () => {
  it('C2 G. Lopez up, A. Garcia-Lopez on first: "Garcia-Lopez doubles", batter "Garcia-Lopez" saves as G. Lopez', () => {
    let game = buildGame({ outs: 0, on: { '1': 'L. Darcy' }, up: 'J. Soto' });
    game = rename(rename(game, 'J. Soto', 'G. Lopez'), 'L. Darcy', 'A. Garcia-Lopez');
    const { decision } = run(game, 'Garcia-Lopez doubles', { batter: 'Garcia-Lopez', bip: { o: 'double', b: '2', r: ['1>3'] } });
    expect(decision).toMatchObject({ kind: 'message', message: 'G. Lopez is up, not A. Garcia-Lopez.' });
  });
});

describe('G. real surnames the policy can never match (false refusals)', () => {
  it.each([
    ["K. O'Brien", "O'Brien"],
    ['A. Garcia-Lopez', 'Garcia-Lopez'],
    ['J. Soto Jr.', 'Soto'],
    ["R. D'Souza", "D'Souza"],
  ])('G1 batter %s named "%s" by the scorer and reported exactly as heard', (rosterName, heardName) => {
    const game = rename(buildGame({ outs: 0, up: 'J. Soto' }), 'J. Soto', rosterName);
    const { decision } = run(game, `${heardName} doubles`, { batter: heardName, bip: { o: 'double', b: '2' } });
    expect(decision.kind).toBe('save');
  });

  it('G2 a batting player named Wall: "Soto hits it off the wall for a double" is refused', () => {
    const game = rename(buildGame({ outs: 0, up: 'J. Soto' }), 'M. Webb', 'M. Wall');
    const { decision } = run(game, 'Soto hits it off the wall for a double', { batter: 'Soto', bip: { o: 'double', b: '2' } });
    expect(decision.kind).toBe('save');
  });
});

describe('A5. surname in the scoring-word list', () => {
  it('A5 batting player "B. Short" said, Soto up, model leaves the batter null', () => {
    const game = rename(buildGame({ outs: 0, up: 'J. Soto' }), 'M. Webb', 'B. Short');
    const { decision } = run(game, 'Short doubles', { bip: { o: 'double', b: '2' } });
    expect(decision.kind).toBe('message');
  });
});

describe('the second adversarial review', () => {
  it('a home run that leaves runners on base is refused, not saved as "homers"', () => {
    const game = buildGame({ outs: 0, on: { '1': 'N. Cole', '2': 'P. Shah', '3': 'R. Diaz' }, up: 'L. Darcy' });
    expect(run(game, 'Grand slam!', { bip: { o: 'home_run', b: 'home' } }).decision).toEqual({ kind: 'message', message: "A runner can't pass the runner ahead of them." });
  });

  const impossible: [string, Short][] = [
    ['a runner sent back a base', { bip: { o: 'single', b: '1', r: ['3>2'] } }],
    ['an out with the batter safe on third', { bip: { o: 'out', t: 'fly', f: ['CF'], b: '3' } }],
  ];
  it.each(impossible)('%s saves nothing', (_, short) => {
    const game = buildGame({ outs: 0, on: { '3': 'R. Diaz' }, up: 'L. Darcy' });
    expect(run(game, 'base hit', short).decision.kind).toBe('message');
  });

  it('a question whose one reading names the wrong batter saves nothing, rather than the other reading', () => {
    const game = buildGame({ outs: 0, on: { '1': 'L. Darcy' }, up: 'J. Soto' });
    const decision = run(game, 'Moss doubles', { result: 'question', readings: [{ batter: 'Moss', bip: { o: 'double', b: '2', r: ['1>home:Darcy'] } }, { bip: { o: 'double', b: '2', r: ['1>3'] } }] }).decision;
    expect(decision.kind).toBe('message');
  });
});
