import { tokens } from '@sandlot/tokens';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Platform, Pressable, ScrollView, Switch, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, Pattern, Rect } from 'react-native-svg';
import { createStyles } from '../../style';
import { CheckIcon, CloseIcon, CopyIcon, DownloadIcon, ShareIcon } from '../components/icons.tsx';
import type { GameShare } from './game-share.ts';
import { copyImage, saveToPhotos, shareSheet, type Capture } from './send.ts';
import { shareImages, StatCard, type Ink, type ShareKind } from './stickers.tsx';

// The sticker picker (Figma 249:14231 and 249:14419), modeled on Strava's Share Activity: story-shaped tiles on a
// checkerboard, any number picked, and a tray with the ink, the name switch and where to send them. The name starts off.
// Instagram Story is hidden until it has its Facebook App ID and native module (#70, open question 7).

const { colors, sizes, textStyles } = tokens.modes.Light;

const kinds: { kind: ShareKind; label: string; place: 'middle' | 'bottom' | 'top' }[] = [
  { kind: 'poster', label: 'POSTER', place: 'middle' },
  { kind: 'lowerThird', label: 'LOWER THIRD', place: 'bottom' },
  { kind: 'jersey', label: 'JERSEY', place: 'middle' },
  { kind: 'team', label: 'TEAM', place: 'top' },
  { kind: 'card', label: 'CARD', place: 'middle' },
];

/** The see-through checks: dark under White ink, light under Black ink. */
function Checkerboard({ ink }: { ink: Ink }) {
  const dark = ink === 'white';
  return <Svg style={styles.fill} accessible={false}>
    <Defs>
      <Pattern id="checks" width={16} height={16} patternUnits="userSpaceOnUse">
        <Rect width={16} height={16} fill={dark ? colors['text/primary'] : colors['surface/page']} />
        <Rect width={8} height={8} fill={dark ? colors['surface/card'] : colors['text/primary']} fillOpacity={dark ? 0.07 : 0.05} />
        <Rect x={8} y={8} width={8} height={8} fill={dark ? colors['surface/card'] : colors['text/primary']} fillOpacity={dark ? 0.07 : 0.05} />
      </Pattern>
    </Defs>
    <Rect width="100%" height="100%" fill="url(#checks)" />
  </Svg>;
}

/** Draws a 360-wide image at `scale`, in a box sized to the scaled image. */
function Scaled({ scale, children }: { scale: number; children: React.ReactNode }) {
  const [height, setHeight] = useState(0);
  const box = useMemo(() => ({ width: 360 * scale, height: height * scale }), [scale, height]);
  const inner = useMemo(() => ({ transform: [{ scale }], transformOrigin: '0% 0%' }), [scale]);
  return <View style={box}>
    <View style={[styles.scaledInner, inner]} onLayout={(event) => setHeight(event.nativeEvent.layout.height)}>{children}</View>
  </View>;
}

/** iOS's Reduce Transparency setting, so the frosted tray can turn solid. */
function useReduceTransparency(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceTransparencyEnabled().then(setReduce).catch(() => {});
    const subscription = AccessibilityInfo.addEventListener('reduceTransparencyChanged', setReduce);
    return () => subscription.remove();
  }, []);
  return reduce;
}

/** A light tick on the same press that picks or unpicks a tile. */
function pickFeedback(on: boolean) {
  const done = Platform.OS === 'ios' ? Haptics.selectionAsync()
    : Haptics.performAndroidHapticsAsync(on ? Haptics.AndroidHaptics.Toggle_On : Haptics.AndroidHaptics.Toggle_Off);
  done.catch(() => {});
}

function Destination({ label, icon, disabled, onPress, testID }:
  { label: string; icon: React.ReactNode; disabled: boolean; onPress: () => void; testID: string }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} disabled={disabled}
    testID={testID} onPress={onPress} style={({ pressed }) => [styles.destination, disabled && styles.disabled, pressed && styles.pressed]}>
    <View style={styles.destinationCircle}>{icon}</View>
    <Text style={styles.destinationLabel}>{label}</Text>
  </Pressable>;
}

