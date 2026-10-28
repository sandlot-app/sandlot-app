import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Command } from '@sandlot/engine';
import { parsePhrase } from '../src/parse.ts';
import { gameWith, player, press, roster, said } from './game.ts';

// Soto pitching for the Marlins in the bottom of the first, two out, J. Ruiz up.
const ruizUp = () => said(['Soto flies out', 'Darcy flies out', 'Vance flies out', 'Nguyen flies out', 'Ortiz flies out', 'Park homers', 'Bell homers', 'Kindle homers']);

describe('talks like a parent (spec #78, "Reading")', () => {
  it('"Soto hits Ruiz, Ruiz takes first" saves one hit by pitch and nothing else', () => {
    expect(press(ruizUp(), 'Soto hits Ruiz, Ruiz takes first')).toEqual({
      kind: 'save', reading: { commands: [{ kind: 'pitch', result: 'hit_by_pitch' }], readBack: 'Hit by pitch → J. Ruiz to 1st' },
    });
  });

  it('an absorbed runner call is not a runner held', () => {
    const forced = said(['Soto singles', 'ball', 'ball', 'ball']);
    expect(press(forced, 'ball four, Soto to second')).toMatchObject({ kind: 'confirm', reasons: ['complex'] });
    expect(press(said(['Soto doubles']), 'Darcy singles')).toMatchObject({ kind: 'confirm', reasons: ['runner_held'] });
    const stated = press(said(['Soto doubles']), 'Darcy singles, Soto stays at second');
    expect(stated).toMatchObject({ kind: 'save', reading: { readBack: 'L. Darcy singles' } });
    const hit = stated.kind === 'save' ? stated.reading.commands.find((command) => command.kind === 'ball_in_play') : undefined;
    expect(hit).toMatchObject({ advances: [{ runner: player('J. Soto'), to: 2 }] });
  });

  it('a runner call that says something the play didn\'t do is never dropped', () => {
    expect(press(ruizUp(), 'Soto hits Ruiz, Ruiz takes second')).toMatchObject({ kind: 'reject' });
    expect(press(gameWith([]), 'Soto singles, Darcy takes first')).toMatchObject({ kind: 'reject' });
  });

  it('a pitcher named by role or pronoun is whoever is pitching', () => {
    for (const transcript of ['the pitcher hits him', 'he plunks him', 'their pitcher beans the batter']) {
      expect(press(gameWith([]), transcript)).toMatchObject({ kind: 'save', reading: { readBack: 'Hit by pitch → J. Soto to 1st' } });
    }
  });

  it('"Soto hits …" is a hit by pitch only when a batter follows, never a batted ball', () => {
    expect(press(gameWith([]), 'Soto hits a double')).toMatchObject({ kind: 'save', reading: { readBack: 'J. Soto doubles' } });
    expect(press(gameWith([]), 'Soto hits it to left')).toMatchObject({ kind: 'unknown_phrase' });
    expect(press(gameWith([]), 'Soto hits one deep')).toMatchObject({ kind: 'unknown_phrase' });
  });

  it('the phone reads every case in the "talks like a parent" set without an AI call', () => {
    // The app sends a transcript to voice-parse only when the phone's reader says it's unclear (apps/mobile/src/voice/press.ts).
    const cases = readFileSync(new URL('../evals/parent.jsonl', import.meta.url), 'utf8').split('\n').filter(Boolean)
      .map((line) => JSON.parse(line) as { id: string; transcript: string; expect: { kind: string } });
    const needsAi = cases.filter((c) => c.expect.kind !== 'unknown_phrase' && parsePhrase(c.transcript).kind === 'unclear');
    expect(needsAi.map((c) => c.id)).toEqual([]);
  });

  it('rule 5: saved commands name players by ID only', () => {
    const names = roster.flatMap((entry) => [entry.name, entry.name.split(' ').at(-1)!]);
    const saved: Command[] = [];
    for (const [game, transcript] of [[ruizUp(), 'Soto hits Ruiz, Ruiz takes first'], [said(['Soto doubles']), 'Darcy singles, Soto stays at second']] as const) {
      const decision = press(game, transcript);
      if (decision.kind === 'save' || decision.kind === 'confirm') saved.push(...decision.reading.commands);
    }
    expect(saved.length).toBeGreaterThan(0);
    for (const name of names) expect(JSON.stringify(saved)).not.toContain(name);
  });
});
