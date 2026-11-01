import { useIsFocused } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import type { DemoAction, SavedGame } from '../scoring/offline-game.ts';
import { explainLine } from './mic-status.ts';
import { createVoiceController, type VoiceController, type VoiceView } from './voice-controller.ts';
import { useVoiceDeps } from './voice-service';

/** How long the bar says "Saved" before the button comes back. */
const savedFlashMs = 1500;

/**
 * The scoring screen's voice state. The controller does the work; this keeps it in step with React. `onField` is false
 * while the screen shows something other than the field and the bar, such as the plays tab, so the warm mic is off there
 * too: it listens only while the scorer could use it.
 */
export function useVoice(game: SavedGame | null, record: (action: DemoAction) => Promise<boolean>, onField: boolean) {
  const focused = useIsFocused();
  const { voice, mic } = useVoiceDeps(focused && onField && game !== null && game.state.status !== 'final');
  const [view, setView] = useState<VoiceView>({ listening: false, reading: 0, saved: 0, card: null, message: null });
  // "Saved" shows on the bar for a moment each time a voice play saves, then the button comes back.
  const [flash, setFlash] = useState(false);
  const savedBefore = useRef(0);
  useEffect(() => {
    const more = view.saved > savedBefore.current;
    savedBefore.current = view.saved;
    if (!more) return;
    setFlash(true);
    const timer = setTimeout(() => setFlash(false), savedFlashMs);
    return () => clearTimeout(timer);
  }, [view.saved]);
  // A press outlives the render it started in, so it reads the newest game and saves through the newest record().
  const latest = useRef({ voice, game, record });
  useEffect(() => { latest.current = { voice, game, record }; });
  const controller = useRef<VoiceController | null>(null);
  useEffect(() => () => {
    controller.current?.dispose();
    controller.current = null;
  }, [voice]);
  // The mic coming back (allowed in Settings, say) clears a stale "can't use the microphone" line. The controller exists
  // only once a press has been made, and only a press can leave that line.
  useEffect(() => { if (mic === 'ready') controller.current?.micReady(); }, [mic]);
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
    saved: flash,
    mic,
    // The first-open line shares the one line above the bar, until a press has something to say.
    message: view.message ?? (mic === 'explain' ? explainLine : null),
    tap: () => current().tap(),
    choose: (index: number) => current().choose(index),
    dismiss: () => current().dismiss(),
  };
}
