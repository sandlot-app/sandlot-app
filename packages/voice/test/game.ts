import { applyGroup, presets } from '@sandlot/engine';
import type { Command, Event, GameSetup, LineupSlot, PlayerRef, Position, PresetKey } from '@sandlot/engine';
import { route, type Press } from '../src/route.ts';
import type { RosterEntry } from '../src/types.ts';

const positions: Position[] = ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'];
const away = positions.map((_, index) => ({ kind: 'opponent', id: `away-${index + 1}` }) as PlayerRef);
const home = positions.map((_, index) => ({ kind: 'player', id: `home-${index + 1}` }) as PlayerRef);

// The design's sample game: the Marlins bat first, so J. Soto leads off against T. Nguyen.
const awayNames = [['17', 'J. Soto'], ['3', 'L. Darcy'], ['8', 'C. Vance'], ['5', 'N. Cole'], ['11', 'P. Shah'], ['4', 'R. Diaz'], ['2', 'G. Ford'], ['14', 'H. Lin'], ['21', 'M. Webb']];
const homeNames = [['15', 'T. Nguyen'], ['12', 'M. Ortiz'], ['24', 'D. Park'], ['7', 'S. Bell'], ['3', 'A. Kindle'], ['6', 'J. Ruiz'], ['9', 'R. Hale'], ['1', 'K. Moss'], ['22', 'E. Brooks']];

export const roster: RosterEntry[] = [
  ...away.map((player, index) => ({ player, side: 'away' as const, number: awayNames[index]![0]!, name: awayNames[index]![1]! })),
  ...home.map((player, index) => ({ player, side: 'home' as const, number: homeNames[index]![0]!, name: homeNames[index]![1]! })),
];

export const player = (name: string): PlayerRef => roster.find((entry) => entry.name === name)!.player;

const lineup = (players: PlayerRef[]): LineupSlot[] => players.map((player, index) => ({ player, position: positions[index]! }));

export function setupFor(preset: PresetKey = 'moraga-mustang-second-half'): GameSetup {
  return { rules: presets[preset], roster: { home, away }, pitcherOutsEarlierToday: {} };
}

/** A started game with the given plays saved after it. Each play is checked by the engine as it's added. */
export function gameWith(plays: Command[][], setup = setupFor()): { setup: GameSetup; events: Event[]; roster: RosterEntry[] } {
  const events: Event[] = [];
  const add = (group: string, commands: Command[]) => {
    const result = applyGroup(setup, events, commands);
    if (!result.ok) throw new Error(`Test play ${group} was rejected: ${result.code}`);
    for (const command of commands) {
      events.push({
        id: `event-${events.length + 1}`, gameId: 'game-1', seq: events.length + 1, group, lockEpoch: 1, source: 'voice',
        at: '2026-10-26T17:00:00.000Z', command,
      } as Event);
    }
  };
  add('setup', [
    { kind: 'game', control: { kind: 'lineup_set', side: 'away', lineup: lineup(away) } },
    { kind: 'game', control: { kind: 'lineup_set', side: 'home', lineup: lineup(home) } },
    { kind: 'game', control: { kind: 'start', umpireStart: '2026-10-26T17:00:00.000Z' as never } },
  ]);
  plays.forEach((commands, index) => add(`play-${index + 1}`, commands));
  return { setup, events, roster };
}

/** A game reached by saying each phrase in turn, the way a scorer would, keeping the first reading of anything ambiguous. */
export function said(phrases: string[], setup = setupFor()) {
  let game = gameWith([], setup);
  const plays: Command[][] = [];
  for (const phrase of phrases) {
    const decision = route({ ...game, transcript: phrase, at: 0 });
    const commands = decision.kind === 'save' || decision.kind === 'confirm' ? decision.reading.commands
      : decision.kind === 'ask' ? decision.options[0]!.commands : null;
    if (!commands) throw new Error(`"${phrase}" did not record a play: ${JSON.stringify(decision)}`);
    plays.push(commands);
    game = gameWith(plays, setup);
  }
  return game;
}

export const press = (game: ReturnType<typeof gameWith>, transcript: string, extra: Partial<Press> = {}) =>
  route({ ...game, transcript, at: 10_000, ...extra });
