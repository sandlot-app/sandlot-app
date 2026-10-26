import { tokens } from '@sandlot/tokens';
import { useMemo, useState, type ReactNode } from 'react';
import { Image, PanResponder, Pressable, ScrollView, Text, View } from 'react-native';
import { createStyles } from './style';

const { colors, sizes, textStyles } = tokens.modes.Light;
const dragTransform = (translateY: number) => ({ transform: [{ translateY }] });

export type SyncState =
  | { status: 'saved'; lastPlay: string }
  | { status: 'saving'; lastPlay: string }
  | { status: 'offline'; lastPlay: string; waiting: number };

export type Pitch = 'ball' | 'strike-looking' | 'strike-swinging' | 'foul' | 'in-play';

export function Sheet({ open, onRequestClose, header, children, actions, testID }: {
  open: boolean;
  onRequestClose: () => void;
  header: ReactNode;
  children: ReactNode;
  actions?: ReactNode;
  testID?: string;
}) {
  const [dragOffset, setDragOffset] = useState(0);
  const responder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, gesture) => gesture.dy > sizes['space/2'] && Math.abs(gesture.dy) > Math.abs(gesture.dx),
    onPanResponderMove: (_, gesture) => setDragOffset(Math.max(0, gesture.dy)),
    onPanResponderRelease: (_, gesture) => {
      setDragOffset(0);
      if (gesture.dy > sizes['space/2'] * 10 || gesture.vy > 0.7) onRequestClose();
    },
    onPanResponderTerminate: () => setDragOffset(0),
  }), [onRequestClose]);

  if (!open) return null;
  return (
    <View style={styles.sheetOverlay} testID={testID}>
      <Pressable accessibilityLabel="Close sheet" onPress={onRequestClose} style={styles.scrim} testID="sheet-scrim" />
      <View style={[styles.sheet, dragTransform(dragOffset)]}>
        <View {...responder.panHandlers} testID="sheet-grabber">
          <View style={styles.grabber} />
          {header}
        </View>
        <ScrollView contentContainerStyle={styles.sheetBody} style={styles.sheetScroll} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
        {actions ? <View style={styles.sheetActions}>{actions}</View> : null}
      </View>
    </View>
  );
}

export function SheetSection({ label, children }: { label?: string; children: ReactNode }) {
  return <View style={styles.section}>
    {label ? <Text style={styles.caps}>{label}</Text> : null}
    {children}
  </View>;
}

export function SheetHeader({ title, step, steps, onBack, onCancel, cancelLabel = 'Cancel' }: {
  title: string;
  step?: number;
  steps?: number;
  onBack?: () => void;
  onCancel: () => void;
  cancelLabel?: string;
}) {
  return <View style={styles.sheetHeader}>
    <View style={styles.headerSide}>
      {onBack ? <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={onBack} style={styles.headerTap}><Text style={styles.backGlyph}>‹</Text></Pressable> : null}
    </View>
    <View style={styles.headerCenter}>
      <Text style={styles.headerTitle}>{title}</Text>
      {steps && step ? <View style={styles.stepDots}>{Array.from({ length: steps }, (_, index) => <View key={index} style={index + 1 === step ? styles.stepActive : styles.stepInactive} />)}</View> : null}
    </View>
    <Pressable accessibilityRole="button" onPress={onCancel} style={styles.headerCancel}><Text style={styles.link}>{cancelLabel}</Text></Pressable>
  </View>;
}

export function PrimaryButton({ label, onPress, disabled = false, testID }: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  testID?: string;
}) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={disabled ? styles.primaryDisabled : styles.primary} testID={testID}>
    <Text style={disabled ? styles.primaryDisabledText : styles.primaryText}>{label}</Text>
  </Pressable>;
}

export function PlayerChip({ number, name, role, followed = false, layout = 'field', onPress, testID }: {
  number: string;
  name: string;
  role: 'fielding' | 'batting' | 'batter';
  layout?: 'field' | 'inline';
  followed?: boolean;
  onPress?: () => void;
  testID?: string;
}) {
  const chip = <View style={layout === 'inline' ? styles.inlineChip : styles.playerChip}>
    <View style={followed && styles.followedCircle}>
      <View style={[role === 'fielding' ? styles.fieldingCircle : role === 'batter' ? styles.batterCircle : styles.battingCircle, layout === 'inline' && styles.inlineCircle, followed && styles.followedInner]}>
        <Text style={role === 'fielding' ? styles.fieldingNumber : styles.battingNumber}>{number}</Text>
        {role === 'batter' && layout === 'field' ? <View style={styles.batSlot} pointerEvents="none">
          <View style={styles.batTurn}>
            <Image source={require('./assets/scorer/bat.png')} accessible={false} style={styles.batImage} />
          </View>
        </View> : null}
      </View>
    </View>
    <Text style={layout === 'inline' ? styles.inlineName : styles.chipName} numberOfLines={1}>{name}</Text>
  </View>;
  return onPress ? <Pressable accessibilityRole="button" accessibilityLabel={`${name}, number ${number}`} onPress={onPress} testID={testID}>{chip}</Pressable> : <View testID={testID}>{chip}</View>;
}

