import { tokens } from '@sandlot/tokens';
import { Pressable, Text, View } from 'react-native';
import { createStyles } from '../../style';

const { colors, sizes, textStyles } = tokens.modes.Light;

export type GameTab = 'field' | 'plays';

const tabs: { tab: GameTab; label: string }[] = [
  { tab: 'field', label: 'Field' },
  { tab: 'plays', label: 'Plays' },
];

/** Figma Tabs (35:412). Video and Box score aren't built yet, so only Field and Plays show. */
export function GameTabs({ selected, onSelect }: { selected: GameTab; onSelect: (tab: GameTab) => void }) {
  return (
    <View style={styles.track} accessibilityRole="tablist" testID="game-tabs">
      {tabs.map(({ tab, label }) => {
        const active = tab === selected;
        return (
          <Pressable key={tab} onPress={() => onSelect(tab)} accessibilityRole="tab" accessibilityState={{ selected: active }}
            style={({ pressed }) => [styles.item, active && styles.selected, pressed && styles.pressed]} testID={`tab-${tab}`}>
            <Text style={[styles.label, active && styles.selectedLabel]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = createStyles({
  track: {
    flexDirection: 'row', padding: sizes['space/1'],
    backgroundColor: colors['surface/card'], borderWidth: 1, borderColor: colors['border/subtle'], borderRadius: sizes['radius/full'],
  },
  item: { flex: 1, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: sizes['radius/full'] },
  selected: { backgroundColor: colors['scoreboard/bg'] },
  pressed: { transform: [{ scale: 0.97 }] },
  label: { ...textStyles.Tab, color: colors['text/secondary'] },
  selectedLabel: { color: colors['scoreboard/text'] },
});
