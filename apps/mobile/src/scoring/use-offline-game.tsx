import { randomUUID } from 'expo-crypto';
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { RejectCode } from '@sandlot/engine';
import type { PropsWithChildren } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';
import type { SqlDatabase } from './database.ts';
import { blockedMessages, gameSummary } from './game-summary.ts';
import { openNativeDatabase } from './native-database';
import { openOfflineGame } from './offline-game.ts';
import type { DemoAction, OpenResult, SavedGame } from './offline-game.ts';

type Session = Extract<OpenResult, { kind: 'ready' }>;
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
  view: ViewState;
  record(action: DemoAction): Promise<boolean>;
  reopen(): void;
};
const Context = createContext<ScoringContext | null>(null);

export function OfflineGameProvider({ children }: PropsWithChildren) {
  const [view, setView] = useState<ViewState>({ kind: 'loading' });
  const [generation, setGeneration] = useState(0);
  const session = useRef<Session | null>(null);
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
    let database: SqlDatabase | null = null;
    const opened = (async () => {
      try {
        await closing.current;
        database = await openNativeDatabase();
        const result = await openOfflineGame(database, {
          newId: randomUUID,
          now: () => new Date().toISOString(),
        });
        if (disposed) return;
        if (result.kind === 'ready') {
          session.current = result;
          setView({ kind: 'ready', game: result.game, message: null });
        } else setView({ ...result, game: null });
      } catch {
        if (!disposed)
          setView({ kind: 'blocked', reason: 'storage', game: null });
      }
    })();
    return () => {
      disposed = true;
      session.current = null;
      const pending = operation.current;
      closing.current = Promise.all([opened, pending])
        .then(async () => {
          await database?.close();
        })
        .catch(() => {
          console.error('Sandlot could not close its local database.');
        });
    };
  }, [generation]);

  async function record(action: DemoAction): Promise<boolean> {
    const owner = session.current;
    if (!owner || operation.current || view.kind !== 'ready') return false;
    const previous = view.game;
    setView({ kind: 'saving', game: previous, message: null });
    const work = owner.record(action);
    operation.current = work;
    try {
      const result = await work;
      if (owner !== session.current) return false;
      switch (result.kind) {
        case 'saved':
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

  return <Context value={{ view, record, reopen }}>{children}</Context>;
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