export function ShareScreen({ share, onClose }: { share: GameShare; onClose: () => void }) {
  const { width } = useWindowDimensions();
  const [ink, setInk] = useState<Ink>('white');
  const [showName, setShowName] = useState(false);
  const [picked, setPicked] = useState<ShareKind[]>(['poster']);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const views = useRef<Partial<Record<ShareKind, Capture['view']>>>({});
  // A frosted tray the grid scrolls under (iOS), solid with Reduce Transparency. Android stays solid: Expo's blur there
  // needs the grid wrapped in a blur target and still mostly draws a plain see-through layer.
  const reduceTransparency = useReduceTransparency();
  const frosted = Platform.OS === 'ios' && !reduceTransparency;
  const { bottom } = useSafeAreaInsets();
  const heights = useRef<Partial<Record<ShareKind, number>>>({});
  const [trayHeight, setTrayHeight] = useState(240);

  const tileWidth = Math.floor((Math.min(width, 430) - sizes['space/4'] * 2 - 13) / 2);
  const tile = useMemo(() => ({ width: tileWidth, height: Math.round(tileWidth * 16 / 9) }), [tileWidth]);
  const stickerScale = tileWidth * 0.868 / 360;
  const topGap = useMemo(() => ({ height: Math.round(tile.height * 0.23) }), [tile.height]);
  const homeGap = useMemo(() => ({ height: Math.max(bottom, sizes['space/4']) }), [bottom]);
  const cardScale = tileWidth * 0.79 / 360;
  // The grid scrolls under the tray, so its last row needs room for the tray as it's laid out: taller on a small
  // phone, where the name switch wraps, and with larger text.
  const trayRoom = useMemo(() => ({ width: '100%' as const, height: trayHeight + sizes['space/4'] }), [trayHeight]);

  const toggle = (kind: ShareKind) => {
    pickFeedback(!picked.includes(kind));
    setMessage(null);
    setPicked((now) => (now.includes(kind) ? now.filter((item) => item !== kind) : kinds.map((item) => item.kind).filter((item) => item === kind || now.includes(item))));
  };
  const captures = (): Capture[] => picked.flatMap((kind) => {
    const view = views.current[kind];
    const height = heights.current[kind];
    return view && height ? [{ view, height }] : [];
  });
  const send = async (action: (items: [Capture, ...Capture[]]) => Promise<string | null>) => {
    const items = captures();
    if (items.length === 0 || items.length !== picked.length) {
      setMessage('Still getting the stickers ready. Try again.');
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      setMessage(await action(items as [Capture, ...Capture[]]));
    } catch {
      setMessage('That didn’t work. Try again.');
    } finally {
      setBusy(false);
    }
  };
  const single = picked.length === 1;
  const hint = message ?? (picked.length === 0 ? 'Pick a sticker to share.'
    : picked.length > 1 ? 'Copy and More send one sticker at a time. Save keeps them all.' : null);
  const imageProps = { share, ink, showName };

  return <SafeAreaView style={styles.screen} edges={['top']}>
    <View style={styles.header}>
      <Pressable accessibilityRole="button" accessibilityLabel="Close" testID="share-close" onPress={onClose}
        style={({ pressed }) => [styles.close, pressed && styles.pressed]}>
        <CloseIcon color={colors['text/primary']} size={20} />
      </Pressable>
      <View style={styles.titleStack}>
        <Text style={styles.title}>{`Share ${share.first}’s game`}</Text>
        <Text style={styles.count} testID="share-picked-count">{`${picked.length} picked`}</Text>
      </View>
      <View style={styles.headerSpacer} />
    </View>
    <ScrollView contentContainerStyle={styles.grid} testID="share-grid">
      {kinds.map(({ kind, label, place }) => {
        const on = picked.includes(kind);
        const Image = kind === 'card' ? null : shareImages[kind];
        const shows = `${showName ? `${share.first} ${share.last}` : share.team}, number ${share.number}`;
        return <Pressable key={kind} accessibilityRole="checkbox"
          accessibilityLabel={`${kind === 'card' ? 'Stat card' : `${label[0]}${label.slice(1).toLowerCase()} sticker`}, ${shows}`}
          accessibilityState={{ checked: on }} testID={`share-tile-${kind}`} disabled={busy} onPress={() => toggle(kind)}
          style={({ pressed }) => [styles.tile, tile, on && styles.tileOn, ink === 'black' && !on && styles.tileLight, pressed && styles.tilePressed]}>
          <Checkerboard ink={ink} />
          <View style={[styles.tileStage, place === 'bottom' && styles.stageBottom, place === 'top' && styles.stageTop]}>
            {place === 'top' ? <View style={topGap} /> : null}
            <Scaled scale={kind === 'card' ? cardScale : stickerScale}>
              {Image ? <Image {...imageProps} /> : <StatCard share={share} showName={showName} />}
            </Scaled>
          </View>
          <View style={styles.chip}><Text style={styles.chipText}>{label}</Text></View>
          <View style={[styles.mark, on ? styles.markOn : ink === 'white' ? styles.markOffDark : styles.markOffLight]}>
            {on ? <CheckIcon color={colors['text/on-accent']} size={14} /> : null}
          </View>
        </Pressable>;
      })}
      <View style={trayRoom} />
    </ScrollView>
    <View style={[styles.tray, !frosted && styles.traySolid]} onLayout={(event) => setTrayHeight(event.nativeEvent.layout.height)}>
      {frosted ? <View style={styles.trayClip} pointerEvents="none">
        <BlurView tint="systemChromeMaterialLight" intensity={80} style={styles.fill} />
      </View> : null}
      <View style={styles.trayRow}>
        <View style={styles.inks} accessibilityRole="radiogroup">
          {(['white', 'black'] as const).map((option) => <Pressable key={option} accessibilityRole="radio" accessibilityState={{ selected: ink === option }}
            testID={`share-ink-${option}`} disabled={busy} onPress={() => setInk(option)}
            style={({ pressed }) => [styles.inkChip, ink === option && styles.inkChipOn, pressed && styles.pressed]}>
            <View style={[styles.swatch, option === 'white' ? styles.swatchWhite : styles.swatchBlack]} />
            <Text style={styles.inkLabel}>{option === 'white' ? 'White' : 'Black'}</Text>
          </Pressable>)}
        </View>
        <View style={styles.nameSwitch}>
          <Text style={styles.inkLabel}>Show name</Text>
          <Switch value={showName} disabled={busy} onValueChange={(value) => { setShowName(value); setMessage(null); }} testID="share-show-name"
            accessibilityLabel={`Show ${share.first}’s name`} trackColor={{ true: colors['action/strong'], false: colors['border/subtle'] }} />
        </View>
      </View>
      <View style={styles.destinations}>
        <Destination label="Copy" testID="share-copy" disabled={!single || busy} icon={<CopyIcon color={colors['text/primary']} size={26} />}
          onPress={() => send(([capture]) => copyImage(capture))} />
        <Destination label="Save" testID="share-save" disabled={picked.length === 0 || busy} icon={<DownloadIcon color={colors['text/primary']} size={26} />}
          onPress={() => send(saveToPhotos)} />
        <Destination label="More" testID="share-more" disabled={!single || busy} icon={<ShareIcon color={colors['text/primary']} size={26} />}
          onPress={() => send(([capture]) => shareSheet(capture))} />
      </View>
      {hint ? <Text style={styles.hint} accessibilityLiveRegion="polite" testID="share-hint">{hint}</Text> : null}
      <View style={homeGap} />
    </View>
    {/* Full-size copies, off screen, that become the exported PNGs. */}
    <View style={styles.offscreen} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {kinds.map(({ kind }) => {
        const Image = kind === 'card' ? null : shareImages[kind];
        return <View key={kind} ref={(view) => { views.current[kind] = view; }} collapsable={false}
          onLayout={(event) => { heights.current[kind] = event.nativeEvent.layout.height; }} style={styles.exportBox}>
          {Image ? <Image {...imageProps} /> : <StatCard share={share} showName={showName} />}
        </View>;
      })}
    </View>
  </SafeAreaView>;
}

