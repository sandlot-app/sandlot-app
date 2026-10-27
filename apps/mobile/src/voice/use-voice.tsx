import { useEffect, useRef, useState } from 'react';
import type { DemoAction, SavedGame } from '../scoring/offline-game.ts';
import { createVoiceController, type VoiceController, type VoiceView } from './voice-controller.ts';
import { useVoiceDeps } from './voice-service';

/** The scoring screen's voice state. The controller does the work; this keeps it in step with React. */
export function useVoice(game: SavedGame | null, record: (action: DemoAction) => Promise<boolean>) {
  const voice = useVoiceDeps();
  const [view, setView] = useState<VoiceView>({ listening: false, card: null, message: null });
  // A press outlives the render it started in, so it reads the newest game and saves through the newest record().
  const latest = useRef({ voice, game, record });
  useEffect(() => { latest.current = { voice, game, record }; });
  const controller = useRef<VoiceController | null>(null);
  useEffect(() => () => {
    controller.current?.dispose();
    controller.current = null;
  }, [voice]);
  // Made on the first touch, from event handlers only.
  const current = () => controller.current ??= createVoiceController({
    voice: latest.current.voice,
    game: () => latest.current.game,
    record: (action) => latest.current.record(action),
    now: Date.now,
    onChange: setView,
  });
  return {
    ...view,
    start: () => current().start(),
    release: () => current().release(),
    cancel: () => current().cancel(),
    choose: (index: number) => current().choose(index),
    dismiss: () => current().dismiss(),
  };
}
