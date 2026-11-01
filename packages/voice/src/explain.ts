import type { BallInPlayOutcome, Base, Command, GameState, PlayerRef, Position } from '@sandlot/engine';
import { nameOf, samePlayer } from './players.ts';
import { baseOf, batterDefault, batting, stateAfter, units, type PressGame } from './state.ts';

export const baseWord: Record<Base | 'home', string> = { 1: '1st', 2: '2nd', 3: '3rd', home: 'home' };
const direction: Record<Position, string> = {
  P: 'the pitcher', C: 'the catcher', '1B': 'first', '2B': 'second', '3B': 'third', SS: 'short', LF: 'left', CF: 'center', RF: 'right', ROVER: 'the rover',
};
export const fielderName: Record<Position, string> = {
  P: 'pitcher', C: 'catcher', '1B': 'first baseman', '2B': 'second baseman', '3B': 'third baseman', SS: 'shortstop',
  LF: 'left fielder', CF: 'center fielder', RF: 'right fielder', ROVER: 'rover',
};
const outVerb = { ground: 'grounds out', fly: 'flies out', line: 'lines out', popup: 'pops out', bunt: 'is out on a bunt' } as const;
const otherVerb: Record<Exclude<BallInPlayOutcome, 'error' | 'out'>, string> = {
  single: 'singles', double: 'doubles', ground_rule_double: 'hits a ground-rule double', triple: 'triples', home_run: 'homers',
  fielders_choice: "reaches on a fielder's choice", sacrifice_fly: 'hits a sacrifice fly', sacrifice_bunt: 'lays down a sacrifice bunt',
  double_play: 'hits into a double play', triple_play: 'hits into a triple play',
};


const heldOutcomes = new Set(['single', 'double', 'ground_rule_double', 'triple', 'error']);

/** Runners on base before a hit or error that its advances don't move. */
function unmoved(before: GameState, play: Extract<Command, { kind: 'ball_in_play' }>): PlayerRef[] {
  if (!heldOutcomes.has(play.outcome)) return [];
  return ([1, 2, 3] as const).flatMap((base) => {
    const runner = before.bases[base]?.player;
    return runner && !play.advances.some((advance) => samePlayer(advance.runner, runner)) ? [runner] : [];
  });
}

/** Where each runner on base before a play ended up, in plain words. A runner a hit left in place "holds". */
function runnerMoves(game: PressGame, before: GameState, after: GameState, outs: PlayerRef[], held: PlayerRef[] = []): string[] {
  let runs = after.score[batting(before)] - before.score[batting(before)];
  return ([3, 2, 1] as const).flatMap((from) => {
    const player = before.bases[from]?.player;
    if (!player) return [];
    const name = nameOf(game.roster, player);
    if (outs.some((out) => samePlayer(out, player))) return [`${name} out`];
    const now = baseOf(after, player);
    if (now === from) return held.some((runner) => samePlayer(runner, player)) ? [`${name} holds ${baseWord[from]}`] : [];
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
  else text = `${name} ${otherVerb[play.outcome]}${at ? ` to ${direction[at]}` : ''}`;
  const outs = play.advances.flatMap((advance) => advance.to === 'out' ? [advance.runner] : []);
  // Where the batter ended, when it isn't where the outcome puts them: "J. Soto singles, J. Soto to 2nd".
  const own = batter && play.advances.find((advance) => samePlayer(advance.runner, batter));
  // A double or triple play names the batter's out explicitly, but that out is the usual one, so it isn't repeated.
  const usual = batterDefault[play.outcome] ?? 'out';
  const extra = own && own.to !== usual ? [own.to === 'out' ? `${name} out` : own.to === 'home' ? `${name} scores` : `${name} to ${baseWord[own.to]}`] : [];
  return [text, ...runnerMoves(game, before, after, outs, unmoved(before, play)), ...extra].join(', ');
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
  for (const [start, end] of units(commands)) {
    const before = stateAfter(game, commands.slice(0, start));
    const after = stateAfter(game, commands.slice(0, end));
    const command = commands[start]!;
    if (!before || !after) break;
    if (command.kind === 'runner') parts.push(runnerText(game, before, commands.slice(start, end) as Extract<Command, { kind: 'runner' }>[]));
    else if (command.kind === 'pitch' && end - start === 2) parts.push(battedText(game, before, after, commands[start + 1] as Extract<Command, { kind: 'ball_in_play' }>));
    else if (command.kind === 'pitch') parts.push(pitchText(game, before, after, command.result));
  }
  return parts.join(' · ');
}
