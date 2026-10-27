import {
  applyGroup,
  ENGINE_VERSION,
  EVENT_SCHEMA_VERSION,
  parseUploadRequest,
  replay,
} from '@sandlot/engine';
import type {
  Advance,
  BallInPlayOutcome,
  Command,
  Destination,
  Event,
  EventId,
  GameId,
  GameState,
  GroupId,
  PitchResult,
  PlayerRef,
  Position,
  Trajectory,
  RejectCode,
  Timestamp,
} from '@sandlot/engine';
import type { SqlConnection, SqlDatabase } from './database.ts';
import { demoLineups, demoSetup } from './demo-game.ts';

export type DemoAction =
  | { kind: 'start' }
  | { kind: 'pitch'; result: Exclude<PitchResult, 'in_play'> }
  /** `expectedRevision` pins a spoken undo to the game its press started on. */
  | { kind: 'undo'; expectedRevision?: number }
  | { kind: 'ball_in_play'; at: string; expectedRevision: number; outcome: BallInPlayOutcome;
      trajectory: Trajectory | null; fielders: Position[]; advances: Advance[] }
  | { kind: 'runner_play'; at: string; expectedRevision: number;
      event: 'steal' | 'wild_pitch' | 'passed_ball' | 'pickoff';
      moves: { runner: PlayerRef; to: Destination }[] }
  /** A reading the scorer said, as route() proposed it. The engine checks it like any other play (rule 6). */
  | { kind: 'voice'; at: string; expectedRevision: number; commands: Command[] };

export type SavedGame = {
  id: GameId;
  revision: number;
  state: GameState;
  /** The saved events, so voice can replay the game when it routes a press. */
  events: Event[];
  waitingPlays: number;
  canUndo: boolean;
  /** The commands of the play Undo would take back, or null when there is none. */
  lastPlay: Command[] | null;
  /** That play's pitch, counted for the pitcher who threw it, or null when it had no pitch. */
  lastPitchNumber: number | null;
  context: { kind: 'local_demo' };
};

type BlockReason = 'storage' | 'version' | 'corrupt';
export type RecordResult =
  | { kind: 'saved'; game: SavedGame }
  | { kind: 'rejected'; code: RejectCode }
  | { kind: 'stale'; game: SavedGame }
  | { kind: 'busy' }
  | { kind: 'unsaved' }
  | { kind: 'blocked'; reason: BlockReason };

export type OpenResult =
  | {
      kind: 'ready';
      game: SavedGame | null;
      record(action: DemoAction): Promise<RecordResult>;
    }
  | { kind: 'blocked'; reason: BlockReason };

type Boundary = { newId(): string; now(): string };
type GameRow = {
  id: string;
  setup_json: string;
  engine_version: string;
  schema_version: number;
  context: string;
  bootstrap_group: string;
};
type EventRow = {
  game_id: string;
  seq: number;
  event_id: string;
  group_id: string;
  event_json: string;
};
type OutboxRow = {
  game_id: string;
  group_id: string;
  first_seq: number;
  event_count: number;
};
type LoadedGame = {
  row: GameRow;
  events: Event[];
  groups: Event[][];
  game: SavedGame;
};

class SavedDataError extends Error {
  readonly reason: 'version' | 'corrupt';
  constructor(reason: 'version' | 'corrupt') {
    super(reason);
    this.reason = reason;
  }
}

const formatVersion = 1;

