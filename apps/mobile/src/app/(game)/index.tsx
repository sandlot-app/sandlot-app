import { tokens } from '@sandlot/tokens';
import { createStyles } from '../../../style';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GameStatus } from '../../components/game-status.tsx';
import { useOfflineGame } from '../../scoring/use-offline-game.tsx';

const { colors, sizes } = tokens.modes.Light;

export default function GamesRoute() {
  const { gallery } = useLocalSearchParams<{ gallery?: string }>();
  if (__DEV__ && typeof gallery === 'string')
    return <Redirect href={{ pathname: '/gallery', params: { gallery } }} />;
  return <GamesScreen />;
}

function GamesScreen() {
  const { view, record, reopen } = useOfflineGame();
  const game =
    view.kind === 'ready' || view.kind === 'saving' ? view.game : null;
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
        <GameStatus />
        {(view.kind === 'ready' || view.kind === 'saving') && (
          <View style={styles.card}>
            <Text style={styles.label}>LOCAL DEMO · MUSTANG</Text>
            <Text style={styles.matchup}>Away vs. Home</Text>
            <Text style={styles.detail} testID="saved-game-summary">
              {game
                ? `${game.state.score.away}–${game.state.score.home} · ${game.state.half === 'top' ? 'Top' : 'Bottom'} ${game.state.inning}`
                : 'Preloaded rosters and lineups. Ready for the first pitch.'}
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
                  reopen();
                  router.push('/score');
                } else if (await record({ kind: 'start' }))
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
            {view.message && (
              <Text style={styles.detail} accessibilityLiveRegion="polite">
                {view.message}
              </Text>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = createStyles({
  galleryLink: { minHeight: sizes['tap/min'], justifyContent: 'center' },
  galleryText: { fontSize: 15, fontWeight: '600', color: colors['action/primary'] },
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
  buttonLabel: { fontSize: 17, fontWeight: '600', color: colors['surface/card'] },
  pressed: { opacity: 0.65 },
});
