import { Redirect, router } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { tokens } from '@sandlot/tokens';
import { PrimaryButton } from '../../../scorer-ui';
import { createStyles } from '../../../style';
import { BookHeader, BookSection, bookStyles } from '../../components/book-ui.tsx';
import { GameStatus } from '../../components/game-status.tsx';
import { BookIcon } from '../../components/book-icons.tsx';
import { displayPlayer, teamNames } from '../../scoring/roster-presentation.ts';
import { useOfflineGame } from '../../scoring/use-offline-game.tsx';

const {colors, sizes, textStyles} = tokens.modes.Light;

export default function SetupScreen() {
  const {view, record, setupDraft, setSetupDraft} = useOfflineGame();
  if ((view.kind === 'ready' || view.kind === 'saving') && view.game) return <Redirect href="/score" />;
  const available = view.kind === 'ready';
  const complete = setupDraft.lineups.home?.some((slot) => slot.position === 'P') && setupDraft.lineups.away?.some((slot) => slot.position === 'P');
  const start = async () => {
    const {home, away} = setupDraft.lineups;
    if (!home || !away || !available || !complete) return;
    if (await record({kind: 'start', selection: {seasonHalf: setupDraft.seasonHalf, lineups: {home, away}}})) router.replace('/score');
  };
  return <SafeAreaView style={bookStyles.screen} testID="game-setup">
    <BookHeader title="New game" onBack={() => router.replace('/')} />
    <ScrollView contentContainerStyle={bookStyles.content}>
      <GameStatus />
      <BookSection label="Game">
        <View style={bookStyles.card}>
          {[['Away', 'Hawks'], ['Home', 'Marlins'], ['When', 'Sat, Oct 24 · 6:30 PM'], ['Field', 'Field 2'], ['Division', 'Mustang · Moraga']].map(([label, value], index) => <View key={label} style={[styles.detail, index > 0 && bookStyles.rule]}>
            <Text style={styles.label}>{label}</Text><Text style={index < 2 ? bookStyles.strong : bookStyles.body}>{value}</Text>
          </View>)}
        </View>
      </BookSection>
      <BookSection label="Season half">
        <View style={styles.segmented}>
          {(['first', 'second'] as const).map((half) => <Pressable key={half} accessibilityRole="button" accessibilityState={{selected: setupDraft.seasonHalf === half}} testID={`season-half-${half}`}
            onPress={() => setSetupDraft({...setupDraft, seasonHalf: half})} style={[styles.segment, setupDraft.seasonHalf === half && styles.selected]}>
            <Text style={[styles.segmentText, setupDraft.seasonHalf === half && styles.selectedText]}>{half === 'first' ? 'First half' : 'Second half'}</Text>
          </Pressable>)}
        </View>
        <Text style={bookStyles.caption} testID="season-half-note">{setupDraft.seasonHalf === 'second' ? 'Second half since Oct 1, so pitchers can get 9 outs a day.' : 'First half, so pitchers can get 6 outs a day.'}{'\n'}Change it if your league switched on another date.</Text>
      </BookSection>
      <BookSection label="Lineups">
        <View style={bookStyles.card}>
          {(['away', 'home'] as const).map((side, index) => {
            const lineup = setupDraft.lineups[side];
            const pitcher = lineup?.find((slot) => slot.position === 'P')?.player;
            return <Pressable key={side} disabled={!available} accessibilityRole="button" testID={`setup-lineup-${side}`} onPress={() => router.push({pathname: '/lineup', params: {side}})} style={[styles.lineup, index > 0 && bookStyles.rule]}>
              <View style={styles.lineupDescription}><Text style={bookStyles.strong}>{teamNames[side]}</Text><Text style={bookStyles.caption} testID={`setup-lineup-${side}-summary`}>{lineup ? `${lineup.length} players${pitcher ? ` · ${displayPlayer(pitcher).name} pitching` : ' · Choose a starting pitcher'}` : 'Not set yet'}</Text></View>
              <BookIcon name="caret-right" />
            </Pressable>;
          })}
        </View>
      </BookSection>
      {view.kind === 'ready' && view.message ? <Text style={bookStyles.error} accessibilityLiveRegion="polite" testID="setup-message">{view.message}</Text> : null}
      <View style={bookStyles.fill} />
      <PrimaryButton label={view.kind === 'saving' ? 'Saving game…' : complete ? 'Start game' : 'Set both lineups to start'} disabled={!available || !complete} onPress={() => {void start();}} testID="start-configured-game" />
    </ScrollView>
  </SafeAreaView>;
}

const styles = createStyles({
  detail: {minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: sizes['space/3']},
  label: {...textStyles['Body/Regular'], color: colors['text/secondary']},
  segmented: {minHeight: 44, padding: sizes['space/1'], flexDirection: 'row', borderRadius: sizes['radius/full'], backgroundColor: colors['surface/card']},
  segment: {flex: 1, minHeight: 36, alignItems: 'center', justifyContent: 'center', borderRadius: sizes['radius/full']},
  selected: {backgroundColor: colors['scoreboard/bg']},
  segmentText: {...textStyles.Caption, fontWeight: '600', color: colors['text/secondary']},
  selectedText: {color: colors['text/on-accent']},
  lineup: {minHeight: 70, flexDirection: 'row', alignItems: 'center', gap: sizes['space/3']},
  lineupDescription: {flex: 1, gap: sizes['space/1']},
});
