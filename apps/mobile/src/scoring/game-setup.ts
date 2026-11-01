import { applyGroup } from '@sandlot/engine';
import type { LineupSlot, PlayerRef, Position, RejectCode, TeamSide } from '@sandlot/engine';
import { demoLineups, gameSetup } from './demo-game.ts';
import type { SeasonHalf } from './demo-game.ts';
import { demoTeams, rosterDisplay, rosterName } from './demo-roster.ts';
import type { DemoAction, ServerGame } from './offline-game.ts';

// Game setup (Figma 167:11241) and a team's Lineup (168:11244), before the first pitch. The scorer's choices stay a
// draft on the phone until Start, which saves the season half, both lineups and the start as one play. Every edit
// returns a new lineup and never changes the one it started from. Names come from presentation data only (rule 5).

export type LineupDraft = { slots: LineupSlot[]; set: boolean };
export type SetupDraft = { half: SeasonHalf; lineups: Record<TeamSide, LineupDraft> };

/** The sample game's details, as Game setup shows them (Figma 167:11241). The day pre-fills the season half. */
export const demoGame = { day: '2026-10-24', when: 'Sat, Oct 24 · 6:30 PM', field: 'Field 2', division: 'Mustang · Moraga' };

/** The date the demo league switches to its second half (docs/design/spec-update-milestone-4.md, Game setup). */
const secondHalfFrom = { day: '2026-10-01', label: 'Oct 1' };

/** The season half a game on `day` (a local `YYYY-MM-DD` date) is pre-filled with. */
export function seasonHalfOn(day: string): SeasonHalf {
  return day >= secondHalfFrom.day ? 'second' : 'first';
}

/** The note under the Season half control, for a game on `day`. */
export function seasonHalfNote(day: string): string {
  const half = seasonHalfOn(day);
  const outs = gameSetup(half).rules.pitcherOutsPerDay;
  const when = half === 'second' ? `Second half since ${secondHalfFrom.label}` : `First half until ${secondHalfFrom.label}`;
  return `${when}, so pitchers can get ${outs} outs a day. Change it if your league switched on another date.`;
}

/** A new game's setup on `day`: the half from the league's switch date, and each team's sample lineup, not yet set. */
export function newSetupDraft(day: string): SetupDraft {
  return {
    half: seasonHalfOn(day),
    lineups: { home: { slots: demoLineups.home, set: false }, away: { slots: demoLineups.away, set: false } },
  };
}

/** Saves `side`'s lineup into the draft, or the engine's reason it can't be that team's lineup. */
export function saveLineup(draft: SetupDraft, side: TeamSide, slots: LineupSlot[]):
  { kind: 'saved'; draft: SetupDraft } | { kind: 'rejected'; code: RejectCode } {
  const checked = applyGroup(gameSetup(draft.half), [], [{ kind: 'game', control: { kind: 'lineup_set', side, lineup: slots } }]);
  if (!checked.ok) return { kind: 'rejected', code: checked.code };
  return { kind: 'saved', draft: { ...draft, lineups: { ...draft.lineups, [side]: { slots, set: true } } } };
}

/** True once the scorer has saved both lineups. */
export function canStart(draft: SetupDraft): boolean {
  return draft.lineups.home.set && draft.lineups.away.set;
}

/** The play Start records. The engine still decides whether the setup is legal. */
export function startAction(draft: SetupDraft, server?: ServerGame): DemoAction {
  return { kind: 'start', ...(server ? { server } : {}), half: draft.half,
    lineups: { home: draft.lineups.home.slots, away: draft.lineups.away.slots } };
}

/** A team's row in Game setup: "10 players · T. Nguyen pitching", or "Not set yet". */
export function lineupSummary(draft: SetupDraft, side: TeamSide): string {
  const lineup = draft.lineups[side];
  if (!lineup.set) return 'Not set yet';
  const pitcher = startingPitcher(lineup.slots);
  const players = `${lineup.slots.length} ${lineup.slots.length === 1 ? 'player' : 'players'}`;
  return pitcher ? `${players} · ${rosterName(pitcher)} pitching` : players;
}

/** What a lineup row's position pill reads. */
export function positionLabel(position: Position | null): string {
  return position ?? 'Bats only';
}

/** The player the lineup has pitching, who starts on the mound. */
export function startingPitcher(slots: LineupSlot[]): PlayerRef | null {
  return slots.find((slot) => slot.position === 'P')?.player ?? null;
}

