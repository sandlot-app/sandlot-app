import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useOfflineGame } from '../scoring/use-offline-game.tsx';

export function GameStatus() {
  const { view, reopen } = useOfflineGame();
  if (view.kind === 'loading')
    return (
      <View style={styles.status}>
        <ActivityIndicator color="#1466cf" />
        <Text style={styles.message}>Opening your saved game…</Text>
      </View>
    );
  if (view.kind !== 'blocked') return null;
  const message = {
    version:
      'This game needs a different app version. Your saved plays have been kept. Update the app before scoring.',
    corrupt:
      'This saved game could not be read safely. Your plays have been kept. Scoring is paused.',
    storage:
      'Your saved game could not be opened. Scoring is paused so no play is lost. Try opening it again.',
  }[view.reason];
  return (
    <View style={styles.status} accessibilityLiveRegion="polite">
      <Text style={styles.message} testID="game-error">
        {message}
      </Text>
      <Pressable
        onPress={reopen}
        style={({ pressed }) => [styles.retry, pressed && styles.pressed]}
        accessibilityRole="button"
        testID="reopen-game"
      >
        <Text style={styles.retryLabel}>Open saved game again</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  status: { padding: 20, gap: 16 },
  message: { fontSize: 15, lineHeight: 22, color: '#526674' },
  retry: {
    minHeight: 48,
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#1466cf',
    alignItems: 'center',
  },
  retryLabel: { fontSize: 16, fontWeight: '600', color: '#fff' },
  pressed: { opacity: 0.7 },
});
