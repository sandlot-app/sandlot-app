import { createContext, useContext, useState } from 'react';
import type { PropsWithChildren } from 'react';
import { demoGame, newSetupDraft } from './game-setup.ts';
import type { SetupDraft } from './game-setup.ts';

type SetupContext = { draft: SetupDraft; setDraft(draft: SetupDraft): void };
const Context = createContext<SetupContext | null>(null);

/** Holds the scorer's Game setup choices on the phone from Game setup, through each team's Lineup, until Start saves them. */
export function SetupDraftProvider({ children }: PropsWithChildren) {
  const [draft, setDraft] = useState(() => newSetupDraft(demoGame.day));
  return <Context value={{ draft, setDraft }}>{children}</Context>;
}

export function useSetupDraft(): SetupContext {
  const context = useContext(Context);
  if (!context) throw new Error('SetupDraftProvider is required');
  return context;
}