async function initialize(database: SqlDatabase): Promise<void> {
  await database.transaction(async (connection) => {
    const version = (
      await connection.all<{ user_version: number }>('PRAGMA user_version')
    )[0]?.user_version;
    if (version === formatVersion) return;
    if (version !== 0) throw new SavedDataError('version');
    const tables = await connection.all<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'",
    );
    if (tables.length) throw new SavedDataError('corrupt');
    await connection.exec(`
      CREATE TABLE local_games (
        slot INTEGER PRIMARY KEY CHECK (slot = 1), id TEXT NOT NULL UNIQUE,
        setup_json TEXT NOT NULL, engine_version TEXT NOT NULL, schema_version INTEGER NOT NULL,
        context TEXT NOT NULL CHECK (context = 'local_demo'), bootstrap_group TEXT NOT NULL
      );
      CREATE TABLE local_events (
        game_id TEXT NOT NULL REFERENCES local_games(id), seq INTEGER NOT NULL CHECK (seq > 0),
        event_id TEXT NOT NULL, group_id TEXT NOT NULL, event_json TEXT NOT NULL,
        PRIMARY KEY (game_id, seq), UNIQUE (game_id, event_id)
      );
      CREATE TABLE local_outbox (
        game_id TEXT NOT NULL, group_id TEXT NOT NULL, first_seq INTEGER NOT NULL,
        event_count INTEGER NOT NULL CHECK (event_count > 0), PRIMARY KEY (game_id, group_id),
        UNIQUE (game_id, first_seq), FOREIGN KEY (game_id, first_seq) REFERENCES local_events(game_id, seq)
      );
      PRAGMA user_version = 1;
    `);
  });
}

async function load(connection: SqlConnection): Promise<LoadedGame | null> {
  const version = (
    await connection.all<{ user_version: number }>('PRAGMA user_version')
  )[0]?.user_version;
  if (version !== formatVersion) throw new SavedDataError('version');
  const rows = await connection.all<GameRow>(
    'SELECT id, setup_json, engine_version, schema_version, context, bootstrap_group FROM local_games',
  );
  const eventRows = await connection.all<EventRow>(
    'SELECT * FROM local_events ORDER BY seq',
  );
  const outbox = await connection.all<OutboxRow>(
    'SELECT * FROM local_outbox ORDER BY first_seq',
  );
  if (!rows.length) {
    if (eventRows.length || outbox.length) throw new SavedDataError('corrupt');
    return null;
  }
  const row = rows[0]!;
  if (rows.length !== 1) throw new SavedDataError('corrupt');
  if (
    row.engine_version !== ENGINE_VERSION ||
    row.schema_version !== EVENT_SCHEMA_VERSION
  )
    throw new SavedDataError('version');
  if (
    row.context !== 'local_demo' ||
    row.setup_json !== JSON.stringify(demoSetup)
  )
    throw new SavedDataError('corrupt');
  const groups: Event[][] = [];
  try {
    for (const entry of eventRows) {
      const event: unknown = JSON.parse(entry.event_json);
      if (typeof event !== 'object' || event === null || !('group' in event))
        throw new SavedDataError('corrupt');
      if (groups.at(-1)?.[0]?.group !== event.group) groups.push([]);
      const group = groups.at(-1)!;
      group.push(event as Event);
    }
  } catch {
    throw new SavedDataError('corrupt');
  }
  const events: Event[] = [];
  const seenGroups = new Set<string>();
  for (const group of groups) {
    const parsed = parseUploadRequest({
      schemaVersion: row.schema_version,
      sessionId: row.id,
      events: group,
    });
    const first = group[0]!;
    if (!parsed.ok || seenGroups.has(first.group))
      throw new SavedDataError('corrupt');
    seenGroups.add(first.group);
    for (const event of parsed.request.events) {
      const stored = eventRows[events.length]!;
      if (
        event.gameId !== row.id ||
        event.lockEpoch !== 1 ||
        (event.source !== 'tap' && event.source !== 'voice') ||
        event.seq !== events.length + 1 ||
        stored.game_id !== row.id ||
        stored.seq !== event.seq ||
        stored.event_id !== event.id ||
        stored.group_id !== event.group
      ) {
        throw new SavedDataError('corrupt');
      }
      events.push(event);
    }
  }
  if (
    !events.length ||
    outbox.length !== groups.length ||
    groups[0]?.[0]?.group !== row.bootstrap_group
  )
    throw new SavedDataError('corrupt');
  if (
    groups[0]?.length !== 3 ||
    groups[0].some((event) => event.command.kind !== 'game')
  )
    throw new SavedDataError('corrupt');
  for (let index = 0; index < groups.length; index += 1) {
    const group = groups[index]!;
    const pending = outbox[index]!;
    if (
      pending.game_id !== row.id ||
      pending.group_id !== group[0]!.group ||
      pending.first_seq !== group[0]!.seq ||
      pending.event_count !== group.length
    ) {
      throw new SavedDataError('corrupt');
    }
  }
  const result = replay(demoSetup, events);
  if (!result.ok || result.state.status === 'pregame')
    throw new SavedDataError('corrupt');
  const last = activePlays(groups, row.bootstrap_group).at(-1);
  return {
    row,
    events,
    groups,
    game: {
      id: row.id as GameId,
      revision: events.length,
      state: result.state,
      events,
      waitingPlays: outbox.length,
      canUndo: undoTarget(groups, row.bootstrap_group) !== null,
      lastPlay: last?.map((event) => event.command) ?? null,
      lastPitchNumber: last ? pitchNumber(events, last, result.state) : null,
      context: { kind: 'local_demo' },
    },
  };
}

