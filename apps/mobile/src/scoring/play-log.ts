import { applyGroup, initialState } from '@sandlot/engine';
import type { Base, Command, Event, GameState, PitchResult, PlayerRef, TeamSide } from '@sandlot/engine';
import { demoSetup } from './demo-game.ts';
import { demoTeams, playerDisplay } from './demo-roster.ts';
import type { SavedGame } from './offline-game.ts';
import { playLabel } from './play-label.ts';

// The Plays tab (Figma 69:1895): the saved book, newest half-inning first, one At Bat per plate appearance.
// It reads the saved events and never changes them. An undone play stays in its at-bat, marked undone.

export type PitchMark = 'ball' | 'strike' | 'foul' | 'in_play';
/** One line inside an at-bat: a pitch, or a runner play that happened while the batter was up. */
export type PlayRow = { key: string; number: number | null; mark: PitchMark | null; label: string; count: string | null; undone: boolean };
export type AtBat = {
  key: string;
  title: string;
  detail: string;
  /** The count the at-bat ended on, or the count now while the batter is still up. */
  count: string;
  /** The Recent Play kind (35:334) that sets the row's icon. */
  kind: 'in_play' | 'run' | 'out';
  /** The score after a run, as the Run scored chip shows it. */
  score: string | null;
  inProgress: boolean;
  rows: PlayRow[];
};
export type HalfInning = { key: string; label: string; batting: string; totals: string; current: boolean; atBats: AtBat[] };

type Play = { id: string; commands: Command[]; before: GameState; after: GameState; undone: boolean };

const pitchLabels: Record<PitchResult, string> = {
  ball: 'Ball', called_strike: 'Strike looking', swinging_strike: 'Strike swinging', foul: 'Foul', foul_tip: 'Foul tip',
  hit_by_pitch: 'Hit by pitch', in_play: 'In play',
};
const pitchMarks: Record<PitchResult, PitchMark> = {
  ball: 'ball', hit_by_pitch: 'ball', called_strike: 'strike', swinging_strike: 'strike', foul_tip: 'strike', foul: 'foul', in_play: 'in_play',
};
const fielders: Record<string, string> = {
  P: 'pitcher', C: 'catcher', '1B': 'first', '2B': 'second', '3B': 'third', SS: 'short', LF: 'left', CF: 'center', RF: 'right',
};
const hits = new Set(['single', 'double', 'ground_rule_double', 'triple', 'home_run']);
const baseNames: Record<Base, string> = { 1: '1st', 2: '2nd', 3: '3rd' };

const battingSide = (state: GameState): TeamSide => (state.half === 'top' ? 'away' : 'home');
const fieldingSide = (state: GameState): TeamSide => (state.half === 'top' ? 'home' : 'away');
const halfOrder = (state: GameState) => state.inning * 2 + (state.half === 'bottom' ? 1 : 0);
const halfChanged = (play: Play) => halfOrder(play.after) !== halfOrder(play.before);
const endsAppearance = (play: Play) => play.after.nextBatter[battingSide(play.before)] !== play.before.nextBatter[battingSide(play.before)];
const pitchOf = (play: Play) => play.commands.find((command) => command.kind === 'pitch');

function name(state: GameState, player: PlayerRef): string {
  const side = state.lineups.away.some((slot) => slot.player.id === player.id) ? 'away' : 'home';
  return playerDisplay(state, side, player).name;
}

function countAfter(count: GameState['count'], result: PitchResult): string {
  let { balls, strikes } = count;
  if (result === 'ball') balls += 1;
  else if (result === 'called_strike' || result === 'swinging_strike' || result === 'foul_tip' || (result === 'foul' && strikes < 2)) strikes += 1;
  return `${balls}–${strikes}`;
}

function basesText(bases: GameState['bases']): string {
  const occupied = ([1, 2, 3] as const).filter((base) => bases[base]).map((base) => baseNames[base]);
  if (occupied.length === 3) return 'bases loaded';
  return occupied.length ? `runner${occupied.length === 1 ? '' : 's'} on ${occupied.join(' and ')}` : '';
}

const toText = (to: Base | 'home' | 'out') => (to === 'home' ? 'scores' : to === 'out' ? 'is out' : `to ${baseNames[to]}`);

