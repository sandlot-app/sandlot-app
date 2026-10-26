import { initialState, presets } from '@sandlot/engine';
import { tokens } from '@sandlot/tokens';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import ScorerGallery from './scorer-gallery';
import { createStyles } from './style';

const setup = { rules: presets['moraga-mustang-first-half'], roster: { home: [], away: [] }, pitcherOutsEarlierToday: {} };
const state = initialState(setup);

export default function App() {
  const [gallery, setGallery] = useState(false);
  const directGallery = __DEV__ && typeof globalThis.location !== 'undefined' && new URLSearchParams(globalThis.location.search).has('gallery');
  if (__DEV__ && (gallery || directGallery)) return <ScorerGallery onExit={() => setGallery(false)} />;
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Sandlot</Text>
      <Text>
        Inning {state.inning}, {state.half}. {state.outs} outs. Count {state.count.balls}-{state.count.strikes}.
      </Text>
      {__DEV__ ? <Pressable accessibilityRole="button" onPress={() => setGallery(true)} style={styles.galleryLink} testID="open-scorer-gallery"><Text style={styles.galleryText}>Scorer UI gallery</Text></Pressable> : null}
      <StatusBar style="auto" />
    </View>
  );
}

const styles = createStyles({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: tokens.modes.Light.sizes['space/2'] },
  title: { fontSize: 24, fontWeight: '600' },
  galleryLink: { minHeight: tokens.modes.Light.sizes['tap/min'], justifyContent: 'center' },
  galleryText: { ...tokens.modes.Light.textStyles['Body/Strong'], color: tokens.modes.Light.colors['action/primary'] },
});
