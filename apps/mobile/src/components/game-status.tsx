import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useOfflineGame } from '../scoring/use-offline-game.tsx';
import { blockedMessages } from '../scoring/game-summary.ts';

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
  const message = blockedMessages[view.reason];
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