/** Where each runner already on base went, lead runner first, from the bases before and after the play. */
function runnerMoves(play: Play, explicit: { runner: PlayerRef; to: Base | 'home' | 'out' }[]): string[] {
  const moves: string[] = [];
  for (const from of [3, 2, 1] as const) {
    const runner = play.before.bases[from]?.player;
    if (!runner) continue;
    const said = explicit.find((move) => move.runner.id === runner.id)?.to;
    const now = ([1, 2, 3] as const).find((base) => play.after.bases[base]?.player.id === runner.id);
    const to = said ?? now ?? (halfChanged(play) ? null : 'home');
    if (to !== null && to !== from) moves.push(`${name(play.before, runner)} ${toText(to)}`);
  }
  return moves;
}

function runnerPhrase(state: GameState, command: Extract<Command, { kind: 'runner' }>): string {
  const who = name(state, command.runner);
  const to = command.to;
  switch (command.event) {
    case 'stolen_base': return `${who} steals ${to === 'home' ? 'home' : typeof to === 'number' ? baseNames[to] : ''}`.trim();
    case 'caught_stealing': return `${who} is caught stealing`;
    case 'pickoff': return to === 'out' ? `${who} is picked off` : `${who} ${toText(to)} on a pickoff`;
    case 'wild_pitch': return `${who} ${toText(to)} on a wild pitch`;
    case 'passed_ball': return `${who} ${toText(to)} on a passed ball`;
    case 'balk': return `${who} ${toText(to)} on a balk`;
    default: return `${who} ${toText(to)}`;
  }
}

const outVerbs: Record<string, string> = { ground: 'grounds out', line: 'lines out', fly: 'flies out', popup: 'pops out', bunt: 'bunts out' };
const outcomeVerbs: Record<string, string> = {
  single: 'singles', double: 'doubles', ground_rule_double: 'hits a ground-rule double', triple: 'triples', home_run: 'homers',
  error: 'reaches on an error', fielders_choice: 'reaches on a fielder’s choice', sacrifice_fly: 'hits a sacrifice fly',
  sacrifice_bunt: 'lays down a sacrifice bunt', double_play: 'hits into a double play', triple_play: 'hits into a triple play',
};

/** The play in words: sentences for an at-bat's title, without the final period. */
function describe(play: Play): string {
  const { before } = play;
  const batter = before.lineups[battingSide(before)][before.nextBatter[battingSide(before)]]?.player;
  const batterName = batter ? name(before, batter) : 'Batter';
  const inPlay = play.commands.find((command) => command.kind === 'ball_in_play');
  if (inPlay) {
    const verb = inPlay.outcome === 'out' ? (inPlay.trajectory && outVerbs[inPlay.trajectory]) ?? 'is out' : outcomeVerbs[inPlay.outcome];
    const fielder = inPlay.fielders[0] ? ` to ${fielders[inPlay.fielders[0]] ?? inPlay.fielders[0].toLowerCase()}` : '';
    return [`${batterName} ${verb}${fielder}`, ...runnerMoves(play, inPlay.advances)].join('. ');
  }
  const runners = play.commands.filter((command) => command.kind === 'runner');
  if (runners.length) return runners.map((command) => runnerPhrase(before, command)).join('. ');
  const pitch = pitchOf(play);
  if (pitch && endsAppearance(play)) {
    const result = pitch.result === 'ball' ? 'walks' : pitch.result === 'hit_by_pitch' ? 'is hit by a pitch'
      : `strikes out ${pitch.result === 'called_strike' ? 'looking' : 'swinging'}`;
    return [`${batterName} ${result}`, ...runnerMoves(play, [])].join('. ');
  }
  if (pitch) return pitchLabels[pitch.result];
  return playLabel(play.commands);
}

/** Every play after the game's setup, with the game before and after it. An undo marks its target instead of adding a play. */
function savedPlays(events: Event[]): Play[] {
  const groups: Event[][] = [];
  for (const event of events) {
    if (groups.at(-1)?.[0]!.group !== event.group) groups.push([]);
    groups.at(-1)!.push(event);
  }
  const plays: Play[] = [];
  const seen: Event[] = [];
  let state = initialState(demoSetup);
  for (const group of groups) {
    const commands = group.map((event) => event.command);
    const first = commands[0]!;
    if (first.kind === 'undo') {
      const target = plays.find((play) => play.id === first.target);
      if (target) target.undone = true;
      state = target?.before ?? state;
    } else {
      const applied = applyGroup(demoSetup, seen, commands);
      if (!applied.ok) break;
      if (first.kind !== 'game') plays.push({ id: group[0]!.group, commands, before: state, after: applied.state, undone: false });
      state = applied.state;
    }
    seen.push(...group);
  }
  return plays;
}

