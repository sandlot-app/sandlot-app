import { useState } from 'react';
import { tokens } from '@sandlot/tokens';
import type { PitchResult } from '@sandlot/engine';
import { router } from 'expo-router';
import { Image, Platform, Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { createStyles } from '../../../style';
import { ScorerBar, TranscriptCard, VoiceBar, type Pitch, type SyncState } from '../../../scorer-ui';
import { belowBarSpace } from '../../components/bottom-space.ts';
import { Field } from '../../components/field.tsx';
import { GameStatus } from '../../components/game-status.tsx';
import { CaretLeftIcon } from '../../components/icons.tsx';
import { LastPitch, Matchup } from '../../components/matchup.tsx';
import { PlaySheets } from '../../components/play-sheets.tsx';
import { Scoreboard } from '../../components/scoreboard.tsx';
import { demoSetup } from '../../scoring/demo-game.ts';
import { blockedMessages, gameSummary } from '../../scoring/game-summary.ts';
import { playLabel } from '../../scoring/play-label.ts';
import { beginInPlay } from '../../scoring/tap-play.ts';
import type { PlayDraft } from '../../scoring/tap-play.ts';
import { useOfflineGame } from '../../scoring/use-offline-game.tsx';
import { useVoice } from '../../voice/use-voice.tsx';

const { colors, sizes } = tokens.modes.Light;

const pitchResults: Record<Exclude<Pitch, 'in-play'>, Exclude<PitchResult, 'in_play'>> = {
  ball: 'ball',
  'strike-looking': 'called_strike',
  'strike-swinging': 'swinging_strike',
  foul: 'foul',
};

const spacerHeight = (height: number) => ({ height });

function NavBar() {
  return (
    <View style={styles.nav}>
      <Pressable onPress={() => router.replace('/')} accessibilityRole="button" accessibilityLabel="Your games"
        style={({ pressed }) => [styles.navButton, pressed && styles.pressed]} testID="games-navigation">
        <CaretLeftIcon color={colors['text/primary']} />
      </Pressable>
      <View style={styles.wordmark} accessible accessibilityLabel="Sandlot" testID="sandlot-brand">
        <Text style={styles.wordmarkText}>sandlot</Text>
        <Image source={require('../../../assets/scorer/logo-emblem.png')} accessible={false} style={styles.emblem} />
      </View>
      <View style={styles.navButton} />
    </View>
  );
}

export default function ScoreScreen() {
  const { view, record } = useOfflineGame();
  const [draft, setDraft] = useState<PlayDraft | null>(null);
  const [dockHeight, setDockHeight] = useState(0);
  const { fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const game = view.kind === 'ready' || view.kind === 'saving' || view.kind === 'blocked' ? view.game : null;
  const voice = useVoice(game, record);

  if (!game)
    return (
      <SafeAreaView style={styles.screen}>
        <NavBar />
        <GameStatus />
        <Pressable onPress={() => router.replace('/')} accessibilityRole="button" style={styles.homeButton} testID="empty-game-navigation">
          <Text style={styles.homeLabel}>Your games</Text>
        </Pressable>
      </SafeAreaView>
    );

  const state = game.state;
  const saving = view.kind === 'saving';
  const enabled = view.kind === 'ready' && state.status !== 'final';
  const largeText = fontScale > 1.35;
  const lastPlay = game.lastPlay ? playLabel(game.lastPlay) : '';
  const sync: SyncState = saving
    ? { status: 'saving', lastPlay }
    : { status: 'offline', lastPlay, waiting: game.waitingPlays };
  const onPitch = (pitch: Pitch) => {
    voice.dismiss();
    if (pitch === 'in-play') setDraft(beginInPlay(game, new Date().toISOString()));
    else void record({ kind: 'pitch', result: pitchResults[pitch] });
  };

  const content = (
    <>
      <Field state={state} />
      <Matchup state={state} limits={demoSetup.rules.pitchCountLimits} />
      <LastPitch label={lastPlay || null} pitch={game.lastPitchNumber} />
    </>
  );
  const dock = (
    <View style={largeText ? null : styles.dock} onLayout={(event) => setDockHeight(event.nativeEvent.layout.height)}>
      {voice.message ? <Text testID="voice-message" style={styles.message} accessibilityLiveRegion="polite">{voice.message}</Text>
        : view.kind === 'ready' && view.problem && view.message ? <Text testID="action-message" style={styles.message} accessibilityLiveRegion="polite">{view.message}</Text> : null}
      <GameStatus />
      {voice.card ? <TranscriptCard card={voice.card} onChoose={voice.choose} /> : null}
      <ScorerBar sync={sync} onPitch={onPitch} onUndo={() => { voice.dismiss(); void record({ kind: 'undo' }); }}
        onMore={() => { voice.dismiss(); setDraft({ kind: 'more', game }); }} disabled={!enabled}
        voice={<VoiceBar listening={voice.listening} disabled={!enabled} onStart={voice.start} onRelease={voice.release} onCancel={voice.cancel} testID="voice-bar" />}
        undoDisabled={view.kind !== 'ready' || !game.canUndo} testID="scorer-bar" syncTestID="waiting-plays" />
      <View style={[styles.belowBar, spacerHeight(belowBarSpace(Platform.OS, insets.bottom))]} />
    </View>
  );

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.screen} accessibilityElementsHidden={draft !== null} importantForAccessibility={draft ? 'no-hide-descendants' : 'auto'}>
        <NavBar />
        {largeText ? (
          <ScrollView testID="game-content" contentContainerStyle={styles.content}>
            <Scoreboard state={state} summary={gameSummary(state)} />
            {content}
            {dock}
          </ScrollView>
        ) : (
          <>
            <View style={styles.pinned}><Scoreboard state={state} summary={gameSummary(state)} /></View>
            <ScrollView testID="game-content" style={styles.scrolling} contentContainerStyle={styles.content}>
              {content}
              <View style={spacerHeight(dockHeight)} />
            </ScrollView>
            {dock}
          </>
        )}
      </View>
      <PlaySheets draft={draft} onChange={setDraft} onClose={() => setDraft(null)} record={record} saving={saving} available={view.kind === 'ready'}
        message={view.kind === 'blocked' ? blockedMessages[view.reason] : view.kind === 'ready' ? view.message : null} />
    </SafeAreaView>
  );
}