/** Moves the batter at `from` to `to` in the batting order. */
export function movePlayer(slots: LineupSlot[], from: number, to: number): LineupSlot[] {
  const moved = [...slots];
  const [slot] = moved.splice(from, 1);
  if (slot) moved.splice(to, 0, slot);
  return moved;
}

/** Gives the batter at `index` `position`. A player who had it takes this batter's old position, so none is held twice. */
export function setPosition(slots: LineupSlot[], index: number, position: Position | null): LineupSlot[] {
  const previous = slots[index]?.position ?? null;
  return slots.map((slot, at) => {
    if (at === index) return { ...slot, position };
    if (position !== null && slot.position === position) return { ...slot, position: previous };
    return slot;
  });
}

/** Makes `player` the starting pitcher. */
export function setStartingPitcher(slots: LineupSlot[], player: PlayerRef): LineupSlot[] {
  const index = slots.findIndex((slot) => same(slot.player, player));
  return index < 0 ? slots : setPosition(slots, index, 'P');
}

/** Roster players not in the lineup, in roster order. */
export function benchPlayers(side: TeamSide, slots: LineupSlot[]): PlayerRef[] {
  return gameSetup('second').roster[side].filter((player) => !slots.some((slot) => same(slot.player, player)));
}

/** Adds `player` from the roster to the end of the batting order, without a position. */
export function addFromRoster(slots: LineupSlot[], player: PlayerRef): LineupSlot[] {
  return slots.some((slot) => same(slot.player, player)) ? slots : [...slots, { player, position: null }];
}

const same = (left: PlayerRef, right: PlayerRef) => left.kind === right.kind && left.id === right.id;

/** The names Game setup shows for each side: the sample game's Hawks and Marlins. */
export const teamName = (side: TeamSide) => demoTeams[side].name;

const positionNames: Record<Position, string> = {
  P: 'Pitcher', C: 'Catcher', '1B': 'First base', '2B': 'Second base', '3B': 'Third base', SS: 'Shortstop',
  LF: 'Left field', CF: 'Center field', RF: 'Right field', ROVER: 'Rover',
};
/** Every position a Mustang batter can be given, in the order the position list shows them, then none. */
const choosablePositions: (Position | null)[] = ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', null];

export type PositionChoice = { position: Position | null; label: string; note: string; selected: boolean };

/** The list shown when the scorer taps the position of the batter at `index`. A position another player holds says who swaps. */
export function positionChoices(slots: LineupSlot[], index: number): PositionChoice[] {
  const own = slots[index]?.position ?? null;
  return choosablePositions.map((position) => {
    const holder = position === null ? undefined : slots.find((slot, at) => at !== index && slot.position === position);
    const note = holder ? `Swaps with ${rosterName(holder.player)}` : position === null ? 'No fielding position' : positionNames[position];
    return { position, label: positionLabel(position), note, selected: position === own };
  });
}

export type PlayerChoice = { player: PlayerRef; number: string; name: string; note: string };

/** What a player may throw today, as the Bench Player Row note reads. Everyone is rested before the first pitch. */
const pitcherNote = (half: SeasonHalf) => {
  const limit = gameSetup(half).rules.pitchCountLimits?.limit;
  return limit ? `Fully rested · ${limit} pitches available today` : 'Fully rested';
};

/** The players the scorer can pick as the starting pitcher: everyone in the lineup, the current pitcher marked. */
export function pitcherChoices(half: SeasonHalf, slots: LineupSlot[]): (PlayerChoice & { selected: boolean })[] {
  const pitching = startingPitcher(slots);
  return slots.map((slot) => ({
    player: slot.player, ...rosterDisplay(slot.player), note: pitcherNote(half), selected: pitching !== null && same(slot.player, pitching),
  }));
}

/** The roster players the scorer can add to `side`'s lineup. */
export function addChoices(side: TeamSide, slots: LineupSlot[]): PlayerChoice[] {
  return benchPlayers(side, slots).map((player) => ({ player, ...rosterDisplay(player), note: 'Not in the lineup yet' }));
}

/** Why the engine refused a lineup or Start, in words a scorer can act on. */
export function setupRefusal(code: RejectCode): string {
  switch (code) {
    case 'no_pitcher': return 'Each team needs a starting pitcher. Choose one for the team that has none.';
    case 'unknown_player': return 'That player isn’t on this game’s roster, so the lineup wasn’t saved.';
    case 'game_already_started': return 'This game has already started, so its lineups can’t change.';
    default: return 'That lineup can’t be used. Check the batting order and positions.';
  }
}
