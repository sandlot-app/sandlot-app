import { tokens } from '@sandlot/tokens';
import { Pressable, Text, View } from 'react-native';
import { createStyles } from '../../style';
import { CaretLeftIcon } from './icons.tsx';

const { colors, sizes, textStyles } = tokens.modes.Light;

/** The Nav bar of Game setup (167:11252) and Lineup (168:11255): Back, a centered title, and nothing on the right. */
export function SetupNav({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <View style={styles.nav}>
      <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={onBack} style={({ pressed }) => [styles.back, pressed && styles.pressed]} testID="setup-back">
        <CaretLeftIcon color={colors['text/primary']} />
      </Pressable>
      <Text style={styles.title} accessibilityRole="header">{title}</Text>
      <View style={styles.back} />
    </View>
  );
}

/** The caps label above a section ("GAME", "BATTING ORDER"). */
export function SectionLabel({ children }: { children: string }) {
  return <Text style={styles.label} accessibilityRole="header">{children}</Text>;
}

/** Why the engine rejected a lineup or Start, in the same band the scoring screen uses for a rejected play. */
export function RejectionBand({ message, testID }: { message: string; testID: string }) {
  return <Text style={styles.band} accessibilityLiveRegion="polite" testID={testID}>{message}</Text>;
}

const styles = createStyles({
  nav: { height: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: sizes['space/2'] },
  back: { width: sizes['tap/min'], height: sizes['tap/min'], alignItems: 'center', justifyContent: 'center' },
  title: { ...textStyles['Body/Strong'], color: colors['text/primary'] },
  pressed: { opacity: 0.55 },
  label: { ...textStyles['Label/Caps'], color: colors['text/secondary'], textTransform: 'uppercase' },
  band: { padding: sizes['space/3'], borderRadius: sizes['radius/md'], backgroundColor: colors['surface/warning'], color: colors['text/primary'] },
});
