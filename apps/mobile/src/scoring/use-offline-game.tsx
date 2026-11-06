import { randomUUID } from 'expo-crypto';
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { RejectCode } from '@sandlot/engine';
import type { PropsWithChildren } from 'react';
import { AccessibilityInfo, AppState, Platform } from 'react-native';
import { send, serverRows } from '../sync/backend';
import { findServerGame } from '../sync/server-game.ts';
import { createUploadRunner } from '../sync/runner.ts';
import type { UploadStatus } from '../sync/upload.ts';
import type { SqlDatabase } from './database.ts';
import { blockedMessages, gameSummary } from './game-summary.ts';
import { openNativeDatabase } from './native-database';
import { startAction } from './game-setup.ts';
import type { SetupDraft } from './game-setup.ts';
import { openOfflineGame } from './offline-game.ts';
import type { DemoAction, OpenResult, SavedGame } from './offline-game.ts';

type Session = Extract<OpenResult, { kind: 'ready' }>;

/**
 * The phone keeps two games, each in its own file: the local demo, which never uploads, and the live game the server
 * issued this phone, whose plays upload to sync-events. A build without a Supabase project has only the local demo.
 */
export type Slot = 'local' | 'synced';
const files: Record<Slot, string> = { local: 'sandlot-games.db', synced: 'sandlot-synced.db' };
export const syncAvailable = send !== null && serverRows !== null;
const slots: Slot[] = syncAvailable ? ['local', 'synced'] : ['local'];
/** How often a live game with waiting plays tries again while the app is open. */
const retryMs = 15_000;

/** How starting a game went. A live game can't start until the server names this phone a game's scorer. */
export type StartResult = 'started' | 'none' | 'mismatch' | 'refused' | 'offline' | 'unavailable';
export type SetupStartResult = 'started' | 'unavailable' | { rejected: RejectCode };
type ViewState =
  | { kind: 'loading' }
  | {
      kind: 'ready' | 'saving';
      game: SavedGame | null;
      message: string | null;
      /** True when the message says a play was not saved, so the screen shows it, not only screen readers. */
      problem?: boolean;
    }
  | {
      kind: 'blocked';
      reason: 'storage' | 'version' | 'corrupt';
      game: SavedGame | null;
    };

type ScoringContext = {
  /** The game being scored: the one `open` chose. */
  view: ViewState;
  active: Slot;
  /** Each game as last saved, for Your games. */
  games: Record<Slot, SavedGame | null>;
  /** Where the live game's upload queue stands, or null before its first try. */
  upload: UploadStatus | null;
  /** True while an upload has taken over half a second, when the sync line says Saving… */
  uploadSlow: boolean;
  record(action: DemoAction): Promise<boolean>;
  /** Scores `slot`'s game from now on, reopening both from storage. */
  open(slot: Slot): void;
  /** Starts `slot`'s game and opens it. The live game uses the game and session the server issued this phone. */
  start(slot: Slot): Promise<StartResult>;
  /** Starts the local game with the season half and lineups the scorer chose in Game setup, or says why the engine refused. */
  startSetup(setup: SetupDraft): Promise<SetupStartResult>;
  reopen(): void;
};
const Context = createContext<ScoringContext | null>(null);

