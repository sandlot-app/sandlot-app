import { describe, expect, it } from 'vitest';
import { gameWith, press, roster, said } from './game.ts';

const readBacks = (decision: ReturnType<typeof press>) => decision.kind === 'ask' ? decision.options.map((option) => option.readBack) : [];

// Findings from Grokbot's review of PR #58 at 34b24e4.
describe('review round 1', () => {
  it('H1/C3: a hit with an unforced runner on says the runner held, and asks first', () => {
    expect(press(said(['Soto triples']), 'Darcy singles to left')).toMatchObject({
      kind: 'confirm', reasons: ['runner_held'], reading: { readBack: 'L. Darcy singles to left, J. Soto holds 3rd' },
    });
    expect(press(said(['Soto doubles']), 'Darcy singles')).toMatchObject({
      kind: 'confirm', reasons: ['runner_held'], reading: { readBack: 'L. Darcy singles, J. Soto holds 2nd' },
    });
  });

  it('H2/B5/E1: a trailing correction cancels the play before it, so nothing saves', () => {
    expect(press(gameWith([]), 'ball, scratch that')).toEqual({ kind: 'no_play', question: false });
    expect(press(gameWith([]), 'Soto singles, no')).toEqual({ kind: 'no_play', question: false });
    expect(press(gameWith([]), 'ball, strike looking, wait')).toMatchObject({ kind: 'save', reading: { readBack: 'Ball → count 1–0' } });
  });

  it('M1/C5/B1/B12: names on walks, hit by pitches and strikeouts are checked too', () => {
    expect(press(said(['ball', 'ball', 'ball']), 'Darcy walks')).toMatchObject({ kind: 'ask', prompt: 'J. Soto is up, not L. Darcy.' });
    expect(press(gameWith([]), 'Ramirez hit by pitch')).toMatchObject({ kind: 'ask', prompt: 'Who is Ramirez?' });
    expect(press(said(['strike looking', 'strike looking']), 'Moss strikes out looking')).toEqual({ kind: 'reject', message: 'K. Moss is in the field this half.' });
    expect(press(gameWith([]), 'he got hit by the pitch')).toMatchObject({ kind: 'save', reading: { readBack: 'Hit by pitch → J. Soto to 1st' } });
    expect(press(said(['ball', 'ball', 'ball']), 'Soto walks')).toMatchObject({ kind: 'save', reading: { readBack: 'J. Soto walks' } });
  });

  it('M2: a bare digit pair like a count is never saved as an out', () => {
    expect(press(gameWith([]), '1-2')).toMatchObject({ kind: 'unknown_phrase' });
    expect(press(gameWith([]), '3-2')).toMatchObject({ kind: 'unknown_phrase' });
  });

  it('M3/C3: a pickoff with two runners on asks which', () => {
    const decision = press(said(['Soto singles', 'Darcy singles']), 'picked off');
    expect(decision).toMatchObject({ kind: 'ask', prompt: 'Which runner?' });
    expect(readBacks(decision)).toEqual(['J. Soto picked off at 2nd', 'L. Darcy picked off at 1st']);
  });

  it('M4: a runner clause after a bare wild pitch says who moved, with no duplicate or passing buttons', () => {
    const game = said(['Soto triples', 'Darcy singles']);
    expect(press(game, 'wild pitch, runner scores')).toMatchObject({ kind: 'save', reading: { readBack: 'Wild pitch: J. Soto scores' } });
    const options = readBacks(press(game, 'wild pitch'));
    expect(new Set(options).size).toBe(options.length);
    expect(options).not.toContain('Wild pitch: L. Darcy scores');
  });

  it('M5/B1: two batting-side players with the same last name are asked about, never guessed', () => {
    const twins = roster.map((entry) => entry.name === 'J. Soto' ? { ...entry, name: 'R. Darcy' } : entry);
    const game = { ...said(['Soto singles', 'Darcy singles']), roster: twins };
    const decision = press(game, 'Darcy steals third');
    expect(decision).toMatchObject({ kind: 'ask', prompt: 'Who is Darcy?' });
    expect(readBacks(decision)).toEqual(['R. Darcy steals 3rd']);
    const onlyOneOn = { ...said(['Soto singles']), roster: twins };
    expect(press(onlyOneOn, 'Darcy steals second')).toMatchObject({ kind: 'save', reading: { readBack: 'R. Darcy steals 2nd' } });
  });

  it('a runner named when nobody is on base says so, rather than asking with no buttons', () => {
    expect(press(gameWith([]), 'Ramirez steals second')).toEqual({ kind: 'reject', message: 'No runners on base.' });
  });
});

// Findings from Grokbot's re-review of PR #58 at 2ecab4b.
describe('review round 2', () => {
  it('M6/B1: lead-in words before a walk, strikeout or hit by pitch are not a name', () => {
    const full = said(['ball', 'ball', 'ball']);
    expect(press(full, "that's ball four")).toMatchObject({ kind: 'save', reading: { readBack: 'J. Soto walks' } });
    expect(press(full, "that's a walk")).toMatchObject({ kind: 'save', reading: { readBack: 'J. Soto walks' } });
    expect(press(full, 'and that is ball four')).toMatchObject({ kind: 'save', reading: { readBack: 'J. Soto walks' } });
    const two = said(['strike looking', 'strike looking']);
    expect(press(two, "that's strike three")).toMatchObject({ kind: 'ask', prompt: 'Looking or swinging?' });
    expect(press(two, 'big strikeout')).toMatchObject({ kind: 'ask', prompt: 'Looking or swinging?' });
    expect(press(gameWith([]), 'ouch hit by pitch')).toMatchObject({ kind: 'save', reading: { readBack: 'Hit by pitch → J. Soto to 1st' } });
    expect(press(gameWith([]), "that's a single to left")).toMatchObject({ kind: 'save', reading: { readBack: 'J. Soto singles to left' } });
  });

  it('M6: a roster name on a walk, strikeout or hit by pitch is still checked', () => {
    expect(press(said(['ball', 'ball', 'ball']), "that's ball four for Darcy")).toMatchObject({ kind: 'unknown_phrase' });
    expect(press(said(['ball', 'ball', 'ball']), 'Darcy walks')).toMatchObject({ kind: 'ask', prompt: 'J. Soto is up, not L. Darcy.' });
    expect(press(gameWith([]), 'number 3 hit by pitch')).toMatchObject({ kind: 'ask', prompt: 'J. Soto is up, not L. Darcy.' });
  });

  // Grokbot's re-review at fa64686 (M7): stripping lead-ins is the whole M6 fix; an unknown name still asks.
  it('M7/B1: an unknown or misheard name on a walk or strikeout asks who it was', () => {
    expect(press(said(['ball', 'ball', 'ball']), 'Ramirez walks')).toMatchObject({ kind: 'ask', prompt: 'Who is Ramirez?' });
    expect(press(said(['strike looking', 'strike looking']), 'Darsy strikes out looking')).toMatchObject({ kind: 'ask', prompt: 'Who is Darsy?' });
  });

  it('B5: "no wait" at the end cancels the play before it', () => {
    expect(press(gameWith([]), 'Soto singles, no wait')).toEqual({ kind: 'no_play', question: false });
  });
});
