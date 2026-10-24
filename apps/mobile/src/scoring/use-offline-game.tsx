import { randomUUID } from 'expo-crypto';
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { PropsWithChildren } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';
import type { SqlDatabase } from './database.ts';
import { blockedMessages, gameSummary } from './game-summary.ts';
import { openNativeDatabase } from './native-database.ts';
import { openOfflineGame } from './offline-game.ts';
import type { DemoAction, OpenResult, SavedGame } from './offline-game.ts';

type Session = Extract<OpenResult, { kind: 'ready' }>;
type ViewState =
  | { kind: 'loading' }
  | { kind: 'ready' | 'saving'; game: SavedGame | null; message: string | null }
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
                  ? 'Last pitch undone. Saved on this phone.'
                  : 'Pitch saved on this phone.',
          });
          return true;
        case 'busy':
          setView({
            kind: 'ready',
            game: previous,
            message: 'A play is still saving. Try again when it finishes.',
          });
          return false;
        case 'unsaved':
          setView({
            kind: 'ready',
            game: previous,
            message:
              'That play could not be saved. Your previous score is unchanged. Try again.',
          });
          return false;
        case 'rejected':
          setView({
            kind: 'ready',
            game: previous,
            message:
              result.code === 'nothing_to_undo'
                ? 'There are no pitches left to undo.'
                : 'That pitch cannot be recorded in this game.',
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
