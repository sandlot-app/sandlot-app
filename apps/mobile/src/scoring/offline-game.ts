import {
  applyGroup,
  ENGINE_VERSION,
  EVENT_SCHEMA_VERSION,
  parseUploadRequest,
  presets,
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
  GameSetup,
  GameState,
  GroupId,
  LineupSlot,
  PitchResult,
  PlayerRef,
  Position,
  TeamSide,
  Trajectory,
  RejectCode,
  SessionId,
  Timestamp,
  UploadRequest,
} from '@sandlot/engine';
import type { SqlConnection, SqlDatabase } from './database.ts';
import { demoLineups, gameSetup } from './demo-game.ts';
import type { SeasonHalf } from './demo-game.ts';

/**
 * The setup games saved before the sample moved to the second half and the Hawks moved to the away side were stored
 * with: first-half rules, a nine-player Hawks roster on the home side and the Marlins on the away side. Such a game
 * reopens and replays under that stored setup, so it isn't read as corrupt.
 */
const legacySetup = {
  rules: presets['moraga-mustang-first-half'],
  roster: {
    home: Array.from({ length: 9 }, (_, index) => ({ kind: 'player', id: `home-${index + 1}` })),
    away: Array.from({ length: 9 }, (_, index) => ({ kind: 'opponent', id: `away-${index + 1}` })),
  },
  pitcherOutsEarlierToday: {},
} as unknown as GameSetup;
const legacySetupJson = JSON.stringify(legacySetup);

/** The game and scoring session the server issued this phone, from the seed script (docs/contract.md, Demo access). */
export type ServerGame = { gameId: string; sessionId: string; lockEpoch: number };

export type DemoAction =
  /**
   * With `server`, the new game is the server's game and its plays upload. Without it, the game stays on this phone.
   * `half` and `lineups` are what the scorer chose in Game setup; without them the game is the second-half sample game.
   */
  | { kind: 'start'; server?: ServerGame; half?: SeasonHalf; lineups?: Record<TeamSide, LineupSlot[]> }
  | { kind: 'pitch'; result: Exclude<PitchResult, 'in_play'> }
  /** `expectedRevision` pins a spoken undo to the game its press started on. */
  | { kind: 'undo'; expectedRevision?: number }
  | { kind: 'ball_in_play'; at: string; expectedRevision: number; outcome: BallInPlayOutcome;
      trajectory: Trajectory | null; fielders: Position[]; advances: Advance[] }
  | { kind: 'runner_play'; at: string; expectedRevision: number;
      event: 'steal' | 'wild_pitch' | 'passed_ball' | 'pickoff';
      moves: { runner: PlayerRef; to: Destination }[] }
  /** A reading the scorer said, as decide() proposed it. The engine checks it like any other play (rule 6). */
  | { kind: 'voice'; at: string; expectedRevision: number; commands: Command[] };

