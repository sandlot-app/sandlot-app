import type { BallInPlayOutcome, PitchResult, PlayerRef, TeamSide } from '@sandlot/engine';
import type { SavedPlay } from './play-log.ts';
import { displayPlayer } from './roster-presentation.ts';

export type AtBatEntry = {key: number; batter: PlayerRef | null; plays: SavedPlay[]};
export type InningEntry = {key: string; inning: number; half: 'top' | 'bottom'; side: TeamSide; entries: AtBatEntry[]; runs: number; hits: number};
const hits: BallInPlayOutcome[] = ['single', 'double', 'ground_rule_double', 'triple', 'home_run'];
const outcomes: Record<BallInPlayOutcome, string> = {
  single: 'singles', double: 'doubles', ground_rule_double: 'hits a ground-rule double', triple: 'triples', home_run: 'homers',
  out: 'is out', error: 'reaches on an error', fielders_choice: 'reaches on a fielder’s choice', sacrifice_fly: 'hits a sacrifice fly',
  sacrifice_bunt: 'lays down a sacrifice bunt', double_play: 'hits into a double play', triple_play: 'hits into a triple play',
};
export const pitchLabels: Record<PitchResult, string> = {ball: 'Ball', called_strike: 'Strike looking', swinging_strike: 'Strike swinging', foul: 'Foul', foul_tip: 'Foul tip', hit_by_pitch: 'Hit by pitch', in_play: 'In play'};
const fielderNames: Record<string, string> = {P: 'pitcher', C: 'catcher', '1B': 'first', '2B': 'second', '3B': 'third', SS: 'short', LF: 'left', CF: 'center', RF: 'right', ROVER: 'rover'};
const destinationName = (to: number | 'home' | 'out') => typeof to === 'number' ? ['first', 'second', 'third'][to - 1] : to;

export function playBatter(play: SavedPlay): PlayerRef | null {
  const side = play.before.half === 'top' ? 'away' : 'home';
  return play.before.lineups[side][play.before.nextBatter[side]]?.player ?? null;
}

export function playTitle(play: SavedPlay, all: readonly SavedPlay[]): string {
  const batter = playBatter(play);
  const name = batter ? displayPlayer(batter).name : '';
  const outcome = play.commands.find((command) => command.kind === 'ball_in_play');
  if (outcome?.kind === 'ball_in_play') {
    const result = outcome.outcome === 'out' ? outcome.trajectory === 'fly' ? 'flies out' : outcome.trajectory === 'ground' ? 'grounds out' : outcome.trajectory === 'line' ? 'lines out' : outcome.trajectory === 'popup' ? 'pops out' : 'is out' : outcomes[outcome.outcome];
    return `${name} ${result}${outcome.fielders[0] ? ` to ${fielderNames[outcome.fielders[0]]}` : ''}.`;
  }
  const first = play.commands[0]!;
  switch (first.kind) {
    case 'ball_in_play': return `${name} ${outcomes[first.outcome]}.`;
    case 'pitch': return `${name} at bat`;
    case 'runner': return play.commands.filter((command) => command.kind === 'runner').map((command) => `${displayPlayer(command.runner).name} ${command.event === 'stolen_base' ? 'steals' : command.event === 'caught_stealing' ? 'is caught stealing' : command.event === 'pickoff' ? 'is picked off' : command.event.replaceAll('_', ' ')}${command.to === 'out' ? '' : ` to ${destinationName(command.to)}`}`).join('. ');
    case 'undo': {
      const target = all.find((entry) => entry.id === first.target);
      return `Undo · ${target ? playTitle(target, all) : 'Previous play'}`;
    }
    case 'game': return first.control.kind === 'lineup_set' || first.control.kind === 'start' ? 'Game started' : first.control.kind === 'end_half' ? 'Half-inning ended' : 'Game ended';
    case 'batter_out': return `${name} out · ${first.reason.replaceAll('_', ' ')}`;
    case 'substitution': return 'Pitching change';
    case 'correct': return 'Recorded fix';
  }
}

export function pitchCount(play: SavedPlay): string {
  const pitch = play.commands.find((command) => command.kind === 'pitch');
  let {balls, strikes} = play.before.count;
  if (pitch?.kind === 'pitch') {
    if (pitch.result === 'ball') balls += 1;
    else if (pitch.result === 'called_strike' || pitch.result === 'swinging_strike' || pitch.result === 'foul_tip') strikes += 1;
    else if (pitch.result === 'foul' && strikes < 2) strikes += 1;
  }
  return `${balls}–${strikes}`;
}

export function inningLog(plays: readonly SavedPlay[]): InningEntry[] {
  const innings = new Map<string, InningEntry>();
  for (const play of plays) {
    const state = play.before.status === 'pregame' ? play.after : play.before;
    const side = state.half === 'top' ? 'away' : 'home';
    const key = `${state.inning}-${state.half}`;
    let inning = innings.get(key);
    if (!inning) {
      inning = {key, inning: state.inning, half: state.half, side, entries: [], runs: 0, hits: 0};
      innings.set(key, inning);
    }
    const first = play.commands[0]!;
    const batter = playBatter(play);
    const previous = inning.entries.at(-1);
    if (batter && first.kind !== 'undo' && previous?.batter?.id === batter.id && previous.plays.at(-1)?.commands[0]?.kind !== 'undo') previous.plays.push(play);
    else inning.entries.push({key: play.firstSeq, batter, plays: [play]});
    if (!play.undone && first.kind !== 'undo') {
      inning.runs += Math.max(0, play.after.score[side] - play.before.score[side]);
      const outcome = play.commands.find((command) => command.kind === 'ball_in_play');
      if (outcome?.kind === 'ball_in_play' && hits.includes(outcome.outcome)) inning.hits += 1;
    }
  }
  return [...innings.values()].sort((left, right) => right.entries.at(-1)!.plays.at(-1)!.firstSeq - left.entries.at(-1)!.plays.at(-1)!.firstSeq);
}
