import type { Base, Command, GameState, PlayerRef, Position } from '@sandlot/engine';
import { nameOf, samePlayer } from './players.ts';
import { batting, stateAfter, type PressGame } from './resolve.ts';

export const baseWord: Record<Base | 'home', string> = { 1: '1st', 2: '2nd', 3: '3rd', home: 'home' };
const direction: Record<Position, string> = {
  P: 'the pitcher', C: 'the catcher', '1B': 'first', '2B': 'second', '3B': 'third', SS: 'short', LF: 'left', CF: 'center', RF: 'right', ROVER: 'the rover',
};
export const fielderName: Record<Position, string> = {
  P: 'pitcher', C: 'catcher', '1B': 'first baseman', '2B': 'second baseman', '3B': 'third baseman', SS: 'shortstop',
  LF: 'left fielder', CF: 'center fielder', RF: 'right fielder', ROVER: 'rover',
};
const outVerb = { ground: 'grounds out', fly: 'flies out', line: 'lines out', popup: 'pops out', bunt: 'is out on a bunt' } as const;
const hitVerb = { single: 'singles', double: 'doubles', ground_rule_double: 'hits a ground-rule double', triple: 'triples', home_run: 'homers' } as const;

function baseOf(state: GameState, player: PlayerRef): Base | null {
  return ([1, 2, 3] as const).find((base) => {
    const runner = state.bases[base]?.player;
    return runner !== undefined && samePlayer(runner, player);
  }) ?? null;
}

/** Where each runner on base before a play ended up, in plain words. */
function runnerMoves(game: PressGame, before: GameState, after: GameState, outs: PlayerRef[]): string[] {
  let runs = after.score[batting(before)] - before.score[batting(before)];
  return ([3, 2, 1] as const).flatMap((from) => {
    const player = before.bases[from]?.player;
    if (!player) return [];
    const name = nameOf(game.roster, player);
    if (outs.some((out) => samePlayer(out, player))) return [`${name} out`];
    const now = baseOf(after, player);
    if (now === from) return [];
    if (now) return [`${name} to ${baseWord[now]}`];
    if (runs <= 0) return [];
    runs -= 1;
    return [`${name} scores`];
  });
}

const countText = (state: GameState) => `count ${state.count.balls}–${state.count.strikes}`;

function pitchText(game: PressGame, before: GameState, after: GameState, result: string): string {
  const side = batting(before);
  const batter = before.lineups[side][before.nextBatter[side]]?.player;
  const name = batter ? nameOf(game.roster, batter) : 'The batter';
  const ended = after.nextBatter[side] !== before.nextBatter[side] || after.half !== before.half || after.status === 'final';
  const forced = runnerMoves(game, before, after, []);
  switch (result) {
    case 'ball': return ended ? [`${name} walks`, ...forced].join(', ') : `Ball → ${countText(after)}`;
    case 'called_strike': return ended ? `${name} strikes out looking` : `Strike looking → ${countText(after)}`;
    case 'swinging_strike': return ended ? `${name} strikes out swinging` : `Strike swinging → ${countText(after)}`;
    case 'foul_tip': return ended ? `${name} strikes out on a foul tip` : `Foul tip → ${countText(after)}`;
    case 'foul': return `Foul → ${countText(after)}`;
    case 'hit_by_pitch': return [`Hit by pitch → ${name} to 1st`, ...forced].join(', ');
    default: return result;
  }
}

function battedText(game: PressGame, before: GameState, after: GameState, play: Extract<Command, { kind: 'ball_in_play' }>): string {
  const side = batting(before);
  const batter = before.lineups[side][before.nextBatter[side]]?.player;
  const name = batter ? nameOf(game.roster, batter) : 'The batter';
  const at = play.fielders[0];
  let text: string;
  if (play.outcome === 'error') text = `${name} reaches on an error${at ? ` by the ${fielderName[at]}` : ''}`;
  else if (play.outcome === 'out') text = `${name} ${outVerb[play.trajectory ?? 'ground']}${at ? ` to ${direction[at]}` : ''}`;
  else if (play.outcome in hitVerb) text = `${name} ${hitVerb[play.outcome as keyof typeof hitVerb]}${at ? ` to ${direction[at]}` : ''}`;
  else text = `${name} puts it in play`;
  const outs = play.advances.flatMap((advance) => advance.to === 'out' ? [advance.runner] : []);
  return [text, ...runnerMoves(game, before, after, outs)].join(', ');
}

function runnerText(game: PressGame, before: GameState, commands: Extract<Command, { kind: 'runner' }>[]): string {
  const moved = (command: Extract<Command, { kind: 'runner' }>) => {
    const name = nameOf(game.roster, command.runner);
    return command.to === 'out' ? `${name} out` : command.to === 'home' ? `${name} scores` : `${name} to ${baseWord[command.to]}`;
  };
  const [first] = commands;
  if (!first) return '';
  const name = nameOf(game.roster, first.runner);
  const from = baseOf(before, first.runner);
  switch (first.event) {
    case 'stolen_base': return commands.map((command) => `${nameOf(game.roster, command.runner)} steals ${baseWord[command.to as Base | 'home']}`).join(', ');
    case 'caught_stealing': return `${name} caught stealing ${from ? baseWord[from === 3 ? 'home' : (from + 1) as Base] : ''}`.trim();
    case 'pickoff': return `${name} picked off${from ? ` at ${baseWord[from]}` : ''}`;
    case 'wild_pitch': return `Wild pitch: ${commands.map(moved).join(', ')}`;
    case 'passed_ball': return `Passed ball: ${commands.map(moved).join(', ')}`;
    default: return commands.map(moved).join(', ');
  }
}

/** The plain-words read-back for a press (spec principle 7), taken from what the engine records, not from what was heard. */
export function readBack(game: PressGame, commands: Command[]): string {
  const parts: string[] = [];
  let index = 0;
  while (index < commands.length) {
    const before = stateAfter(game, commands.slice(0, index));
    const command = commands[index]!;
    if (!before) break;
    if (command.kind === 'pitch' && command.result === 'in_play' && commands[index + 1]?.kind === 'ball_in_play') {
      const after = stateAfter(game, commands.slice(0, index + 2));
      if (after) parts.push(battedText(game, before, after, commands[index + 1] as Extract<Command, { kind: 'ball_in_play' }>));
      index += 2;
    } else if (command.kind === 'runner') {
      let end = index;
      while (commands[end + 1]?.kind === 'runner' && (commands[end + 1] as typeof command).event === command.event) end++;
      parts.push(runnerText(game, before, commands.slice(index, end + 1) as Extract<Command, { kind: 'runner' }>[]));
      index = end + 1;
    } else if (command.kind === 'pitch') {
      const after = stateAfter(game, commands.slice(0, index + 1));
      if (after) parts.push(pitchText(game, before, after, command.result));
      index += 1;
    } else {
      index += 1;
    }
  }
  return parts.join(' · ');
}