export type SavedGame = {
  id: GameId;
  /** The roster and rules the game was set up with, by player ID. Replay the events with it. */
  setup: GameSetup;
  revision: number;
  state: GameState;
  /** The saved events, so voice can replay the game when it routes a press. */
  events: Event[];
  /** Plays the server hasn't acknowledged. A local demo game never uploads, so all of its plays wait. */
  waitingPlays: number;
  canUndo: boolean;
  /** The commands of the play Undo would take back, or null when there is none. */
  lastPlay: Command[] | null;
  /** That play's pitch, counted for the pitcher who threw it, or null when it had no pitch. */
  lastPitchNumber: number | null;
  context: { kind: 'local_demo' } | { kind: 'synced'; sessionId: string; lockEpoch: number };
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
      /** The first play the server hasn't acknowledged, as the upload request it is sent in, or null when none waits. */
      nextUpload(): Promise<UploadRequest | null>;
      /**
       * Records the server's acknowledgment of `group`, the play `nextUpload` offered, ending at `revision`. Returns the
       * game after it, or null when `group` isn't the next waiting play or `revision` isn't its last event.
       */
      acknowledge(group: string, revision: number): Promise<SavedGame | null>;
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
type SyncRow = { game_id: string; session_id: string; lock_epoch: number };
type AckRow = { game_id: string; group_id: string; ack_revision: number };
type LoadedGame = {
  row: GameRow;
  sync: SyncRow | null;
  acknowledged: number;
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

const formatVersion = 2;

// Format 2 adds the server's session for a synced game and the plays the server has acknowledged. A format 1
// database only ever held a local demo game, so it gains the two empty tables and keeps every saved play as it was.
const syncTables = `
  CREATE TABLE local_sync (
    slot INTEGER PRIMARY KEY CHECK (slot = 1), game_id TEXT NOT NULL REFERENCES local_games(id),
    session_id TEXT NOT NULL, lock_epoch INTEGER NOT NULL CHECK (lock_epoch > 0)
  );
  CREATE TABLE local_acks (
    game_id TEXT NOT NULL, group_id TEXT NOT NULL, ack_revision INTEGER NOT NULL,
    PRIMARY KEY (game_id, group_id), UNIQUE (game_id, ack_revision),
    FOREIGN KEY (game_id, group_id) REFERENCES local_outbox(game_id, group_id)
  );
  PRAGMA user_version = 2;
`;

async function initialize(database: SqlDatabase): Promise<void> {
  await database.transaction(async (connection) => {
    const version = (
      await connection.all<{ user_version: number }>('PRAGMA user_version')
    )[0]?.user_version;
    if (version === formatVersion) return;
    if (version === 1) {
      await connection.exec(syncTables);
      return;
    }
    if (version !== 0) throw new SavedDataError('version');
    const tables = await connection.all<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'",
    );
    if (tables.length) throw new SavedDataError('corrupt');
    await connection.exec(`
      CREATE TABLE local_games (
        slot INTEGER PRIMARY KEY CHECK (slot = 1), id TEXT NOT NULL UNIQUE,
        setup_json TEXT NOT NULL, engine_version TEXT NOT NULL, schema_version INTEGER NOT NULL,
        context TEXT NOT NULL CHECK (context IN ('local_demo', 'synced')), bootstrap_group TEXT NOT NULL
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
    ` + syncTables);
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
  const syncRows = await connection.all<SyncRow>('SELECT game_id, session_id, lock_epoch FROM local_sync');
  const acks = await connection.all<AckRow>('SELECT * FROM local_acks ORDER BY ack_revision');
  if (!rows.length) {
    if (eventRows.length || outbox.length || syncRows.length || acks.length) throw new SavedDataError('corrupt');
    return null;
  }
  const row = rows[0]!;
  if (rows.length !== 1) throw new SavedDataError('corrupt');
  if (
    row.engine_version !== ENGINE_VERSION ||
    row.schema_version !== EVENT_SCHEMA_VERSION
  )
    throw new SavedDataError('version');
  const sync = syncRows[0] ?? null;
  if (
    row.context !== (sync ? 'synced' : 'local_demo') ||
    (sync && sync.game_id !== row.id) ||
    syncRows.length > 1
  )
    throw new SavedDataError('corrupt');
  const half = (['first', 'second'] as const).find((option) => row.setup_json === JSON.stringify(gameSetup(option)));
  const setup = half ? gameSetup(half) : row.setup_json === legacySetupJson ? legacySetup : null;
  if (!setup) throw new SavedDataError('corrupt');
  const lockEpoch = sync?.lock_epoch ?? 1;
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
      sessionId: sync?.session_id ?? row.id,
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
        event.lockEpoch !== lockEpoch ||
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
  // The server acknowledges plays in order, so the acknowledged plays are the first ones, each ending at its last seq.
  if (acks.length > (sync ? outbox.length : 0)) throw new SavedDataError('corrupt');
  acks.forEach((ack, index) => {
    const pending = outbox[index]!;
    if (ack.game_id !== row.id || ack.group_id !== pending.group_id || ack.ack_revision !== pending.first_seq + pending.event_count - 1)
      throw new SavedDataError('corrupt');
  });
  const result = replay(setup, events);
  if (!result.ok || result.state.status === 'pregame')
    throw new SavedDataError('corrupt');
  const last = activePlays(groups, row.bootstrap_group).at(-1);
  return {
    row,
    sync,
    acknowledged: acks.length,
    events,
    groups,
    game: {
      id: row.id as GameId,
      setup,
      revision: events.length,
      state: result.state,
      events,
      waitingPlays: outbox.length - acks.length,
      canUndo: undoTarget(groups, row.bootstrap_group) !== null,
      lastPlay: last?.map((event) => event.command) ?? null,
      lastPitchNumber: last ? pitchNumber(setup, events, last, result.state) : null,
      context: sync ? { kind: 'synced', sessionId: sync.session_id, lockEpoch } : { kind: 'local_demo' },
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
function pitchNumber(setup: GameSetup, events: Event[], play: Event[], after: GameState): number | null {
  if (!play.some((event) => event.command.kind === 'pitch')) return null;
  const before = applyGroup(setup, events, [{ kind: 'undo', target: play[0]!.group }]);
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
    // One storage task at a time, so a play being saved and an upload being acknowledged never interleave.
    let queue: Promise<unknown> = Promise.resolve();
    const serial = <T,>(task: () => Promise<T>): Promise<T> => {
      const run = queue.then(task, task);
      queue = run.catch(() => undefined);
      return run;
    };
    const read = <T,>(task: (loaded: LoadedGame | null, connection: SqlConnection) => Promise<T>): Promise<T | null> =>
      serial(async () => {
        if (stopped) return null;
        const answer: { value: T | null } = { value: null };
        try {
          await database.transaction(async (connection) => {
            answer.value = await task(await load(connection), connection);
          });
        } catch (error) {
          if (error instanceof SavedDataError) stopped = error.reason;
          return null;
        }
        return answer.value;
      });
    return {
      kind: 'ready',
      game: snapshot.loaded?.game ?? null,
      nextUpload: () => read(async (loaded) => {
        const group = loaded?.sync ? loaded.groups[loaded.acknowledged] : undefined;
        if (!loaded?.sync || !group) return null;
        return { schemaVersion: EVENT_SCHEMA_VERSION, sessionId: loaded.sync.session_id as SessionId, events: group };
      }),
      acknowledge: (group, revision) => read(async (loaded, connection) => {
        const next = loaded?.sync ? loaded.groups[loaded.acknowledged] : undefined;
        if (!loaded || !next || next[0]!.group !== group || next.at(-1)!.seq !== revision) return null;
        await connection.run('INSERT INTO local_acks VALUES (?, ?, ?)', [loaded.row.id, group, revision]);
        return (await load(connection))!.game;
      }),
      record(action) {
        if (stopped) return Promise.resolve({ kind: 'blocked', reason: stopped });
        if (saving) return Promise.resolve({ kind: 'busy' });
        saving = true;
        return serial(async (): Promise<RecordResult> => {
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
              if ('expectedRevision' in action && action.expectedRevision !== undefined && action.expectedRevision !== current!.game.revision) {
                result = { kind: 'stale', game: current!.game };
                return;
              }
              const setup = current?.game.setup ?? gameSetup((action.kind === 'start' && action.half) || 'second');
              const lineups = (action.kind === 'start' && action.lineups) || demoLineups;
              let commands: Command[];
              if (action.kind === 'start')
                commands = [
                  {
                    kind: 'game',
                    control: {
                      kind: 'lineup_set',
                      side: 'away',
                      lineup: lineups.away,
                    },
                  },
                  {
                    kind: 'game',
                    control: {
                      kind: 'lineup_set',
                      side: 'home',
                      lineup: lineups.home,
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
                setup,
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
              const server = action.kind === 'start' ? action.server : undefined;
              const gameId = current?.row.id ?? server?.gameId ?? boundary.newId();
              const lockEpoch = current?.sync?.lock_epoch ?? server?.lockEpoch ?? 1;
              if (!current) {
                await connection.run(
                  'INSERT INTO local_games VALUES (1, ?, ?, ?, ?, ?, ?)',
                  [
                    gameId,
                    JSON.stringify(setup),
                    ENGINE_VERSION,
                    EVENT_SCHEMA_VERSION,
                    server ? 'synced' : 'local_demo',
                    savedGroup,
                  ],
                );
                if (server)
                  await connection.run('INSERT INTO local_sync VALUES (1, ?, ?, ?)', [gameId, server.sessionId, server.lockEpoch]);
              }
              const events: Event[] = commands.map((command, index) => ({
                id: boundary.newId() as EventId,
                gameId: gameId as GameId,
                seq: (current?.events.length ?? 0) + index + 1,
                group: savedGroup,
                lockEpoch,
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
        });
      },
    };
  } catch (error) {
    return blocked(error);
  }
}
