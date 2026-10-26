import { describe, expect, it } from 'vitest';
import type { Command } from '@sandlot/engine';
import { echoMismatch } from '../src/echo.ts';
import { gameWith, player, press, said } from './game.ts';

const ball: Command = { kind: 'pitch', result: 'ball' };

describe('routing a press (spec section 3)', () => {
  const start = gameWith([]);

  it('A6: an empty transcript or only filler is "didn\'t catch that"', () => {
    expect(press(start, '')).toEqual({ kind: 'didnt_catch' });
    expect(press(start, ' um, uh ')).toEqual({ kind: 'didnt_catch' });
  });

  it('B8: a question is not a play', () => {
    expect(press(start, "Who's up?")).toEqual({ kind: 'no_play', question: true });
  });

  it('A7: crowd chatter records nothing', () => {
    expect(press(start, 'Run!')).toEqual({ kind: 'no_play', question: false });
  });

  it('B9: a phrase the grammar doesn\'t know says so', () => {
    expect(press(start, 'he tagged and took two')).toEqual({ kind: 'unknown_phrase', message: 'Didn\'t understand "he tagged and took two". Tap to score.' });
  });

  it('E1: "scratch that" and "undo" undo the last play', () => {
    expect(press(start, 'scratch that')).toEqual({ kind: 'undo' });
    expect(press(start, 'Undo.')).toEqual({ kind: 'undo' });
  });

  it('saves a simple pitch with a read-back', () => {
    expect(press(start, 'Ball')).toEqual({ kind: 'save', reading: { commands: [ball], readBack: 'Ball → count 1–0' } });
    expect(press(start, 'strike swinging')).toMatchObject({ kind: 'save', reading: { readBack: 'Strike swinging → count 0–1' } });
    expect(press(start, 'foul ball')).toMatchObject({ kind: 'save', reading: { readBack: 'Foul → count 0–1' } });
  });

  it('saves several pitches from one press as one group', () => {
    expect(press(start, 'ball, ball, strike looking')).toMatchObject({
      kind: 'save', reading: { readBack: 'Ball → count 1–0 · Ball → count 2–0 · Strike looking → count 2–1' },
    });
  });

  it('asks looking or swinging for a bare "strike", and never guesses', () => {
    const decision = press(start, 'strike');
    expect(decision).toMatchObject({ kind: 'ask', prompt: 'Looking or swinging?' });
    expect(decision.kind === 'ask' && decision.options.map((option) => option.readBack)).toEqual(['Strike looking → count 0–1', 'Strike swinging → count 0–1']);
  });

  it('saves a hit with the batter due and a direction', () => {
    expect(press(start, 'Soto singles to left')).toMatchObject({ kind: 'save', reading: { readBack: 'J. Soto singles to left' } });
    expect(press(start, 'single up the middle')).toMatchObject({ kind: 'save', reading: { readBack: 'J. Soto singles to center' } });
  });

  it('B5: a self-correction keeps the final intent', () => {
    expect(press(start, 'single to left, no, a double')).toMatchObject({ kind: 'save', reading: { readBack: 'J. Soto doubles' } });
  });

  it('C5: naming a batter who isn\'t up offers to record it for the batter who is', () => {
    const decision = press(start, 'Darcy singles');
    expect(decision).toMatchObject({ kind: 'ask', prompt: 'J. Soto is up, not L. Darcy.' });
    expect(decision.kind === 'ask' && decision.options.map((option) => option.readBack)).toEqual(['J. Soto singles']);
  });

  it('B1: a name not on the roster asks who it was', () => {
    const decision = press(start, 'Ramirez singles');
    expect(decision).toMatchObject({ kind: 'ask', prompt: 'Who is Ramirez?' });
    expect(decision.kind === 'ask' && decision.options[0]!.readBack).toBe('J. Soto singles');
  });

  it('B11: an unknown jersey number asks who it was', () => {
    expect(press(start, 'number 23 singles')).toMatchObject({ kind: 'ask', prompt: 'Who is number 23?' });
  });

  it('B12: a fielder named as the runner is rejected', () => {
    const game = said(['Soto singles']);
    expect(press(game, 'Moss steals second')).toEqual({ kind: 'reject', message: 'K. Moss is in the field this half.' });
  });

  it('B7: a steal with one runner on fills in the runner and the base', () => {
    const game = said(['Soto singles']);
    expect(press(game, 'steals')).toMatchObject({ kind: 'save', reading: { readBack: 'J. Soto steals 2nd' } });
    expect(press(game, 'Soto steals second')).toMatchObject({ kind: 'save', reading: { readBack: 'J. Soto steals 2nd' } });
  });

  it('C1: a steal of a base with nobody behind it explains why', () => {
    const game = said(['Soto singles']);
    expect(press(game, 'steals third')).toEqual({ kind: 'reject', message: 'No runner on second.' });
  });

  it('B6: one failing clause saves nothing and offers the clauses before it', () => {
    const game = said(['Soto singles']);
    expect(press(game, 'ball, ball, steals third')).toMatchObject({
      kind: 'reject',
      message: 'Couldn\'t record "steals third": no runner on second. Nothing was saved.',
      savePart: { commands: [ball, ball], readBack: 'Ball → count 1–0 · Ball → count 2–0' },
    });
  });

  it('C2: a play the division\'s rules forbid explains the rule', () => {
    const game = said(['Soto triples']);
    expect(press(game, 'Soto steals home')).toEqual({ kind: 'reject', message: "Stealing home isn't allowed in this division." });
  });

  it('C3: "runner scores" with two runners on asks which, with one button per reading', () => {
    const game = said(['Soto triples', 'Darcy doubles']);
    const decision = press(game, 'Vance singles, runner scores');
    expect(decision).toMatchObject({ kind: 'ask', prompt: 'Which runner?' });
    // "L. Darcy scores" alone would pass J. Soto, who stays on 3rd, so it isn't offered.
    expect(decision.kind === 'ask' && decision.options.map((option) => option.readBack)).toEqual([
      'C. Vance singles, J. Soto scores, L. Darcy holds 2nd',
      'C. Vance singles, J. Soto scores, L. Darcy scores',
    ]);
  });

  it('C4: "safe at first" asks hit or error, and answering is the confirmation', () => {
    const decision = press(start, 'Soto is safe at first on the grounder to short');
    expect(decision).toMatchObject({ kind: 'ask', prompt: 'Hit or error?' });
    expect(decision.kind === 'ask' && decision.options.map((option) => option.readBack)).toEqual([
      'J. Soto singles to short',
      'J. Soto reaches on an error by the shortstop',
    ]);
  });

  it('confirms a complex play: two players move', () => {
    const game = said(['Soto singles']);
    expect(press(game, 'Darcy singles to right')).toMatchObject({
      kind: 'confirm', reasons: ['complex'], reading: { readBack: 'L. Darcy singles to right, J. Soto to 2nd' },
    });
  });

  it('confirms a walk that forces a runner, and saves one that doesn\'t', () => {
    const forced = said(['Soto singles', 'ball', 'ball', 'ball']);
    expect(press(forced, 'ball four')).toMatchObject({ kind: 'confirm', reasons: ['complex'], reading: { readBack: 'L. Darcy walks, J. Soto to 2nd' } });
    const empty = said(['ball', 'ball', 'ball']);
    expect(press(empty, 'walk')).toMatchObject({ kind: 'save', reading: { readBack: 'J. Soto walks' } });
  });

  it('saves a first-out strikeout and confirms a third-out one', () => {
    const first = said(['strike looking', 'strike looking']);
    expect(press(first, 'strikeout swinging')).toMatchObject({ kind: 'save', reading: { readBack: 'J. Soto strikes out swinging' } });
    const third = said(['Soto flies out', 'Darcy grounds out to short', 'strike looking', 'strike looking']);
    expect(press(third, 'strikes out looking')).toMatchObject({ kind: 'confirm', reasons: ['complex'] });
  });

  it('rejects a strikeout or walk the count doesn\'t allow', () => {
    expect(press(start, 'strikeout looking')).toEqual({ kind: 'reject', message: 'That would be strike 1, not strike three.' });
    expect(press(start, 'walk')).toEqual({ kind: 'reject', message: 'That would be ball 1, not ball four.' });
  });

  it('reads back a hit by pitch', () => {
    expect(press(start, 'hit by pitch')).toMatchObject({ kind: 'save', reading: { readBack: 'Hit by pitch → J. Soto to 1st' } });
  });

  it('asks which runner on a bare wild pitch with two on, offering everyone up one too', () => {
    const game = said(['Soto triples', 'Darcy singles']);
    const decision = press(game, 'wild pitch');
    expect(decision.kind === 'ask' && decision.options.map((option) => option.readBack)).toEqual([
      'Wild pitch: J. Soto scores', 'Wild pitch: L. Darcy to 2nd', 'Wild pitch: J. Soto scores, L. Darcy to 2nd',
    ]);
  });

  it('saves a wild pitch that scores the runner named', () => {
    const game = said(['Soto triples']);
    expect(press(game, 'wild pitch, Soto scores')).toMatchObject({ kind: 'save', reading: { readBack: 'Wild pitch: J. Soto scores' } });
  });

  it('D4: the same play again within 3 seconds from a separate press asks first', () => {
    const previous = { commands: [ball], at: 9_000 };
    expect(press(start, 'ball', { previous, at: 10_000 })).toMatchObject({ kind: 'confirm', reasons: ['duplicate'] });
    expect(press(start, 'ball', { previous, at: 12_000 })).toMatchObject({ kind: 'confirm', reasons: ['duplicate'] });
    expect(press(start, 'ball', { previous, at: 12_001 })).toMatchObject({ kind: 'save' });
    expect(press(start, 'strike looking', { previous, at: 10_000 })).toMatchObject({ kind: 'save' });
  });

  it('confirms everything when the scorer asks to', () => {
    expect(press(start, 'ball', { confirmEverything: true })).toMatchObject({ kind: 'confirm', reasons: ['confirm_everything'] });
  });

  it('B4: the echo check flags a play whose outcome nobody said', () => {
    const steal: Command = { kind: 'runner', event: 'stolen_base', runner: player('J. Soto'), to: 2 };
    expect(echoMismatch('Ground ball, runner to second', [steal])).toBe(true);
    expect(echoMismatch('Soto steals second', [steal])).toBe(false);
    expect(echoMismatch('ball four', [ball])).toBe(false);
    expect(echoMismatch('fly ball to center', [ball])).toBe(true);
  });
});