export function OfflineGameProvider({ children }: PropsWithChildren) {
  const [view, setView] = useState<ViewState>({ kind: 'loading' });
  const [generation, setGeneration] = useState(0);
  const [active, setActive] = useState<Slot>('local');
  const [games, setGames] = useState<Record<Slot, SavedGame | null>>({ local: null, synced: null });
  const [upload, setUpload] = useState<UploadStatus | null>(null);
  const [uploadSlow, setUploadSlow] = useState(false);
  const sessions = useRef<Partial<Record<Slot, Session>>>({});
  const session = useRef<Session | null>(null);
  const runner = useRef(send ? createUploadRunner(send) : null);
  const stopped = useRef(false);
  const operation = useRef<Promise<unknown> | null>(null);
  const closing = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    if (
      Platform.OS !== 'ios' ||
      view.kind === 'loading' ||
      view.kind === 'saving'
    )
      return;
    const message =
      view.kind === 'blocked'
        ? blockedMessages[view.reason]
        : view.message;
    if (!message) return;
    const announcement = view.game
      ? `${message} ${gameSummary(view.game.state)}`
      : message;
    try {
      AccessibilityInfo.announceForAccessibilityWithOptions(announcement, {
        queue: true,
      });
    } catch {
      console.error('Sandlot could not announce the scoring result.');
    }
  }, [view]);

  useEffect(() => {
    let disposed = false;
    const databases: SqlDatabase[] = [];
    const uploads = runner.current;
    const opened = (async () => {
      const results: Partial<Record<Slot, OpenResult>> = {};
      try {
        await closing.current;
        for (const slot of slots) {
          const database = await openNativeDatabase(files[slot]);
          databases.push(database);
          results[slot] = await openOfflineGame(database, {
            newId: randomUUID,
            now: () => new Date().toISOString(),
          });
        }
      } catch {
        if (!disposed)
          setView({ kind: 'blocked', reason: 'storage', game: null });
        return;
      }
      if (disposed) return;
      const ready = (slot: Slot) => (results[slot]?.kind === 'ready' ? results[slot] : undefined);
      sessions.current = { local: ready('local'), synced: ready('synced') };
      session.current = sessions.current[active] ?? null;
      setGames({ local: ready('local')?.game ?? null, synced: ready('synced')?.game ?? null });
      stopped.current = false;
      const result = results[active];
      if (result?.kind === 'ready')
        setView({ kind: 'ready', game: result.game, message: null });
      else setView({ kind: 'blocked', reason: result?.reason ?? 'storage', game: null });
      void syncNow();
    })();
    return () => {
      disposed = true;
      session.current = null;
      sessions.current = {};
      const pending = operation.current;
      // An upload still using these databases finishes before they close.
      closing.current = Promise.all([opened, pending, uploads?.idle()])
        .then(async () => {
          await Promise.all(databases.map((database) => database.close()));
        })
        .catch(() => {
          console.error('Sandlot could not close its local database.');
        });
    };
  }, [generation, active]);

  useEffect(() => {
    if (!games.synced?.waitingPlays || upload?.kind === 'stopped') return;
    const retry = setInterval(() => void syncNow(), retryMs);
    const foreground = AppState.addEventListener('change', (state) => {
      if (state === 'active') void syncNow();
    });
    return () => {
      clearInterval(retry);
      foreground.remove();
    };
  }, [games.synced?.waitingPlays, upload?.kind]);

  /** Sends the live game's waiting plays, one run at a time. A stopped queue waits for the next open. */
  async function syncNow() {
    const store = sessions.current.synced;
    if (!store || !runner.current) return;
    const result = await runner.current.run(store, setUploadSlow);
    if (store !== sessions.current.synced) return;
    stopped.current = result.status.kind === 'stopped';
    setUpload(result.status);
    const latest = result.game;
    if (!latest) return;
    setGames((current) => ({ ...current, synced: latest }));
    setView((current) =>
      current.kind === 'ready' && current.game?.id === latest.id && current.game.revision <= latest.revision
        ? { ...current, game: latest }
        : current);
  }

  async function record(action: DemoAction): Promise<boolean> {
    const owner = session.current;
    if (!owner || operation.current || view.kind !== 'ready') return false;
    const previous = view.game;
    setView({ kind: 'saving', game: previous, message: null });
    const slot = active;
    const work = owner.record(action);
    operation.current = work;
    try {
      const result = await work;
      if (owner !== session.current) return false;
      switch (result.kind) {
        case 'saved':
          setGames((current) => ({ ...current, [slot]: result.game }));
          if (slot === 'synced' && !stopped.current) void syncNow();
          setView({
            kind: 'ready',
            game: result.game,
            message:
              action.kind === 'start'
                ? null
                : action.kind === 'undo'
                  ? 'Last play undone. Saved on this phone.'
                  : action.kind === 'pitch' ? 'Pitch saved on this phone.' : 'Play saved on this phone.',
          });
          return true;
        case 'stale':
          setView({kind: 'ready', game: result.game, message: 'The game changed while this play was open. Cancel and open it again before saving.', problem: true});
          return false;
        case 'busy':
          setView({
            kind: 'ready',
            game: previous,
            message: 'A play is still saving. Try again when it finishes.',
            problem: true,
          });
          return false;
        case 'unsaved':
          setView({
            kind: 'ready',
            game: previous,
            message:
              'That play could not be saved. Your previous score is unchanged. Try again.',
            problem: true,
          });
          return false;
        case 'rejected':
          setView({
            kind: 'ready',
            game: previous,
            message:
              rejectionMessage(result.code),
            problem: true,
          });
          return false;
        case 'blocked':
          setView({ ...result, game: previous });
          return false;
        default:
          result satisfies never;
          throw new Error('Unknown scoring result');
      }
    } catch {
      if (owner === session.current)
        setView({ kind: 'blocked', reason: 'storage', game: previous });
      return false;
    } finally {
      if (operation.current === work) operation.current = null;
    }
  }

  function reopen() {
    if (operation.current) return;
    session.current = null;
    setView({ kind: 'loading' });
    setGeneration((current) => current + 1);
  }

  function open(slot: Slot) {
    if (operation.current) return;
    setActive(slot);
    reopen();
  }

  /** Saves `action` as the start of `slot`'s game, as one play, and opens that game. */
  async function startWith(slot: Slot, action: DemoAction): Promise<'started' | 'unavailable' | { rejected: RejectCode }> {
    const store = sessions.current[slot];
    if (!store || operation.current) return 'unavailable';
    const work = store.record(action);
    operation.current = work;
    try {
      const result = await work;
      if (result.kind === 'rejected') return { rejected: result.code };
      if (result.kind !== 'saved') return 'unavailable';
    } finally {
      if (operation.current === work) operation.current = null;
    }
    open(slot);
    return 'started';
  }

  async function start(slot: Slot): Promise<StartResult> {
    let action: DemoAction = { kind: 'start' };
    if (slot === 'synced') {
      if (!serverRows) return 'unavailable';
      const found = await findServerGame(serverRows);
      if (found.kind !== 'found') return found.kind;
      action = { kind: 'start', server: found.server };
    }
    const result = await startWith(slot, action);
    return result === 'started' ? 'started' : 'unavailable';
  }

  const startSetup = (setup: SetupDraft) => startWith('local', startAction(setup));

  return <Context value={{ view, active, games, upload, uploadSlow, record, open, start, startSetup, reopen }}>{children}</Context>;
}

