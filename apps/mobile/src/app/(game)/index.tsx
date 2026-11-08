import { tokens } from '@sandlot/tokens';
import { createStyles } from '../../../style';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GameStatus } from '../../components/game-status.tsx';
import type { SavedGame } from '../../scoring/offline-game.ts';
import { syncAvailable, useOfflineGame, type StartResult } from '../../scoring/use-offline-game.tsx';
import { demoChild } from '../../scoring/demo-roster.ts';
import { phoneId } from '../../sync/backend';

const { colors, sizes } = tokens.modes.Light;

const summary = (game: SavedGame) =>
  `${game.state.score.away}–${game.state.score.home} · ${game.state.half === 'top' ? 'Top' : 'Bottom'} ${game.state.inning}`;

const startProblems: Record<Exclude<StartResult, 'started' | 'none'>, string> = {
  mismatch: 'The server’s demo game can’t take this app’s plays. Seed a new one with this app’s demo pins.',
  refused: 'The server wouldn’t let this phone read its game. Check the project’s settings.',
  offline: 'No signal. Try again once this phone is online.',
  unavailable: 'The live game couldn’t start. Try again.',
};

/** Opens the sticker picker for a Final game. */
function ShareGameLink({ slot, game }: { slot: 'local' | 'synced'; game: SavedGame | null }) {
  if (game?.state.status !== 'final') return null;
  return <Pressable accessibilityRole="button" testID={`share-${slot}`} style={styles.galleryLink}
    onPress={() => router.push(`/share?game=${slot}`)}>
    <Text style={styles.galleryText}>{`Share ${demoChild.first}’s game`}</Text>
  </Pressable>;
}

/** The game the server issued this phone, whose plays upload as they're scored. */
function LiveGameCard() {
  const { view, games, upload, open, start } = useOfflineGame();
  const [problem, setProblem] = useState<string | null>(null);
  const game = games.synced;
  const available = view.kind === 'ready';
  const waiting = game?.waitingPlays ?? 0;
  return (
    <View style={styles.card} testID="live-game-card">
      <Text style={styles.label}>LIVE DEMO · MUSTANG</Text>
      <Text style={styles.matchup}>Away vs. Home</Text>
      <Text style={styles.detail} testID="live-game-summary">
        {game ? summary(game) : 'The demo game on the server. Family members follow it live.'}
      </Text>
      <Pressable disabled={!available} testID={game ? 'resume-live' : 'start-live'} accessibilityRole="button"
        accessibilityState={{ disabled: !available }} style={({ pressed }) => [styles.button, (!available || pressed) && styles.pressed]}
        onPress={async () => {
          setProblem(null);
          if (game) {
            open('synced');
            router.push('/score');
            return;
          }
          const result = await start('synced');
          if (result === 'started') router.push('/score');
          else if (result === 'none') setProblem(`This phone isn’t the demo game’s scorer yet. Phone ID for the seed script: ${await phoneId() ?? 'not signed in'}`);
          else setProblem(startProblems[result]);
        }}>
        <Text style={styles.buttonLabel}>{game ? 'Continue scoring' : 'Start live game'}</Text>
      </Pressable>
      <Text style={styles.detail} testID="live-waiting">
        {!game ? 'Plays upload as you score, and wait on this phone without signal.'
          : waiting === 0 ? 'Every play is on the server.'
            : `${waiting} ${waiting === 1 ? 'play' : 'plays'} waiting to upload${upload?.kind === 'stopped' ? ' · sync stopped' : ''}`}
      </Text>
      {problem ? <Text style={styles.detail} accessibilityLiveRegion="polite" testID="live-message" selectable>{problem}</Text> : null}
      <ShareGameLink slot="synced" game={game} />
    </View>
  );
}