function activePlays(groups: Event[][], bootstrap: string): Event[][] {
  const active: Event[][] = [];
  for (const group of groups) {
    const first = group[0]!;
    if (first.command.kind === 'undo') active.pop();
    else if (first.group !== bootstrap) active.push(group);
  }
  return active;
}

/** The pitcher's count after `play`'s pitch. The pitcher is read from the state before the play, since a third out changes sides. */
function pitchNumber(events: Event[], play: Event[], after: GameState): number | null {
  if (!play.some((event) => event.command.kind === 'pitch')) return null;
  const before = applyGroup(demoSetup, events, [{ kind: 'undo', target: play[0]!.group }]);
  if (!before.ok) return null;
  const pitcher = before.state.pitchers[before.state.half === 'top' ? 'home' : 'away'];
  return pitcher ? (after.pitchCounts[pitcher.id] ?? null) : null;
}

function undoTarget(groups: Event[][], bootstrap: string): GroupId | null {
  return activePlays(groups, bootstrap).at(-1)?.[0]!.group ?? null;
}

function blocked(error: unknown): { kind: 'blocked'; reason: BlockReason } {
  return {
    kind: 'blocked',
    reason: error instanceof SavedDataError ? error.reason : 'storage',
  };
}

export async function openOfflineGame(
  database: SqlDatabase,
  boundary: Boundary,
): Promise<OpenResult> {
  try {
    await initialize(database);
    const snapshot: { loaded: LoadedGame | null } = { loaded: null };
    await database.transaction(async (connection) => {
      snapshot.loaded = await load(connection);
    });
    let saving = false;
    let stopped: BlockReason | null = null;
    return {
      kind: 'ready',
      game: snapshot.loaded?.game ?? null,
      async record(action) {
        if (stopped) return { kind: 'blocked', reason: stopped };
        if (saving) return { kind: 'busy' };
        saving = true;
        let group: GroupId | null = null;
        let attempted = false;
        let result: RecordResult = { kind: 'blocked', reason: 'storage' };
        try {
          const at = ('at' in action ? action.at : boundary.now()) as Timestamp;
          group = boundary.newId() as GroupId;
          const savedGroup = group;
          await database.transaction(async (connection) => {
            const current = await load(connection);
            if (action.kind === 'start' && current) {
              result = { kind: 'saved', game: current.game };
              return;
            }
            if (action.kind !== 'start' && !current) {
              result = { kind: 'rejected', code: 'game_not_started' };
              return;
            }
            if ('expectedRevision' in action && action.expectedRevision !== current!.game.revision) {
              result = { kind: 'stale', game: current!.game };
              return;
            }
            let commands: Command[];
            if (action.kind === 'start')
              commands = [
                {
                  kind: 'game',
                  control: {
                    kind: 'lineup_set',
                    side: 'away',
                    lineup: demoLineups.away,
                  },
                },
                {
                  kind: 'game',
                  control: {
                    kind: 'lineup_set',
                    side: 'home',
                    lineup: demoLineups.home,
                  },
                },
                { kind: 'game', control: { kind: 'start', umpireStart: at } },
              ];
            else if (action.kind === 'pitch')
              commands = [{ kind: 'pitch', result: action.result }];
            else if (action.kind === 'ball_in_play')
              commands = [
                { kind: 'pitch', result: 'in_play' },
                { kind: 'ball_in_play', outcome: action.outcome, trajectory: action.trajectory,
                  fielders: action.fielders, advances: action.advances },
              ];
            else if (action.kind === 'runner_play') {
              if (!action.moves.length) {
                result = { kind: 'rejected', code: 'invalid_runner_destination' };
                return;
              }
              if (new Set(action.moves.map((move) => `${move.runner.kind}:${move.runner.id}`)).size !== action.moves.length) {
                result = { kind: 'rejected', code: 'duplicate_runner' };
                return;
              }
              const startingBase = (runner: PlayerRef) =>
                ([1, 2, 3] as const).find((base) => {
                  const player = current!.game.state.bases[base]?.player;
                  return player?.kind === runner.kind && player.id === runner.id;
                }) ?? 0;
              const moves = [...action.moves].sort((left, right) => {
                if (left.to === 'out' || right.to === 'out')
                  return Number(left.to === 'out') - Number(right.to === 'out');
                return startingBase(right.runner) - startingBase(left.runner);
              });
              commands = moves.map((move) => ({ kind: 'runner', runner: move.runner, to: move.to,
                event: action.event === 'steal'
                  ? move.to === 'out' ? 'caught_stealing' : 'stolen_base'
                  : action.event }));
            }
            else if (action.kind === 'voice') {
              // A spoken press records plays only. Lineups, substitutions, corrections and undo have their own controls.
              const plays: Command['kind'][] = ['pitch', 'ball_in_play', 'runner', 'batter_out'];
              if (!action.commands.length || action.commands.some((command) => !plays.includes(command.kind))) {
                result = { kind: 'rejected', code: 'not_implemented' };
                return;
              }
              commands = action.commands;
            }
            else {
              const target = undoTarget(
                current!.groups,
                current!.row.bootstrap_group,
              );
              if (!target) {
                result = { kind: 'rejected', code: 'nothing_to_undo' };
                return;
              }
              commands = [{ kind: 'undo', target }];
            }
            const accepted = applyGroup(
              demoSetup,
              current?.events ?? [],
              commands,
            );
            if (!accepted.ok) {
              result = { kind: 'rejected', code: accepted.code };
              return;
            }
            if (current?.events.some((event) => event.group === savedGroup))
              throw new Error('A new play needs a new identity');
            attempted = true;
            const gameId = current?.row.id ?? boundary.newId();
            if (!current)
              await connection.run(
                'INSERT INTO local_games VALUES (1, ?, ?, ?, ?, ?, ?)',
                [
                  gameId,
                  JSON.stringify(demoSetup),
                  ENGINE_VERSION,
                  EVENT_SCHEMA_VERSION,
                  'local_demo',
                  savedGroup,
                ],
              );
            const events: Event[] = commands.map((command, index) => ({
              id: boundary.newId() as EventId,
              gameId: gameId as GameId,
              seq: (current?.events.length ?? 0) + index + 1,
              group: savedGroup,
              lockEpoch: 1,
              source: action.kind === 'voice' ? 'voice' : 'tap',
              at,
              command,
            }));
            for (const event of events)
              await connection.run(
                'INSERT INTO local_events VALUES (?, ?, ?, ?, ?)',
                [
                  gameId,
                  event.seq,
                  event.id,
                  savedGroup,
                  JSON.stringify(event),
                ],
              );
            await connection.run(
              'INSERT INTO local_outbox VALUES (?, ?, ?, ?)',
              [gameId, savedGroup, events[0]!.seq, events.length],
            );
            result = { kind: 'saved', game: (await load(connection))!.game };
          });
          return result;
        } catch (error) {
          if (error instanceof SavedDataError) {
            stopped = error.reason;
            return blocked(error);
          }
          try {
            const recovery: { saved: LoadedGame | null } = { saved: null };
            await database.transaction(async (connection) => {
              recovery.saved = await load(connection);
            });
            if (
              attempted &&
              recovery.saved?.events.some((event) => event.group === group)
            ) {
              return { kind: 'saved', game: recovery.saved.game };
            }
            return { kind: 'unsaved' };
          } catch (recoveryError) {
            const failure = blocked(recoveryError);
            stopped = failure.reason;
            return failure;
          }
        } finally {
          saving = false;
        }
      },
    };
  } catch (error) {
    return blocked(error);
  }
}
