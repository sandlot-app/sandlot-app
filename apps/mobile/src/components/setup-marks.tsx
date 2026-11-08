import { Platform } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { tokens } from '@sandlot/tokens';

const { colors } = tokens.modes.Light;
const hidden = {
  accessible: Platform.OS === 'web' ? undefined : false,
  'aria-hidden': Platform.OS === 'web' ? true : undefined,
} as const;

/** Figma Game setup row Chevron (167:11403): 16 wide, a 1.8 stroke. */
export function ChevronIcon() {
  return <Svg width={16} height={16} viewBox="0 0 16 16" {...hidden}>
    <Path d="M6 3.5L10.5 8L6 12.5" fill="none" stroke={colors['text/tertiary']} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>;
}

/** Figma Lineup row Drag handle (168:11324): three bars. */
export function DragHandleIcon() {
  return <Svg width={18} height={18} viewBox="0 0 18 18" {...hidden}>
    <Path d="M4 6H14M4 9H14M4 12H14" fill="none" stroke={colors['text/tertiary']} strokeWidth={1.6} strokeLinecap="round" />
  </Svg>;
}

/** Figma Bench Player Row's empty Radio (85:3061): a 2-wide ring. The selected one is a filled circle with a check over it. */
export function RadioRing() {
  return <Svg width={22} height={22} viewBox="0 0 22 22" {...hidden}>
    <Circle cx={11} cy={11} r={10} fill="none" stroke={colors['border/subtle']} strokeWidth={2} />
  </Svg>;
}
