import type { GameSetup, TeamSide } from '@sandlot/engine';

/** How the page names a game's teams and players. Public, so players go by number and never by name. */
export type Roster = {
  teams: Record<TeamSide, { name: string; short: string }>;
  /** Whether the page knows the players' jersey numbers. */
  numbered: boolean;
  /** The number on a player's chip, or a dash when the page doesn't know it. */
  number: (playerId: string) => string;
  /** How a sentence names a player: "#17", or the ID when the page has no number for them. */
  label: (playerId: string) => string;
};

// Games don't store team names or jersey numbers yet. The demo game's come from
// apps/mobile/src/scoring/demo-roster.ts, numbers only.
const HAWKS = { name: 'Hawks', short: 'HAW' };
const MARLINS = { name: 'Marlins', short: 'MAR' };

const DEMO_JERSEYS: Readonly<Record<string, string>> = {
  'home-1': '15',
  'home-2': '12',
  'home-3': '24',
  'home-4': '7',
  'home-5': '3',
  'home-6': '6',
  'home-7': '9',
  'home-8': '1',
  'home-9': '22',
  'home-10': '18',
  'away-1': '17',
  'away-2': '3',
  'away-3': '8',
  'away-4': '5',
  'away-5': '11',
  'away-6': '4',
  'away-7': '2',
  'away-8': '14',
  'away-9': '21',
};

const SIDES: Roster['teams'] = { home: { name: 'Home', short: 'HOM' }, away: { name: 'Away', short: 'AWY' } };

/**
 * The demo game's names and numbers when every player in the game is a demo player. Any other game is Away and Home,
 * with players by ID in sentences and a dash on a chip, since a made-up number would read as a jersey number.
 */
export function rosterFor(setup: Pick<GameSetup, 'roster'>): Roster {
  const players = [...setup.roster.away, ...setup.roster.home];
  if (players.length > 0 && players.every((player) => Object.hasOwn(DEMO_JERSEYS, player.id))) {
    // The Hawks are the team the family follows, so their players are `player`s and the Marlins' are `opponent`s. The
    // phone's sample game has the Hawks away; the engine's sample half-inning has them at home. Either way the page
    // names a side by who is on it.
    const hawksAway = setup.roster.away.some((player) => player.kind === 'player');
    return {
      teams: hawksAway ? { away: HAWKS, home: MARLINS } : { away: MARLINS, home: HAWKS },
      numbered: true,
      number: (id) => (Object.hasOwn(DEMO_JERSEYS, id) ? DEMO_JERSEYS[id]! : id),
      label: (id) => (Object.hasOwn(DEMO_JERSEYS, id) ? `#${DEMO_JERSEYS[id]}` : id),
    };
  }
  return { teams: SIDES, numbered: false, number: () => '–', label: (id) => id };
}
