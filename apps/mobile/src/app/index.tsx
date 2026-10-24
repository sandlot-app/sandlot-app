import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GameStatus } from '../components/game-status.tsx';
import { useOfflineGame } from '../scoring/use-offline-game.tsx';

export default function GamesScreen() {
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

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f3f7fa' },
  content: { padding: 24, gap: 12 },
  brand: {
    fontSize: 27,
    fontWeight: '800',
    color: '#132d43',
    marginBottom: 24,
  },
  title: { fontSize: 28, fontWeight: '700', color: '#132d43' },
  subtitle: {
    fontSize: 16,
    lineHeight: 24,
    color: '#526674',
    marginBottom: 16,
  },
  card: {
    borderRadius: 16,
    padding: 20,
    gap: 16,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#dce5ed',
  },
  label: { fontSize: 12, fontWeight: '600', color: '#526674' },
  matchup: { fontSize: 23, fontWeight: '700', color: '#132d43' },
  detail: {
    fontSize: 15,
    lineHeight: 22,
    color: '#526674',
    fontVariant: ['tabular-nums'],
  },
  button: {
    minHeight: 52,
    borderRadius: 12,
    backgroundColor: '#1466cf',
    padding: 14,
    alignItems: 'center',
  },
  buttonLabel: { fontSize: 17, fontWeight: '600', color: '#fff' },
  pressed: { opacity: 0.65 },
});