export function PitchButton({ label, kind, onPress, selected, disabled = false, testID }: {
  label: string;
  kind: 'ball' | 'strike' | 'foul' | 'in-play';
  onPress: () => void;
  selected?: boolean;
  disabled?: boolean;
  testID?: string;
}) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={[styles.pitchButton, (selected || disabled) && styles.pitchSelected]} testID={testID}>
    <View style={styles.pitchMark}>
      {kind === 'in-play' ? <Image source={require('./assets/scorer/baseball.png')} accessible={false} style={styles.pitchBaseball} />
        : <View style={kind === 'ball' ? styles.ballDot : kind === 'strike' ? styles.strikeDot : styles.foulDot} />}
    </View>
    <Text style={styles.pitchLabel}>{label}</Text>
  </Pressable>;
}

function SyncStatus({ state, syncTestID }: { state: SyncState; syncTestID?: string }) {
  const last = state.lastPlay ? `Last: ${state.lastPlay} · ` : '';
  const label = state.status === 'saved'
    ? `${last}All plays saved`
    : state.status === 'saving'
      ? 'Saving...'
      : `${last}Offline · ${state.waiting} ${state.waiting === 1 ? 'play' : 'plays'} saved on this phone`;
  return <View style={styles.syncLine}>
    <Text style={state.status === 'offline' ? styles.syncOffline : state.status === 'saving' ? styles.syncMuted : styles.syncSaved}>{state.status === 'saved' ? '✓' : state.status === 'offline' ? '●' : '⟳'}</Text>
    <Text style={state.status === 'offline' ? styles.syncOffline : styles.syncMuted} testID={syncTestID}>{label}</Text>
  </View>;
}

export function ScorerBar({ onPitch, onUndo, onMore, sync, disabled = false, undoDisabled = disabled, testID, syncTestID }: {
  onPitch: (pitch: Pitch) => void;
  onUndo: () => void;
  onMore: () => void;
  sync: SyncState;
  disabled?: boolean;
  undoDisabled?: boolean;
  testID?: string;
  syncTestID?: string;
}) {
  const [choosingStrike, setChoosingStrike] = useState(false);
  const recordPitch = (pitch: Pitch) => { setChoosingStrike(false); onPitch(pitch); };
  return <View style={styles.scorerBar} testID={testID}>
    {choosingStrike ? <View style={styles.strikeControls}>
      <View style={styles.strikeChooser}>
        <Text style={styles.strikeHeading}>Strike —</Text>
        <Pressable accessibilityRole="button" onPress={() => recordPitch('strike-looking')} style={styles.strikeOption} testID="strike-looking"><Text style={styles.pitchLabel}>Looking</Text></Pressable>
        <Pressable accessibilityRole="button" onPress={() => recordPitch('strike-swinging')} style={styles.strikeOption} testID="strike-swinging"><Text style={styles.pitchLabel}>Swinging</Text></Pressable>
      </View>
      <View style={styles.strikeProgress}><View style={styles.strikeProgressFill} /></View>
    </View> : null}
    <View style={styles.pitchRow}>
      <PitchButton label="Ball" kind="ball" disabled={disabled} onPress={() => recordPitch('ball')} testID="pitch-ball" />
      <PitchButton label="Strike" kind="strike" disabled={disabled} selected={choosingStrike} onPress={() => setChoosingStrike(true)} testID="pitch-strike" />
      <PitchButton label="Foul" kind="foul" disabled={disabled} onPress={() => recordPitch('foul')} testID="pitch-foul" />
      <PitchButton label="In play" kind="in-play" disabled={disabled} onPress={() => recordPitch('in-play')} testID="pitch-in-play" />
    </View>
    <View style={styles.barActions}>
      <Pressable accessibilityRole="button" accessibilityLabel={sync.lastPlay ? `Undo · ${sync.lastPlay}` : 'Undo'} accessibilityState={{ disabled: undoDisabled }}
        disabled={undoDisabled} onPress={onUndo} style={[styles.undoButton, undoDisabled && styles.dimmed]} testID="scorer-undo">
        <Image source={require('./assets/scorer/undo.png')} accessible={false} style={styles.undoIcon} />
        <Text style={styles.undoText}>{sync.lastPlay ? `Undo · ${sync.lastPlay}` : 'Undo'}</Text>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="More" accessibilityState={{ disabled }} disabled={disabled}
        onPress={onMore} style={[styles.moreButton, disabled && styles.dimmed]} testID="scorer-more"><Text style={styles.moreGlyph}>•••</Text></Pressable>
    </View>
    <SyncStatus state={sync} syncTestID={syncTestID} />
  </View>;
}

