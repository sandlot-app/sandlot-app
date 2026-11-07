import { tokens } from '@sandlot/tokens';
import { createStyles } from '../../style';
import {
  ActivityIndicator,
  Pressable,
  Text,
  View,
} from 'react-native';
import { useOfflineGame } from '../scoring/use-offline-game.tsx';
import { blockedMessages } from '../scoring/game-summary.ts';

const { colors, sizes } = tokens.modes.Light;

export function GameStatus() {
  const { view, reopen } = useOfflineGame();
  if (view.kind === 'loading')
    return (
      <View style={styles.status}>
        <ActivityIndicator color={colors['action/primary']} />
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

const styles = createStyles({
  // A card, so it reads clearly when it sits over the field on the score screen.
  status: {
    marginHorizontal: sizes['space/4'], marginBottom: sizes['space/2'], padding: sizes['space/4'], gap: sizes['space/4'],
    borderRadius: sizes['radius/lg'], borderWidth: 1, borderColor: colors['border/subtle'], backgroundColor: colors['surface/card'],
  },
  message: { fontSize: 15, lineHeight: 22, color: colors['text/secondary'] },
  retry: {
    minHeight: 48,
    padding: sizes['space/4'],
    borderRadius: sizes['radius/md'],
    backgroundColor: colors['action/primary'],
    alignItems: 'center',
  },
  retryLabel: { fontSize: 16, fontWeight: '600', color: colors['text/on-action'] },
  pressed: { opacity: 0.7 },
});