export default function GamesScreen() {
  const { view, active, games, open, start } = useOfflineGame();
  const game = games.local;
  const available = view.kind === 'ready';

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text
          style={styles.brand}
          accessibilityLabel="Sandlot"
          testID="sandlot-brand"
        >
          sandlot.
        </Text>
        <Text style={styles.title}>Your games</Text>
        <Text style={styles.subtitle}>
          Keep the book. Every saved pitch stays on this phone.
        </Text>
        {__DEV__ ? (
          <Pressable accessibilityRole="button" testID="open-scorer-gallery" style={styles.galleryLink} onPress={() => router.push('/gallery')}>
            <Text style={styles.galleryText}>Scorer UI gallery</Text>
          </Pressable>
        ) : null}
        {__DEV__ ? (
          <Pressable accessibilityRole="button" testID="open-share-sample" style={styles.galleryLink}
            onPress={() => router.push('/share?game=sample')}>
            <Text style={styles.galleryText}>Sticker picker (sample game)</Text>
          </Pressable>
        ) : null}
        <GameStatus />
        {(view.kind === 'ready' || view.kind === 'saving') && (
          <View style={styles.card}>
            <Text style={styles.label}>LOCAL DEMO · MUSTANG</Text>
            <Text style={styles.matchup}>Away vs. Home</Text>
            <Text style={styles.detail} testID="saved-game-summary">
              {game ? summary(game) : 'Preloaded rosters and lineups. Ready for the first pitch.'}
            </Text>
            <Pressable
              disabled={!available}
              testID={game ? 'resume-game' : 'start-game'}
              accessibilityRole="button"
              accessibilityState={{ disabled: !available }}
              style={({ pressed }) => [
                styles.button,
                (!available || pressed) && styles.pressed,
              ]}
              onPress={async () => {
                if (game) {
                  open('local');
                  router.push('/score');
                } else if (await start('local') === 'started')
                  router.push('/score');
              }}
            >
              <Text style={styles.buttonLabel}>
                {view.kind === 'saving'
                  ? 'Saving game…'
                  : game
                    ? 'Continue scoring'
                    : 'Start demo game'}
              </Text>
            </Pressable>
            <Text style={styles.detail}>
              {game
                ? `${game.waitingPlays} saved ${game.waitingPlays === 1 ? 'play' : 'plays'} waiting to sync`
                : 'This local demo does not upload to a live game.'}
            </Text>
            {active === 'local' && view.message && (
              <Text style={styles.detail} accessibilityLiveRegion="polite">
                {view.message}
              </Text>
            )}
            <ShareGameLink slot="local" game={game} />
          </View>
        )}
        {syncAvailable ? <LiveGameCard /> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = createStyles({
  galleryLink: { minHeight: sizes['tap/min'], justifyContent: 'center' },
  galleryText: { fontSize: 15, fontWeight: '600', color: colors['text/link'] },
  screen: { flex: 1, backgroundColor: colors['surface/page'] },
  content: { padding: sizes['space/6'], gap: sizes['space/3'] },
  brand: {
    fontSize: 27,
    fontWeight: '800',
    color: colors['text/primary'],
    marginBottom: sizes['space/6'],
  },
  title: { fontSize: 28, fontWeight: '700', color: colors['text/primary'] },
  subtitle: {
    fontSize: 16,
    lineHeight: 24,
    color: colors['text/secondary'],
    marginBottom: sizes['space/4'],
  },
  card: {
    borderRadius: sizes['radius/lg'],
    padding: sizes['space/4'],
    gap: sizes['space/4'],
    backgroundColor: colors['surface/card'],
    borderWidth: 1,
    borderColor: colors['border/subtle'],
  },
  label: { fontSize: 12, fontWeight: '600', color: colors['text/secondary'] },
  matchup: { fontSize: 23, fontWeight: '700', color: colors['text/primary'] },
  detail: {
    fontSize: 15,
    lineHeight: 22,
    color: colors['text/secondary'],
    fontVariant: ['tabular-nums'],
  },
  button: {
    minHeight: 52,
    borderRadius: sizes['radius/md'],
    backgroundColor: colors['action/primary'],
    padding: sizes['space/4'],
    alignItems: 'center',
  },
  buttonLabel: { fontSize: 17, fontWeight: '600', color: colors['text/on-action'] },
  pressed: { opacity: 0.65 },
});
