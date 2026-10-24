import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { deepStrictEqual } from 'node:assert';
import { parse } from 'yaml';
import { applyGroupFrom, replayFrom } from '../src/engine.ts';
import {
  applyGroup,
  initialState,
  presets,
  replay,
  type ApplyResult,
  type Command,
  type Event,
  type EventId,
  type GameId,
  type GameSetup,
  type GameState,
  type GroupId,
  type LineupSlot,
  type OpponentId,
  type PlayerId,
  type PlayerRef,
  type Position,
  type TeamSide,
  type Timestamp,
} from '../src/index.ts';

export type Fixture = {
  name: string;
  cite: string;
  preset: keyof typeof presets;
  rules?: Partial<GameSetup['rules']>;
  pending?: boolean;
  /** Replaces the standard roster: away-1 to away-12 as opponents, home-1 to home-12 as players. */
  roster?: GameSetup['roster'];
  /** Plays the standard opening first: both teams' first nine in order P, C, 1B, ..., RF, then start. */
  started?: boolean;
  /** Overrides top-level keys of the state the plays start from, after the opening when `started`. */
  given?: Partial<GameState>;
  /** Plays in order. Each play is a list of commands. */
  when: Command[][];
  /** Each top-level key must equal the final state's, or the last play must be rejected with this code. */
  then: Partial<GameState> | { rejected: string };
};

export const fixtureRoot = join(import.meta.dirname, '..', 'fixtures');
const POSITIONS: Position[] = ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'];

const ref = (side: TeamSide, n: number): PlayerRef =>
  side === 'home' ? { kind: 'player', id: `home-${n}` as PlayerId } : { kind: 'opponent', id: `away-${n}` as OpponentId };
const team = (side: TeamSide, size: number) => Array.from({ length: size }, (_, i) => ref(side, i + 1));
const standardLineup = (side: TeamSide): LineupSlot[] =>
  POSITIONS.map((position, i) => ({ player: ref(side, i + 1), position }));
const opening: Command[][] = [
  [{ kind: 'game', control: { kind: 'lineup_set', side: 'away', lineup: standardLineup('away') } }],
  [{ kind: 'game', control: { kind: 'lineup_set', side: 'home', lineup: standardLineup('home') } }],
  [{ kind: 'game', control: { kind: 'start', umpireStart: '2026-10-25T17:00:00.000Z' as Timestamp } }],
];

export function loadFixture(file: string): Fixture {
  const data = parse(readFileSync(file, 'utf8')) as Fixture;
  for (const key of ['name', 'cite', 'preset', 'when', 'then'] as const) {
    if (data[key] === undefined) throw new Error(`${file}: missing "${key}"`);
  }
  if (!(data.preset in presets)) throw new Error(`${file}: unknown preset "${data.preset}"`);
  if (!data.when.every(Array.isArray)) throw new Error(`${file}: "when" must be a list of plays, each a list of commands`);
  return data;
}

/** Turns plays into the events the scorer's phone would have stored. */
function toEvents(plays: Command[][]): Event[] {
  let seq = 0;
  return plays.flatMap((commands, play) =>
    commands.map((command): Event => {
      seq += 1;
      return {
        id: `event-${seq}` as EventId,
        gameId: 'fixture' as GameId,
        seq,
        group: `play-${play + 1}` as GroupId,
        lockEpoch: 1,
        source: 'tap',
        at: '2026-10-25T17:00:00.000Z' as Timestamp,
        command,
      };
    }),
  );
}

function setupFor(fixture: Fixture): GameSetup {
  return {
    rules: { ...presets[fixture.preset], ...fixture.rules },
    roster: fixture.roster ?? { home: team('home', 12), away: team('away', 12) },
    pitcherOutsEarlierToday: {},
  };
}

/** Where the fixture's plays start from: the given state, after the opening when `started`. */
function startingState(fixture: Fixture, setup: GameSetup): GameState {
  let state = initialState(setup);
  if (fixture.started) {
    const opened = replay(setup, toEvents(opening));
    if (!opened.ok) throw new Error(`the standard opening was rejected: ${opened.code}`);
    state = opened.state;
  }
  return { ...state, ...fixture.given };
}

/** Applies each play through `applyGroup`, then checks that replaying every event gives the same state. */
export function runFixture(fixture: Fixture): ApplyResult {
  const setup = setupFor(fixture);
  const from = startingState(fixture, setup);
  const fromPregame = !fixture.started && !fixture.given;
  let result: ApplyResult = { ok: true, state: from };
  for (const [i, commands] of fixture.when.entries()) {
    const events = toEvents(fixture.when.slice(0, i));
    result = fromPregame ? applyGroup(setup, events, commands) : applyGroupFrom(setup, from, events, commands);
    if (!result.ok) {
      if (i < fixture.when.length - 1) throw new Error(`play ${i + 1} of ${fixture.when.length} was rejected: ${result.code}`);
      return result;
    }
  }
  const events = toEvents(fixture.when);
  deepStrictEqual(fromPregame ? replay(setup, events) : replayFrom(setup, from, events), result);
  return result;
}

export const fixtureFiles = readdirSync(fixtureRoot, { recursive: true, encoding: 'utf8' })
  .filter((file) => file.endsWith('.yaml'))
  .map((file) => file.replaceAll('\\', '/'))
  .sort()
  .map((file) => join(fixtureRoot, file));

export function checkFixture(fixture: Fixture, result: ApplyResult): void {
  if ('rejected' in fixture.then) {
    deepStrictEqual(result, { ok: false, code: fixture.then.rejected });
    return;
  }
  if (!result.ok) throw new Error(`${fixture.name}: rejected with ${result.code}`);
  for (const [key, value] of Object.entries(fixture.then)) {
    deepStrictEqual(result.state[key as keyof GameState], value, `${fixture.name}: ${key}`);
  }
}