const styles = createStyles({
  sheetOverlay: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, justifyContent: 'flex-end', zIndex: 20 },
  scrim: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: colors['chip/label/halo'], opacity: 0.48 },
  sheet: { maxHeight: '90%', minHeight: 180, backgroundColor: colors['surface/card'], borderTopLeftRadius: sizes['radius/lg'], borderTopRightRadius: sizes['radius/lg'], overflow: 'hidden', paddingBottom: sizes['space/4'] },
  grabber: { width: 36, height: 4, borderRadius: sizes['radius/full'], backgroundColor: colors['border/subtle'], alignSelf: 'center', marginTop: sizes['space/2'] },
  sheetHeader: { minHeight: 64, flexDirection: 'row', alignItems: 'center', paddingHorizontal: sizes['space/4'] },
  headerSide: { width: 64, alignItems: 'flex-start' },
  headerTap: { minWidth: sizes['tap/min'], minHeight: sizes['tap/min'], justifyContent: 'center' },
  backGlyph: { color: colors['text/primary'], fontSize: 32, lineHeight: 36 },
  headerCenter: { flex: 1, alignItems: 'center', gap: sizes['space/1'] },
  headerTitle: { ...textStyles['Body/Strong'], color: colors['text/primary'], textAlign: 'center' },
  stepDots: { flexDirection: 'row', alignItems: 'center', gap: sizes['space/1'] },
  stepActive: { width: 18, height: 6, borderRadius: sizes['radius/full'], backgroundColor: colors['logo/background'] },
  stepInactive: { width: 6, height: 6, borderRadius: sizes['radius/full'], backgroundColor: colors['border/subtle'] },
  headerCancel: { width: 64, minHeight: sizes['tap/min'], justifyContent: 'center', alignItems: 'flex-end' },
  link: { ...textStyles['Body/Strong'], color: colors['action/primary'] },
  sheetScroll: { flexGrow: 0, flexShrink: 1 },
  sheetBody: { paddingHorizontal: sizes['space/4'], paddingTop: sizes['space/4'], paddingBottom: sizes['space/2'], gap: sizes['space/4'] },
  sheetActions: { paddingHorizontal: sizes['space/4'], paddingTop: sizes['space/4'], gap: sizes['space/3'] },
  section: { gap: sizes['space/2'] },
  caps: { ...textStyles['Label/Caps'], color: colors['text/tertiary'], textTransform: 'uppercase' },
  primary: { minHeight: 52, borderRadius: sizes['radius/full'], backgroundColor: colors['scoreboard/bg'], alignItems: 'center', justifyContent: 'center', paddingHorizontal: sizes['space/4'] },
  primaryDisabled: { minHeight: 52, borderRadius: sizes['radius/full'], backgroundColor: colors['border/subtle'], alignItems: 'center', justifyContent: 'center', paddingHorizontal: sizes['space/4'] },
  primaryText: { ...textStyles['Body/Strong'], color: colors['text/on-accent'] },
  primaryDisabledText: { ...textStyles['Body/Strong'], color: colors['text/tertiary'] },
  inlineChip: { flexDirection: 'row', alignItems: 'center', gap: sizes['space/2'] },
  inlineCircle: { width: 28, height: 28, borderWidth: 0 },
  inlineName: { ...textStyles['Body/Strong'], color: colors['text/primary'], flexShrink: 1 },
  playerChip: { width: 74, alignItems: 'center', gap: sizes['space/1'] },
  fieldingCircle: { width: sizes['chip/size'], height: sizes['chip/size'], borderRadius: sizes['radius/full'], backgroundColor: colors['chip/fielding/bg'], borderWidth: sizes['chip/outline-width'], borderColor: colors['chip/outline'], alignItems: 'center', justifyContent: 'center' },
  battingCircle: { width: sizes['chip/size'], height: sizes['chip/size'], borderRadius: sizes['radius/full'], backgroundColor: colors['chip/batting/bg'], borderWidth: sizes['chip/outline-width'], borderColor: colors['chip/outline'], alignItems: 'center', justifyContent: 'center' },
  batterCircle: { width: sizes['chip/batter-size'], height: sizes['chip/batter-size'], borderRadius: sizes['radius/full'], backgroundColor: colors['chip/batting/bg'], borderWidth: sizes['chip/outline-width'], borderColor: colors['chip/outline'], alignItems: 'center', justifyContent: 'center' },
  followedCircle: { borderWidth: sizes['ring/width'], borderColor: colors['ring/followed'], borderRadius: sizes['radius/full'] },
  followedInner: { borderWidth: 0 },
  fieldingNumber: { ...textStyles['Chip/Number'], color: colors['chip/fielding/text'] },
  battingNumber: { ...textStyles['Chip/Number'], color: colors['chip/batting/text'] },
  batSlot: { position: 'absolute', left: 27.5, top: -1.5, width: 23.027, height: 25.578, alignItems: 'center', justifyContent: 'center' },
  batTurn: { width: 27.6, height: 6.9, transform: [{ rotate: '-50deg' }] },
  batImage: { position: 'absolute', left: -1.81, top: 0, width: 30.4462, height: 8.53875 },
  chipName: { ...textStyles['Chip/Name'], color: colors['chip/label/text'], textShadowColor: colors['chip/label/halo'], textShadowRadius: sizes['radius/sm'], textShadowOffset: { width: 0, height: 1 } },
  scorerBar: { width: '100%', backgroundColor: colors['surface/card'], borderTopLeftRadius: sizes['radius/xl'], borderTopRightRadius: sizes['radius/xl'], paddingHorizontal: sizes['space/4'], paddingTop: sizes['space/3'], paddingBottom: sizes['space/6'], gap: sizes['space/4'], borderTopWidth: 1, borderColor: colors['border/subtle'] },
  pitchRow: { flexDirection: 'row', gap: sizes['space/2'] },
  pitchButton: { flex: 1, minWidth: 0, minHeight: 64, borderWidth: 1, borderColor: colors['border/subtle'], borderRadius: sizes['radius/lg'], alignItems: 'center', justifyContent: 'center', gap: sizes['space/1'], backgroundColor: colors['surface/card'] },
  pitchSelected: { backgroundColor: colors['surface/page'] },
  pitchMark: { width: 18, height: 18, alignItems: 'center', justifyContent: 'center' },
  pitchBaseball: { position: 'absolute', left: -1.41, top: -0.56, width: 20.8125, height: 20.8125 },
  pitchLabel: { ...textStyles['Body/Strong'], color: colors['text/primary'], textAlign: 'center' },
  ballDot: { width: sizes['dot/size'], height: sizes['dot/size'], borderRadius: sizes['radius/full'], backgroundColor: colors['count/ball'] },
  strikeDot: { width: sizes['dot/size'], height: sizes['dot/size'], borderRadius: sizes['radius/full'], backgroundColor: colors['count/strike'] },
  foulDot: { width: sizes['dot/size'], height: sizes['dot/size'], borderRadius: sizes['radius/full'], borderWidth: 2, borderColor: colors['count/strike'] },
  strikeChooser: { flexDirection: 'row', alignItems: 'center', gap: sizes['space/2'] },
  strikeControls: { gap: sizes['space/2'] },
  strikeProgress: { height: 2, backgroundColor: colors['border/subtle'] },
  strikeProgressFill: { width: '67%', height: 2, backgroundColor: colors['count/strike'] },
  strikeHeading: { ...textStyles['Body/Strong'], color: colors['text/secondary'] },
  strikeOption: { flex: 1, minHeight: 40, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors['count/strike'], borderRadius: sizes['radius/full'] },
  barActions: { flexDirection: 'row', gap: sizes['space/3'] },
  undoButton: { flex: 1, minHeight: sizes['tap/min'], borderWidth: 1, borderColor: colors['border/subtle'], borderRadius: sizes['radius/full'], flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: sizes['space/1'] },
  undoIcon: { width: textStyles['Body/Strong'].lineHeight, height: textStyles['Body/Strong'].lineHeight, tintColor: colors['text/primary'] },
  undoText: { ...textStyles['Body/Strong'], color: colors['text/primary'] },
  moreButton: { width: 46, height: 46, borderWidth: 1, borderColor: colors['border/subtle'], borderRadius: sizes['radius/full'], alignItems: 'center', justifyContent: 'center' },
  dimmed: { opacity: 0.4 },
  moreGlyph: { ...textStyles['Body/Strong'], color: colors['text/primary'] },
  syncLine: { minHeight: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: sizes['space/2'] },
  syncSaved: { ...textStyles.Caption, color: colors['count/ball'] },
  syncMuted: { ...textStyles.Caption, color: colors['text/tertiary'] },
  syncOffline: { ...textStyles.Caption, color: colors['text/warning'] },
});