const styles = createStyles({
  screen: { flex: 1, backgroundColor: colors['surface/page'] },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: sizes['space/3'], minHeight: 56 },
  close: { width: sizes['tap/min'], height: sizes['tap/min'], borderRadius: sizes['radius/full'], borderWidth: 1, borderColor: colors['border/subtle'],
    alignItems: 'center', justifyContent: 'center' },
  titleStack: { alignItems: 'center' },
  title: { ...textStyles['Body/Strong'], color: colors['text/primary'] },
  count: { ...textStyles['Caption'], color: colors['text/tertiary'] },
  headerSpacer: { width: sizes['tap/min'] },
  grid: { flexDirection: 'row', flexWrap: 'wrap', columnGap: sizes['space/3'], rowGap: sizes['space/3'],
    paddingHorizontal: sizes['space/4'], paddingTop: sizes['space/2'] },
  fill: { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 },
  tile: { borderRadius: sizes['radius/lg'], overflow: 'hidden' },
  tileOn: { borderWidth: 3, borderColor: colors['action/strong'] },
  tileLight: { borderWidth: 1, borderColor: colors['border/subtle'] },
  tilePressed: { transform: [{ scale: 0.97 }] },
  tileStage: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  stageBottom: { justifyContent: 'flex-end', paddingBottom: sizes['space/6'] },
  stageTop: { justifyContent: 'flex-start' },
  scaledInner: { position: 'absolute', left: 0, top: 0, width: 360 },
  chip: { position: 'absolute', left: sizes['space/2'], top: sizes['space/2'], backgroundColor: colors['surface/card'],
    borderRadius: sizes['radius/full'], paddingHorizontal: sizes['space/2'], paddingVertical: sizes['space/1'] },
  chipText: { ...textStyles['Status/Label'], color: colors['text/primary'] },
  mark: { position: 'absolute', right: sizes['space/2'], top: sizes['space/2'], width: 24, height: 24, borderRadius: sizes['radius/full'],
    alignItems: 'center', justifyContent: 'center' },
  markOn: { backgroundColor: colors['action/strong'], borderWidth: 2, borderColor: colors['surface/card'] },
  markOffDark: { borderWidth: 2, borderColor: colors['scoreboard/text'], opacity: 0.8 },
  markOffLight: { borderWidth: 2, borderColor: colors['text/primary'], opacity: 0.8 },
  tray: { position: 'absolute', left: 0, right: 0, bottom: 0, borderTopLeftRadius: sizes['radius/xl'],
    borderTopRightRadius: sizes['radius/xl'], paddingHorizontal: sizes['space/4'], paddingTop: sizes['space/4'], gap: sizes['space/3'],
    shadowColor: colors['text/primary'], shadowOpacity: 0.08, shadowRadius: sizes['radius/lg'], shadowOffset: { width: 0, height: -6 } },
  traySolid: { backgroundColor: colors['surface/page'] },
  trayClip: { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, borderTopLeftRadius: sizes['radius/xl'], borderTopRightRadius: sizes['radius/xl'],
    overflow: 'hidden' },
  trayRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', rowGap: sizes['space/2'] },
  inks: { flexDirection: 'row', gap: sizes['space/2'] },
  inkChip: { flexDirection: 'row', alignItems: 'center', gap: sizes['space/2'], minHeight: sizes['tap/min'], paddingHorizontal: sizes['space/3'],
    borderRadius: sizes['radius/full'], borderWidth: 1, borderColor: colors['border/subtle'], backgroundColor: colors['surface/card'] },
  inkChipOn: { borderWidth: 2, borderColor: colors['action/strong'] },
  swatch: { width: 20, height: 20, borderRadius: sizes['radius/full'], borderWidth: 1, borderColor: colors['border/subtle'] },
  swatchWhite: { backgroundColor: colors['surface/card'] },
  swatchBlack: { backgroundColor: colors['text/primary'] },
  inkLabel: { ...textStyles['Body/Strong'], color: colors['text/primary'] },
  nameSwitch: { flexDirection: 'row', alignItems: 'center', gap: sizes['space/2'] },
  destinations: { flexDirection: 'row', justifyContent: 'space-around' },
  destination: { width: 80, alignItems: 'center', gap: sizes['space/2'] },
  destinationCircle: { width: 56, height: 56, borderRadius: sizes['radius/full'], borderWidth: 1, borderColor: colors['border/subtle'],
    backgroundColor: colors['surface/card'], alignItems: 'center', justifyContent: 'center' },
  destinationLabel: { ...textStyles['Caption'], color: colors['text/primary'], textAlign: 'center' },
  disabled: { opacity: 0.35 },
  pressed: { transform: [{ scale: 0.97 }] },
  hint: { ...textStyles['Caption'], color: colors['text/tertiary'] },
  offscreen: { position: 'absolute', left: -10000, top: 0, width: 360 },
  exportBox: { width: 360, alignSelf: 'flex-start' },
});