const styles = createStyles({
  screen: { flex: 1, backgroundColor: colors['surface/page'] },
  nav: { height: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: sizes['space/2'] },
  navButton: { width: sizes['tap/min'], height: sizes['tap/min'], alignItems: 'center', justifyContent: 'center' },
  wordmark: { flexDirection: 'row', alignItems: 'flex-start', gap: sizes['space/1'] },
  wordmarkText: { fontSize: 24, fontWeight: '800', letterSpacing: -0.96, color: colors['scoreboard/bg'] },
  emblem: { width: 22.4, height: 22.4, top: 5.5 },
  pinned: { paddingTop: sizes['space/1'], paddingBottom: sizes['space/3'], paddingHorizontal: sizes['space/4'] },
  scrolling: { flex: 1 },
  content: { gap: sizes['space/3'], paddingHorizontal: sizes['space/4'] },
  dock: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  belowBar: { backgroundColor: colors['surface/card'] },
  message: { marginHorizontal: sizes['space/4'], marginBottom: sizes['space/2'], padding: sizes['space/3'], borderRadius: sizes['radius/md'], backgroundColor: colors['surface/warning'], color: colors['text/primary'] },
  pressed: { opacity: 0.55 },
  homeButton: { minHeight: 48, padding: sizes['space/4'] },
  homeLabel: { color: colors['action/primary'], fontSize: 15, fontWeight: '600' },
});
