import { describe, expect, it } from 'vitest';
import { applyGroup } from '@sandlot/engine';
import type { Command, Event, GroupId } from '@sandlot/engine';
import { route } from '../src/route.ts';
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

  it('a press that starts "no", "actually", "that was" or "undo that" with a call fixes the last Play, after a preview', () => {
    const game = said(['Soto singles']);
    const double = press(game, 'No, that was a double');
    expect(double).toMatchObject({
      kind: 'fix', was: { readBack: 'J. Soto singles' }, options: [{ readBack: 'J. Soto doubles' }], calls: ['a double'],
    });
    expect(double.kind === 'fix' && double.options[0]!.commands[1]).toMatchObject({ kind: 'ball_in_play', outcome: 'double' });
    expect(press(game, 'actually he tripled to right')).toMatchObject({ kind: 'fix', options: [{ readBack: 'J. Soto triples to right' }] });
    expect(press(game, 'That was a home run')).toMatchObject({ kind: 'fix', options: [{ readBack: 'J. Soto homers' }] });
    expect(press(game, 'undo that, double')).toMatchObject({ kind: 'fix', options: [{ readBack: 'J. Soto doubles' }] });
  });

  it('a voice fix is read against the game before the last Play, and asks when the new call is unclear', () => {
    const game = said(['ball', 'ball', 'ball', 'strike looking']);
    expect(press(game, 'actually ball four')).toMatchObject({
      kind: 'fix', was: { readBack: 'Strike looking → count 3–1' }, options: [{ readBack: 'J. Soto walks' }],
    });
    const strike = press(said(['ball']), 'no, strike');
    expect(strike).toMatchObject({ kind: 'fix', prompt: 'Looking or swinging?', was: { readBack: 'Ball → count 1–0' } });
    expect(strike.kind === 'fix' && strike.options.map((option) => option.readBack)).toEqual(['Strike looking → count 0–1', 'Strike swinging → count 0–1']);
  });

  it('a voice fix the game can\'t take says why, and with no play yet there\'s nothing to fix', () => {
    expect(press(said(['Soto singles']), 'no, he walked')).toEqual({ kind: 'reject', message: 'That would be ball 1, not ball four.' });
    expect(press(start, 'no, that was a double')).toEqual({ kind: 'reject', message: 'There\'s no play to fix yet.' });
  });

  it('a voice fix that changes nothing, of a fix, or that isn\'t a play says so instead of offering a card', () => {
    const game = said(['Soto singles']);
    expect(press(game, 'that was a single')).toEqual({ kind: 'reject', message: 'That\'s already the last play.' });
    expect(press(game, 'no, come on!')).toEqual({ kind: 'no_play', question: false });
    expect(press(game, 'nope, a double')).toMatchObject({ kind: 'unknown_phrase' });
    const fixed = gameWith([[{ kind: 'pitch', result: 'ball' }]]);
    const target = fixed.events.at(-1)!.group;
    const correction = { ...fixed.events.at(-1)!, id: 'event-fix', seq: fixed.events.length + 1, group: 'play-fix',
      command: { kind: 'correct', target, replacement: [{ kind: 'pitch', result: 'foul' }] } } as Event;
    expect(press({ ...fixed, events: [...fixed.events, correction] }, 'no, strike looking')).toEqual({
      kind: 'reject', message: 'The last play is already a fix. Undo it, then say the play again.',
    });
  });

  it('a voice fix names the Play it replaces, so the app can ask the engine to correct that one', () => {
    const game = said(['Soto singles']);
    expect(press(game, 'no, a double')).toMatchObject({ kind: 'fix', target: game.events.at(-1)!.group });
  });

  it('a press read by the parser model keeps each call\'s words as said', () => {
    const plays = { kind: 'plays', model: true, plays: [{ kind: 'pitch', result: 'ball' }, { kind: 'hit', bases: 1, batter: { name: 'ramirez' } }],
      parts: ['Ball', 'Ramirez singles'] } as const;
    expect(route({ ...start, transcript: 'Ball, uh, Ramirez singles', at: 10_000 }, { ...plays, plays: [...plays.plays], parts: [...plays.parts] }))
      .toMatchObject({ kind: 'partial', calls: ['Ramirez singles'] });
  });

  it('"undo" alone still undoes, and "undo" among other calls still isn\'t understood', () => {
    const game = said(['Soto singles']);
    expect(press(game, 'undo that')).toEqual({ kind: 'undo' });
    expect(press(game, 'Undo')).toEqual({ kind: 'undo' });
    expect(press(game, 'double, undo')).toEqual({ kind: 'unknown_phrase', message: 'Didn\'t understand "double, undo". Tap to score.' });
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

  it('ADR 0006: the clear calls before a failing one save, and the rest says why it can\'t be recorded', () => {
    const game = said(['Soto singles']);
    expect(press(game, 'ball, ball, steals third')).toEqual({
      kind: 'partial',
      reading: { commands: [ball, ball], readBack: 'Ball → count 1–0 · Ball → count 2–0' },
      rest: { kind: 'reject', message: 'Couldn\'t record "steals third": no runner on second.' },
      calls: ['steals third'],
    });
  });

  it('ADR 0006: the clear calls before an unclear one save, and only the rest goes on the card', () => {
    const decision = press(start, 'ball, ball, strike');
    expect(decision).toMatchObject({ kind: 'partial', reading: { commands: [ball, ball] }, rest: { kind: 'ask', prompt: 'Looking or swinging?' }, calls: ['strike'] });
    // The card's choices are checked against the game after the saved calls, so they read the 2–0 count.
    expect(decision.kind === 'partial' && decision.rest.kind === 'ask' && decision.rest.options.map((option) => option.readBack))
      .toEqual(['Strike looking → count 2–1', 'Strike swinging → count 2–1']);
  });

  it('ADR 0006: the card\'s answer is its own Play, so Undo after it takes back only the answer', () => {
    const decision = press(start, 'ball, ball, strike');
    if (decision.kind !== 'partial' || decision.rest.kind !== 'ask') throw new Error('Expected a partial save with a card');
    const answer = decision.rest.options[1]!.commands;
    expect(answer).toEqual([{ kind: 'pitch', result: 'swinging_strike' }]);
    const game = gameWith([decision.reading.commands, answer]);
    expect(applyGroup(game.setup, game.events, [{ kind: 'undo', target: 'play-2' as GroupId }])).toMatchObject({
      ok: true, state: { count: { balls: 2, strikes: 0 } },
    });
  });

  it('ADR 0006: a call nobody can read loses only itself and the calls after it', () => {
    expect(press(start, 'ball, ball, zorp')).toEqual({
      kind: 'partial',
      reading: { commands: [ball, ball], readBack: 'Ball → count 1–0 · Ball → count 2–0' },
      rest: { kind: 'reject', message: 'Didn\'t understand "zorp".' },
      calls: ['zorp'],
    });
    expect(press(start, 'ball, no, zorp'), 'a correction after the clear calls might take them back').toMatchObject({ kind: 'unknown_phrase' });
    expect(press(start, 'zorp, ball')).toMatchObject({ kind: 'unknown_phrase' });
  });

  it('ADR 0006: when the rest starts unclear and then fails, the one card asks about the start and says why the end is missing', () => {
    const decision = press(start, 'ball, strike, steals home');
    expect(decision).toMatchObject({
      kind: 'partial', reading: { commands: [ball] }, calls: ['strike', 'steals home'],
      rest: { kind: 'ask', prompt: 'Couldn\'t record "steals home": no runner on third. Looking or swinging?' },
    });
    expect(decision.kind === 'partial' && decision.rest.kind === 'ask' && decision.rest.options.map((option) => option.readBack))
      .toEqual(['Strike looking → count 1–1', 'Strike swinging → count 1–1']);
    expect(press(start, 'ball, ball, Ramirez singles, runner scores')).toMatchObject({
      kind: 'partial', rest: { kind: 'reject', message: 'Couldn\'t record "Ramirez singles": who is Ramirez?' },
    });
  });

  it('ADR 0006: nothing saves when the first call is unclear', () => {
    expect(press(start, 'strike, ball')).toMatchObject({ kind: 'ask', prompt: 'Looking or swinging?' });
    expect(press(start, 'Ramirez singles, ball')).toMatchObject({ kind: 'ask', prompt: 'Who is Ramirez?' });
  });

  it('ADR 0006: when the clear calls need a card anyway, the whole press goes on one card', () => {
    const game = said(['Soto singles']);
    // L. Darcy's single moves two players, so it needs a check before it saves; the bare strike goes on the same card.
    const decision = press(game, 'Darcy singles to right, strike');
    expect(decision).toMatchObject({ kind: 'ask', prompt: 'Looking or swinging?' });
    expect(decision.kind === 'ask' && decision.options.map((option) => option.readBack)).toEqual([
      'L. Darcy singles to right, J. Soto to 2nd · Strike looking → count 0–1',
      'L. Darcy singles to right, J. Soto to 2nd · Strike swinging → count 0–1',
    ]);
    expect(press(game, 'Darcy singles to right, steals home')).toMatchObject({
      kind: 'reject', savePart: { readBack: 'L. Darcy singles to right, J. Soto to 2nd' },
    });
    expect(press(start, 'ball, strike', { confirmEverything: true })).toMatchObject({ kind: 'ask', prompt: 'Looking or swinging?' });
  });

  it('ADR 0006: a runner\'s move stays with the play it belongs to, so the split never cuts between them', () => {
    const game = said(['Soto triples', 'Darcy doubles']);
    expect(press(game, 'ball, Vance singles, runner scores')).toMatchObject({
      kind: 'partial', reading: { commands: [ball] }, rest: { kind: 'ask', prompt: 'Which runner?' }, calls: ['Vance singles', 'runner scores'],
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
