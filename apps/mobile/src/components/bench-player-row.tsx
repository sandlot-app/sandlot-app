import { tokens } from '@sandlot/tokens';
import { Pressable, Text, View } from 'react-native';
import { createStyles } from '../../style';
import { CheckIcon } from './icons.tsx';
import { RadioRing } from './setup-marks.tsx';

const { colors, sizes, textStyles } = tokens.modes.Light;

/** Figma Bench Player Row (85:3077), Default and Selected: a player you can pick, with a note under the name. */
export function BenchPlayerRow({ number, name, note, selected = false, role = 'radio', onPress, testID }: {
  number: string;
  name: string;
  note: string;
  selected?: boolean;
  /** A row that picks one of several is a radio; a row that does something when tapped is a button. */
  role?: 'radio' | 'button';
  onPress?: () => void;
  testID?: string;
}) {
  return (
    <Pressable accessibilityRole={onPress ? role : undefined} accessibilityState={{ selected }} accessibilityLabel={`${name}, number ${number}. ${note}`}
      disabled={!onPress} onPress={onPress} style={[styles.row, selected && styles.selected]} testID={testID}>
      <View style={styles.disc}><Text style={styles.number}>{number}</Text></View>
      <View style={styles.text}>
        <Text style={styles.name} numberOfLines={1}>{name}</Text>
        <Text style={styles.note} numberOfLines={1}>{note}</Text>
      </View>
      <View style={styles.radio}>
        {selected ? <View style={styles.filled}><CheckIcon color={colors['scoreboard/text']} size={14} /></View> : <RadioRing />}
      </View>
    </Pressable>
  );
}

const styles = createStyles({
  // Figma: 59 tall, 12 in on the left and 14 on the right. Radius 16 isn't a token, so the nearest, radius/md, stands in.
  row: { minHeight: 59, flexDirection: 'row', alignItems: 'center', gap: sizes['space/3'], paddingHorizontal: sizes['space/3'], borderRadius: sizes['radius/md'], backgroundColor: colors['surface/card'] },
  selected: { minHeight: 63, backgroundColor: colors['surface/page'], borderWidth: 2, borderColor: colors['scoreboard/bg'] },
  disc: { width: 32, height: 32, borderRadius: sizes['radius/full'], backgroundColor: colors['surface/card'], borderWidth: sizes['chip/outline-width'], borderColor: colors['chip/outline'], alignItems: 'center', justifyContent: 'center' },
  number: { ...textStyles['Body/Strong'], color: colors['text/primary'] },
  text: { flex: 1, minWidth: 0 },
  name: { ...textStyles['Body/Strong'], color: colors['text/primary'] },
  note: { ...textStyles.Caption, color: colors['text/tertiary'] },
  // The radio is 22 with 14 after it; 12 of that is the row's own padding, so the slot carries the other 2.
  radio: { width: 24, height: 22, alignItems: 'flex-start' },
  filled: { width: 22, height: 22, borderRadius: sizes['radius/full'], backgroundColor: colors['scoreboard/bg'], alignItems: 'center', justifyContent: 'center' },
});
