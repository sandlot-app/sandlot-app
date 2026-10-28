import { tokens } from '@sandlot/tokens';
import { useState } from 'react';
import { Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { PitchButton, PlayerChip, PrimaryButton, ScorerBar, Sheet, SheetHeader, SheetSection, VoiceBar, type Pitch, type SyncState } from './scorer-ui';
import { barView, type MicStatus } from './src/voice/mic-status.ts';
import { createStyles } from './style';

const { colors, sizes, textStyles } = tokens.modes.Light;
type GallerySection = 'all' | 'sheet' | 'headers' | 'button' | 'chips' | 'bar';

function requestedSection(): GallerySection {
  if (Platform.OS !== 'web') return 'all';
  const value = new URLSearchParams(globalThis.location.search).get('gallery');
  return value === 'sheet' || value === 'headers' || value === 'button' || value === 'chips' || value === 'bar' ? value : 'all';
}

export default function ScorerGallery({ onExit }: { onExit: () => void }) {
  const section = requestedSection();
  const [sheetOpen, setSheetOpen] = useState(section === 'sheet');
  const [buttonCount, setButtonCount] = useState(0);
  const [barResult, setBarResult] = useState('No scorer action yet');
  const [lastPitch, setLastPitch] = useState('Ball');
  const show = (name: GallerySection) => section === 'all' || section === name;
  const onPitch = (pitch: Pitch) => { setLastPitch(pitch); setBarResult(`Pitch: ${pitch}`); };
  const saved: SyncState = { status: 'saved', lastPlay: lastPitch };
  const voiceBarFor = (mic: MicStatus) => <VoiceBar listening={false} mic={mic} onStart={() => setBarResult('Voice pressed')} onRelease={() => {}} onCancel={() => {}} />;
  const voiceBar = voiceBarFor('off');
  return <View style={styles.root}>
    <ScrollView contentContainerStyle={styles.content}>
      <Pressable accessibilityRole="button" onPress={onExit} style={styles.exit}><Text style={styles.exitText}>‹ Sandlot</Text></Pressable>
      <Text style={styles.title}>Scorer UI gallery</Text>
      {show('sheet') ? <View style={styles.section}>
        <Text style={styles.heading}>Sheet</Text>
        <Text style={styles.caption}>Bottom anchored · scrim or drag down to close</Text>
        <PrimaryButton label="Open sheet" onPress={() => setSheetOpen(true)} testID="gallery-open-sheet" />
        {!sheetOpen ? <Text style={styles.caption} testID="gallery-sheet-closed">Sheet closed</Text> : null}
      </View> : null}
      {show('headers') ? <View style={styles.section}>
        <Text style={styles.heading}>Sheet headers</Text>
        <View style={styles.sampleCard}>
          <SheetHeader title="What happened?" step={1} steps={3} onCancel={() => {}} />
          <SheetHeader title="Who fielded it?" step={2} steps={3} onBack={() => {}} onCancel={() => {}} />
          <SheetHeader title="Where did runners end up?" step={3} steps={3} onBack={() => {}} onCancel={() => {}} />
        </View>
      </View> : null}
      {show('button') ? <View style={styles.section} testID="gallery-button">
        <Text style={styles.heading}>Primary button</Text>
        <PrimaryButton label="Save play" onPress={() => setButtonCount((count) => count + 1)} testID="gallery-enabled-button" />
        <PrimaryButton label="Save play" disabled onPress={() => setButtonCount((count) => count + 1)} testID="gallery-disabled-button" />
        <Text style={styles.caption} testID="gallery-button-count">Pressed {buttonCount} {buttonCount === 1 ? 'time' : 'times'}</Text>
      </View> : null}
      {show('chips') ? <View style={styles.section}>
        <Text style={styles.heading}>Player chip</Text>
        <View style={styles.fieldSample}>
          {(['fielding', 'batting', 'batter'] as const).map((role) => <View key={role} style={styles.chipRow}>
            <PlayerChip number="6" name="L. Darcy" role={role} testID={`gallery-chip-${role}`} />
            <PlayerChip number="6" name="L. Darcy" role={role} followed testID={`gallery-chip-${role}-followed`} />
            <Text style={styles.chipRole}>{role}</Text>
          </View>)}
        </View>
      </View> : null}
      {show('bar') ? <View style={styles.section}>
        <Text style={styles.heading}>Scorer bar</Text>
        <Text style={styles.caption}>{barResult}</Text>
        <ScorerBar sync={saved} onPitch={onPitch} onUndo={() => setBarResult('Undo pressed')} onMore={() => setBarResult('More pressed')} voice={voiceBar} testID="gallery-scorer-bar-saved" />
        <ScorerBar sync={{ status: 'saving', lastPlay: 'Strike' }} onPitch={onPitch} onUndo={() => setBarResult('Undo pressed')} onMore={() => setBarResult('More pressed')} voice={voiceBar} testID="gallery-scorer-bar-saving" />
        <ScorerBar sync={{ status: 'offline', lastPlay: 'Ball', waiting: 3 }} onPitch={onPitch} onUndo={() => setBarResult('Undo pressed')} onMore={() => setBarResult('More pressed')} voice={voiceBar} testID="gallery-scorer-bar-offline" />
        <Text style={styles.heading}>Voice bar and the mic</Text>
        <Text style={styles.caption}>{(['ready', 'refused', 'busy'] as const).map((mic) => barView(mic, false).label).join(' · ')}</Text>
        {(['ready', 'refused', 'busy'] as const).map((mic) => <ScorerBar key={mic} sync={saved} onPitch={onPitch} onUndo={() => setBarResult('Undo pressed')} onMore={() => setBarResult('More pressed')}
          voice={voiceBarFor(mic)} testID={`gallery-scorer-bar-mic-${mic}`} />)}
        <Text style={styles.heading}>Disabled pitch buttons</Text>
        <View style={styles.pitchSampleRow} testID="gallery-disabled-pitches">
          <PitchButton label="Ball" kind="ball" disabled onPress={() => {}} />
          <PitchButton label="Strike" kind="strike" disabled onPress={() => {}} />
          <PitchButton label="Foul" kind="foul" disabled onPress={() => {}} />
          <PitchButton label="In play" kind="in-play" disabled onPress={() => {}} />
        </View>
      </View> : null}
    </ScrollView>
    <Sheet open={sheetOpen} onRequestClose={() => setSheetOpen(false)} testID="gallery-sheet"
      header={<SheetHeader title="More" cancelLabel="Done" onCancel={() => setSheetOpen(false)} />}
      actions={<PrimaryButton label="Close sample" onPress={() => setSheetOpen(false)} />}>
      <SheetSection label="Sample section"><View style={styles.sampleRow}><Text style={styles.rowText}>First option</Text></View><View style={styles.sampleRow}><Text style={styles.rowText}>Second option</Text></View></SheetSection>
      <SheetSection label="Another section"><View style={styles.sampleRow}><Text style={styles.rowText}>Third option</Text></View></SheetSection>
    </Sheet>
  </View>;
}

const styles = createStyles({
  root: { flex: 1, backgroundColor: colors['surface/page'] },
  content: { paddingHorizontal: sizes['space/4'], paddingTop: sizes['space/6'], paddingBottom: sizes['space/6'], gap: sizes['space/6'] },
  exit: { minHeight: sizes['tap/min'], justifyContent: 'center' },
  exitText: { ...textStyles['Body/Strong'], color: colors['action/primary'] },
  title: { ...textStyles['Player/Name'], color: colors['text/primary'] },
  section: { gap: sizes['space/3'] },
  heading: { ...textStyles['Body/Strong'], color: colors['text/primary'] },
  caption: { ...textStyles.Caption, color: colors['text/secondary'] },
  sampleCard: { backgroundColor: colors['surface/card'], borderRadius: sizes['radius/lg'], overflow: 'hidden' },
  fieldSample: { backgroundColor: colors['field/grass'], padding: sizes['space/4'], borderRadius: sizes['radius/lg'], gap: sizes['space/4'] },
  chipRow: { flexDirection: 'row', alignItems: 'center', gap: sizes['space/4'] },
  chipRole: { ...textStyles.Caption, color: colors['text/on-accent'] },
  sampleRow: { minHeight: 56, justifyContent: 'center', borderWidth: 1, borderColor: colors['border/subtle'], borderRadius: sizes['radius/md'], paddingHorizontal: sizes['space/3'] },
  pitchSampleRow: { flexDirection: 'row', gap: sizes['space/2'] },
  rowText: { ...textStyles['Body/Strong'], color: colors['text/primary'] },
});