export function useOfflineGame(): ScoringContext {
  const context = useContext(Context);
  if (!context) throw new Error('OfflineGameProvider is required');
  return context;
}

function rejectionMessage(code: RejectCode): string {
  switch (code) {
    case 'nothing_to_undo': return 'There are no plays left to undo.';
    case 'base_occupied': return 'Two runners cannot finish on the same base. Check their destinations.';
    case 'bunting_not_allowed': return 'Bunting is not allowed by this game’s Mustang rules. No play was saved.';
    case 'stealing_home_not_allowed': return 'Stealing home is not allowed by this game’s rules. No play was saved.';
    case 'invalid_out_type': return 'That out type does not fit this play. Check who was forced and the order of outs.';
    case 'invalid_runner_destination': return 'That runner destination is not allowed. Pickoff requires Out; safe advances must move forward.';
    case 'runner_not_on_base': return 'That runner is no longer on base. Cancel and open the play again.';
    case 'duplicate_runner': return 'Choose one destination for each runner.';
    case 'outs_dont_match_outcome': return 'The selected outs do not match the outcome. Check the runner destinations.';
    case 'batter_destination_missing': return 'Choose where the batter finished before saving.';
    case 'game_over': return 'This game is over. Undo the last play to correct it.';
    default: return 'That play cannot be recorded in this game. Check the outcome and runner destinations.';
  }
}
