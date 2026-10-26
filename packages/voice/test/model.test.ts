import { describe, expect, it } from 'vitest';
import { fromModel, parserInstructions } from '../src/model.ts';
import { route } from '../src/route.ts';
import { said } from './game.ts';

const play = (fields: Record<string, unknown>) => ({
  words: '', pitch: null, looking: null, bases: null, trajectory: null, fielder: null, event: null, to: null, who: null, ...fields,
});

describe("the parser model's answer", () => {
  it('becomes the same plays the grammar would give', () => {
    expect(fromModel({ result: 'plays', plays: [play({ kind: 'hit', bases: 2, fielder: 'LF', who: { name: 'Soto', number: null, base: null }, words: 'Soto rips one into the left field corner' })] }))
      .toEqual({ kind: 'plays', plays: [{ kind: 'hit', bases: 2, fielder: 'LF', batter: { name: 'soto' } }], parts: ['Soto rips one into the left field corner'], model: true });
    expect(fromModel({ result: 'plays', plays: [play({ kind: 'steal', to: '3', who: { name: null, number: null, base: '2' } })] }))
      .toMatchObject({ kind: 'plays', plays: [{ kind: 'steal', to: 3, runner: { base: 2 } }] });
  });

  it('B8/A7: questions and chatter record nothing', () => {
    expect(fromModel({ result: 'question', plays: [] })).toEqual({ kind: 'not_a_command', question: true });
    expect(fromModel({ result: 'not_a_command', plays: [] })).toEqual({ kind: 'not_a_command', question: false });
  });

  it('B9: anything malformed is unclear, so a bad answer can never save a play', () => {
    expect(fromModel(null)).toEqual({ kind: 'unclear' });
    expect(fromModel('single')).toEqual({ kind: 'unclear' });
    expect(fromModel({ result: 'plays', plays: [] })).toEqual({ kind: 'unclear' });
    expect(fromModel({ result: 'plays', plays: [play({ kind: 'hit', bases: 5 })] })).toEqual({ kind: 'unclear' });
    expect(fromModel({ result: 'plays', plays: [play({ kind: 'pitch', pitch: 'balk' })] })).toEqual({ kind: 'unclear' });
    expect(fromModel({ result: 'plays', plays: [play({ kind: 'teleport' })] })).toEqual({ kind: 'unclear' });
    expect(fromModel({ result: 'plays', plays: [play({ kind: 'out', trajectory: 'ground', fielder: 'ROVER2' })] })).toEqual({ kind: 'unclear' });
    expect(fromModel({ result: 'plays', plays: [play({ kind: 'steal', to: '4' })] })).toEqual({ kind: 'unclear' });
    expect(fromModel({ result: 'plays', plays: [play({ kind: 'pickoff', to: 'home' })] })).toEqual({ kind: 'unclear' });
    expect(fromModel({ result: 'plays', plays: [play({ kind: 'steal', who: { name: null, number: null, base: '5' } })] })).toEqual({ kind: 'unclear' });
    expect(fromModel({ result: 'plays', plays: [play({ kind: 'steal', who: { name: null, number: 'twelve', base: null } })] })).toEqual({ kind: 'unclear' });
    expect(fromModel({ result: 'plays', plays: [play({ kind: 'strikeout', looking: 'yes' })] })).toEqual({ kind: 'unclear' });
    expect(fromModel({ result: 'plays', plays: [play({ kind: 'strikeout', looking: false })] })).toMatchObject({ kind: 'plays', plays: [{ kind: 'strikeout', looking: false }] });
  });

  it("B4: the echo check compares the model's play with the whole transcript", () => {
    const game = said(['Soto singles']);
    const parsed = fromModel({ result: 'plays', plays: [play({ kind: 'steal', to: '2', words: 'steals second' })] });
    expect(route({ ...game, transcript: 'ground ball, runner to second', at: 0 }, parsed)).toMatchObject({ kind: 'confirm', reasons: ['echo'] });
    expect(route({ ...game, transcript: 'and he swipes second', at: 0 }, parsed)).toMatchObject({ kind: 'save' });
  });

  it('the instructions list who might be named and the runners on base', () => {
    const text = parserInstructions({ batting: ['J. Soto', 'L. Darcy'], fielding: ['K. Moss'], runners: ['J. Soto on 1st'] });
    expect(text).toContain('Batting team: J. Soto, L. Darcy. Fielding team: K. Moss.');
    expect(text).toContain('Runners on base: J. Soto on 1st.');
  });
});
