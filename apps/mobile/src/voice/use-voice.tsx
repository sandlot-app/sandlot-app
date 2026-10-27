import type { Command } from '@sandlot/engine';
import { route, type Reading } from '@sandlot/voice';
import { useEffect, useRef, useState } from 'react';
import type { VoiceCard } from '../../scorer-ui';
import type { DemoAction, SavedGame } from '../scoring/offline-game.ts';
import { choiceLabels, failureMessage, liveCard, outcome, pressGame, pressInput } from './outcome.ts';
import { startPress, type PressHandle } from './press.ts';
import { useVoiceDeps } from './voice-service';

type Choosing = { card: Extract<VoiceCard, { kind: 'choose' }>; readings: Reading[]; at: number };

/**
 * The scoring screen's voice state: the Transcript Card while a press is held or waiting for a choice, and a line
 * for anything that falls back to taps. Every save goes through `record`, so the engine checks it (rule 6).
 */
export function useVoice(game: SavedGame | null, record: (action: DemoAction) => Promise<boolean>) {
  const deps = useVoiceDeps();
  const [listening, setListening] = useState(false);
  const [live, setLive] = useState<VoiceCard | null>(null);
  const [choosing, setChoosing] = useState<Choosing | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const press = useRef<PressHandle | null>(null);
  const latest = useRef(game);
  // A press outlives the render it started in, so it saves through the newest record(), which reads the newest view.
  const recorder = useRef(record);
  useEffect(() => {
    latest.current = game;
    recorder.current = record;
  });
  /** The last play voice saved, for route()'s duplicate guard (D4). */
  const previous = useRef<{ commands: Command[]; at: number } | undefined>(undefined);

  useEffect(() => () => press.current?.cancel(), []);

  async function save(commands: Command[], at: number) {
    const current = latest.current;
    if (!current) return;
    const saved = await recorder.current({ kind: 'voice', at: new Date(at).toISOString(), expectedRevision: current.revision, commands });
    if (saved) previous.current = { commands, at };
  }

  function start() {
    const current = latest.current;
    if (!current) return;
    press.current?.cancel();
    setChoosing(null);
    if (!deps) {
      // The bar still answers the touch, so the scorer learns at once to use the buttons.
      setMessage(failureMessage('voice_unavailable'));
      return;
    }
    setMessage(null);
    setListening(true);
    setLive({ kind: 'listening', words: '' });
    const at = Date.now();
    const routed = (transcript: string, parsed?: Parameters<typeof route>[1]) =>
      route({ ...pressGame(latest.current ?? current), transcript, at, previous: previous.current }, parsed);
    const handle = startPress(deps, pressInput(current), (update) => {
      if (press.current !== handle) return;
      if (update.kind === 'words') {
        setLive(liveCard(routed(update.words), update.words));
        return;
      }
      press.current = null;
      setListening(false);
      setLive(null);
      if (update.kind === 'failed') {
        setMessage(failureMessage(update.failure));
        return;
      }
      const result = outcome(routed(update.transcript, update.parsed));
      if (result.kind === 'save') void save(result.commands, at);
      else if (result.kind === 'undo') void recorder.current({ kind: 'undo' });
      else if (result.kind === 'message') setMessage(result.message);
      else setChoosing({
        card: { kind: 'choose', heading: result.heading, words: update.transcript, choices: choiceLabels(result.choices), note: result.note },
        readings: result.choices,
        at,
      });
    });
    press.current = handle;
  }

  function release() {
    if (press.current) press.current.release();
    else {
      setListening(false);
      setLive(null);
    }
  }

  function cancel() {
    press.current?.cancel();
    press.current = null;
    setListening(false);
    setLive(null);
  }

  function choose(index: number) {
    const picked = choosing?.readings[index];
    if (!picked || !choosing) return;
    setChoosing(null);
    void save(picked.commands, choosing.at);
  }

  /** A tap on the scorer buttons takes over from voice. */
  function dismiss() {
    setChoosing(null);
    setMessage(null);
  }

  return { listening, card: live ?? choosing?.card ?? null, message, start, release, cancel, choose, dismiss };
}
