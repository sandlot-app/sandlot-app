import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { tokens } from '@sandlot/tokens';
import { createStyles } from '../../style';
import { BookIcon } from './book-icons.tsx';

const {colors, sizes, textStyles} = tokens.modes.Light;

export function BookHeader({title, onBack, testID}: {title: string; onBack(): void; testID?: string}) {
  return <View style={bookStyles.header}>
    <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel="Back" testID={testID} style={bookStyles.headerSide}>
      <BookIcon name="caret-left" size={24} color={colors['text/primary']} />
    </Pressable>
    <Text style={bookStyles.headerTitle}>{title}</Text>
    <View style={bookStyles.headerSide} />
  </View>;
}

export function BookSection({label, children}: {label: string; children: ReactNode}) {
  return <View style={bookStyles.section}><Text style={bookStyles.caps}>{label}</Text>{children}</View>;
}

export const bookStyles = createStyles({
  screen: {flex: 1, backgroundColor: colors['surface/page']},
  content: {flexGrow: 1, paddingHorizontal: sizes['space/4'], paddingBottom: sizes['space/4'], gap: sizes['space/4']},
  header: {minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'},
  headerSide: {width: 56, minHeight: sizes['tap/min'], alignItems: 'center', justifyContent: 'center'},
  headerTitle: {...textStyles['Body/Strong'], color: colors['text/primary'], flex: 1, textAlign: 'center'},
  section: {gap: sizes['space/2']},
  caps: {...textStyles['Label/Caps'], color: colors['text/secondary'], textTransform: 'uppercase'},
  body: {...textStyles['Body/Regular'], color: colors['text/primary']},
  strong: {...textStyles['Body/Strong'], color: colors['text/primary']},
  caption: {...textStyles.Caption, color: colors['text/secondary']},
  card: {borderWidth: 1, borderColor: colors['border/subtle'], borderRadius: sizes['radius/lg'], backgroundColor: colors['surface/card'], paddingHorizontal: sizes['space/4'], overflow: 'hidden'},
  rule: {borderTopWidth: 1, borderTopColor: colors['border/subtle']},
  link: {...textStyles['Body/Strong'], color: colors['action/primary'], textAlign: 'center'},
  linkTap: {minHeight: sizes['tap/min'], alignItems: 'center', justifyContent: 'center'},
  fill: {flexGrow: 1, minHeight: sizes['space/4']},
  error: {...textStyles.Caption, color: colors['text/warning']},
});