function atBatOf(plays: Play[]): AtBat {
  const first = plays[0]!;
  const side = battingSide(first.before);
  const active = plays.filter((play) => !play.undone);
  const ending = active.find(endsAppearance) ?? (active.at(-1) && halfChanged(active.at(-1)!) ? active.at(-1)! : undefined);
  let pitches = 0;
  const rows = plays.map((play): PlayRow => {
    const pitch = pitchOf(play);
    if (!pitch) return { key: play.id, number: null, mark: null, label: describe(play), count: null, undone: play.undone };
    return {
      key: play.id,
      number: play.undone ? null : (pitches += 1),
      mark: pitchMarks[pitch.result],
      label: play.undone && pitch.result === 'in_play' ? `In play · ${playLabel(play.commands)}` : pitchLabels[pitch.result],
      count: pitch.result === 'in_play' ? null : countAfter(play.before.count, pitch.result),
      undone: play.undone,
    };
  });
  const batter = first.before.lineups[side][first.before.nextBatter[side]]?.player;
  if (!ending) {
    const now = active.at(-1)?.after ?? first.before;
    const pitcher = now.pitchers[fieldingSide(now)];
    const thrown = pitcher ? now.pitchCounts[pitcher.id] ?? 0 : 0;
    return {
      key: first.id, title: `${batter ? name(first.before, batter) : 'Batter'} at bat`,
      detail: [thrown ? `Pitch ${thrown}` : '', basesText(now.bases)].filter(Boolean).join(' · '),
      count: `${now.count.balls}–${now.count.strikes}`, kind: 'in_play', score: null, inProgress: true, rows,
    };
  }
  const pitch = pitchOf(ending);
  const runs = ending.after.score[side] > ending.before.score[side];
  const outs = ending.after.outs;
  return {
    key: first.id,
    title: `${describe(ending)}.`,
    detail: halfChanged(ending) ? '3 outs' : [`${outs} out${outs === 1 ? '' : 's'}`, basesText(ending.after.bases)].filter(Boolean).join(' · '),
    count: pitch ? countAfter(ending.before.count, pitch.result) : `${ending.before.count.balls}–${ending.before.count.strikes}`,
    kind: runs ? 'run' : halfChanged(ending) || ending.after.outs > ending.before.outs ? 'out' : 'in_play',
    score: runs ? `${ending.after.score.away} – ${ending.after.score.home}` : null,
    inProgress: false,
    rows,
  };
}

/**
 * The saved game as the Plays tab lists it, newest half-inning first. The current half comes from the game's state,
 * so after an undo it is the half the game went back to. Halves after it hold only undone plays and are left out.
 */
export function playLog(game: SavedGame): HalfInning[] {
  const { state } = game;
  const halves = new Map<number, { before: GameState; atBats: Play[][] }>();
  for (const play of savedPlays(game.events)) {
    const order = halfOrder(play.before);
    const half = halves.get(order) ?? { before: play.before, atBats: [] };
    halves.set(order, half);
    const side = battingSide(play.before);
    const open = half.atBats.at(-1);
    const openPlays = open?.filter((other) => !other.undone) ?? [];
    const finished = openPlays.some(endsAppearance) || (openPlays.length > 0 && halfChanged(openPlays.at(-1)!));
    if (open && !finished && open[0]!.before.nextBatter[side] === play.before.nextBatter[side]) open.push(play);
    else half.atBats.push([play]);
  }
  const live = state.status !== 'final';
  const now = halfOrder(state);
  if (live && !halves.has(now)) halves.set(now, { before: state, atBats: [] });
  return [...halves.entries()]
    .filter(([order]) => order <= now)
    .sort(([left], [right]) => right - left)
    .map(([order, { before, atBats }]) => {
      const side = battingSide(before);
      const active = atBats.flat().filter((play) => !play.undone);
      const runs = active.reduce((sum, play) => sum + Math.max(0, play.after.score[side] - play.before.score[side]), 0);
      const outcomes = active.flatMap((play) => play.commands.filter((command) => command.kind === 'ball_in_play'));
      const hitCount = outcomes.filter((command) => hits.has(command.outcome)).length;
      const errors = outcomes.filter((command) => command.outcome === 'error').length;
      const current = live && order === now;
      return {
        key: String(order),
        label: `${before.half === 'top' ? 'Top' : 'Bottom'} ${before.inning}`,
        batting: demoTeams[side].name,
        totals: `${runs} R · ${hitCount} H${current ? '' : ` · ${errors} E`}`,
        current,
        atBats: atBats.map(atBatOf).reverse(),
      };
    });
}
