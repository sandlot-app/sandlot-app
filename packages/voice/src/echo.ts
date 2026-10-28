import type { Command } from '@sandlot/engine';
import { battedBall, batterWords } from './parse.ts';

type Outcome = 'ball' | 'strike' | 'foul' | 'hbp' | 'single' | 'double' | 'triple' | 'homer' | 'ground' | 'fly' | 'line' | 'popup'
  | 'error' | 'steal' | 'caught_stealing' | 'pickoff' | 'wild_pitch' | 'passed_ball';

/** Words that name an outcome (spec 5.1). Each list is checked against the transcript on word boundaries. */
const synonyms: [Outcome, RegExp][] = [
  ['ball', /(?<!(?:ground|fly|foul|passed|line|pop) )\bball\b(?! four)|\b(?:walk|walks|walked|ball four|base on balls)\b/],
  ['strike', /\bstrike\b(?! out)|\b(?:strikes out|struck out|strikeout|strike out|punched out|rung up|looking|swinging|swing and a miss|swing and miss|swings and misses)\b/],
  ['foul', /\bfoul(?:ed)?\b/],
  // "Soto hits Ruiz" and "plunks him" name a hit by pitch; "hits a double", "hits sharp grounder" and "base hit" don't.
  ['hbp', new RegExp(`\\b(?:hit by (?:a |the )?pitch|hbp|plunked|plunks|beaned|beans|hit batter)\\b|(?<!base )\\bhits? (?:${batterWords})\\b(?! (?:${battedBall})\\b)`)],
  ['single', /\b(?:single|singles|singled|base hit)\b/],
  ['double', /\b(?:double|doubles|doubled)\b/],
  ['triple', /\b(?:triple|triples|tripled)\b/],
  ['homer', /\b(?:homer|homers|homered|home run|went yard|goes yard)\b/],
  ['ground', /\b(?:ground|grounds|grounded|grounder|groundout)\b/],
  ['fly', /\b(?:fly|flies|flied|flyout)\b/],
  ['line', /\b(?:line out|lines out|lined|liner|lineout|line drive)\b/],
  ['popup', /\b(?:pop|pops|popped|popup)\b/],
  ['error', /\b(?:error|e[1-9])\b/],
  ['steal', /\b(?:steal|steals|stole|swipe|swipes|swiped)\b/],
  ['caught_stealing', /\b(?:caught stealing|thrown out stealing|out stealing)\b/],
  ['pickoff', /\b(?:picked off|pickoff)\b/],
  ['wild_pitch', /\bwild pitch\b/],
  ['passed_ball', /\bpassed ball\b/],
];

function commandOutcomes(commands: Command[]): Set<Outcome> {
  const found = new Set<Outcome>();
  for (const command of commands) {
    if (command.kind === 'pitch') {
      if (command.result === 'ball') found.add('ball');
      if (command.result === 'called_strike' || command.result === 'swinging_strike') found.add('strike');
      if (command.result === 'foul' || command.result === 'foul_tip') found.add('foul');
      if (command.result === 'hit_by_pitch') found.add('hbp');
    } else if (command.kind === 'ball_in_play') {
      const hit = { single: 'single', double: 'double', ground_rule_double: 'double', triple: 'triple', home_run: 'homer' } as const;
      if (command.outcome in hit) found.add(hit[command.outcome as keyof typeof hit]);
      if (command.outcome === 'error') found.add('error');
      if (command.outcome === 'out' && command.trajectory && command.trajectory !== 'bunt') found.add(command.trajectory);
    } else if (command.kind === 'runner') {
      const event = { stolen_base: 'steal', caught_stealing: 'caught_stealing', pickoff: 'pickoff', wild_pitch: 'wild_pitch', passed_ball: 'passed_ball' } as const;
      if (command.event in event) found.add(event[command.event as keyof typeof event]);
    }
  }
  return found;
}

/**
 * The echo check (B4): true when the words heard name an outcome the play doesn't have, or the play has an outcome
 * nobody said. Players and bases the engine filled in on its own aren't mismatches.
 */
export function echoMismatch(transcript: string, commands: Command[]): boolean {
  const text = transcript.toLowerCase().replace(/[^a-z0-9 -]/g, ' ').replace(/\s+/g, ' ');
  const heard = new Set(synonyms.filter(([, pattern]) => pattern.test(text)).map(([outcome]) => outcome));
  if (heard.has('caught_stealing')) heard.delete('steal');
  const played = commandOutcomes(commands);
  return [...played].some((outcome) => !heard.has(outcome)) || [...heard].some((outcome) => !played.has(outcome));
}
