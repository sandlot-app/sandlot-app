import { tokens } from '@sandlot/tokens';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { createStyles } from '../../../style';
import { PrimaryButton } from '../../../scorer-ui';
import { RejectionBand, SectionLabel, SetupNav } from '../../components/setup-chrome.tsx';
import { ChevronIcon } from '../../components/setup-marks.tsx';
import { canStart, demoGame, lineupSummary, seasonHalfNote, startRejection, teamName } from '../../scoring/game-setup.ts';
import type { SeasonHalf } from '../../scoring/demo-game.ts';
import { useSetupDraft } from '../../scoring/setup-draft.tsx';
import { useOfflineGame } from '../../scoring/use-offline-game.tsx';

const { colors, sizes, textStyles } = tokens.modes.Light;

const halves: { half: SeasonHalf; label: string }[] = [{ half: 'first', label: 'First half' }, { half: 'second', label: 'Second half' }];

/** Figma Scorer — Game setup (167:11241): the game's details, its Season half, a row per lineup, and Start. */
export default function GameSetupScreen() {
  const { draft, setDraft } = useSetupDraft();
  const { view, startSetup } = useOfflineGame();
  const [message, setMessage] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const ready = canStart(draft) && view.kind === 'ready' && !starting;

  const start = async () => {
    setMessage(null);
    setStarting(true);
    const result = await startSetup(draft);
    setStarting(false);
    if (result === 'started') router.replace('/score');
    else if (result === 'unavailable') setMessage('The game couldn’t start. Try again.');
    else setMessage(startRejection(draft, result.rejected));
  };

  const details: [string, string][] = [
    ['Away', teamName('away')], ['Home', teamName('home')], ['When', demoGame.when], ['Field', demoGame.field], ['Division', demoGame.division],
  ];

  return (
    <SafeAreaView style={styles.screen}>
      <SetupNav title="New game" onBack={() => router.replace('/')} />
      <ScrollView contentContainerStyle={styles.content} testID="setup-content">
        <View style={styles.section}>
          <SectionLabel>Game</SectionLabel>
          <View style={styles.card}>
            {details.map(([label, value], index) => (
              <View key={label} style={[styles.detail, index > 0 && styles.divided]}>
                <Text style={styles.detailLabel}>{label}</Text>
                <Text style={label === 'Away' || label === 'Home' ? styles.detailTeam : styles.detailValue}>{value}</Text>
              </View>
            ))}
          </View>
        </View>
        <View style={styles.section}>
          <SectionLabel>Season half</SectionLabel>
          <View style={styles.halves} accessibilityRole="radiogroup">
            {halves.map(({ half, label }) => {
              const selected = draft.half === half;
              return (
                <Pressable key={half} accessibilityRole="radio" accessibilityState={{ selected }} onPress={() => setDraft({ ...draft, half })}
                  style={[styles.half, selected && styles.halfSelected]} testID={`half-${half}`}>
                  <Text style={selected ? styles.halfLabelSelected : styles.halfLabel}>{label}</Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.note} testID="half-note">{seasonHalfNote(demoGame.day)}</Text>
        </View>
        <View style={styles.section}>
          <SectionLabel>Lineups</SectionLabel>
          <View style={styles.card}>
            {(['home', 'away'] as const).map((side, index) => {
              const summary = lineupSummary(draft, side);
              return (
                <Pressable key={side} accessibilityRole="button" accessibilityLabel={`${teamName(side)} lineup. ${summary}`}
                  onPress={() => router.push({ pathname: '/lineup', params: { side } })} style={[styles.lineup, index > 0 && styles.divided]} testID={`lineup-${side}`}>
                  <View style={styles.lineupText}>
                    <Text style={styles.detailTeam}>{teamName(side)}</Text>
                    <Text style={draft.lineups[side].set ? styles.summary : styles.summaryUnset} testID={`lineup-summary-${side}`}>{summary}</Text>
                  </View>
                  <ChevronIcon />
                </Pressable>
              );
            })}
          </View>
        </View>
      </ScrollView>
      <View style={styles.footer}>
        {message ? <RejectionBand message={message} testID="setup-message" /> : null}
        <PrimaryButton label={canStart(draft) ? 'Start game' : 'Set both lineups to start'} disabled={!ready} onPress={() => void start()} testID="start-setup" />
      </View>
    </SafeAreaView>
  );
}

const styles = createStyles({
  screen: { flex: 1, backgroundColor: colors['surface/page'] },
  content: { gap: sizes['space/4'], paddingTop: sizes['space/1'], paddingHorizontal: sizes['space/4'] },
  section: { gap: sizes['space/2'] },
  card: { paddingHorizontal: sizes['space/4'], paddingVertical: sizes['space/1'], borderRadius: sizes['radius/lg'], backgroundColor: colors['surface/card'], borderWidth: 1, borderColor: colors['border/subtle'] },
  divided: { borderTopWidth: 1, borderTopColor: colors['border/subtle'] },
  detail: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: sizes['space/3'] },
  detailLabel: { ...textStyles['Body/Regular'], color: colors['text/secondary'] },
  detailTeam: { ...textStyles['Body/Strong'], color: colors['text/primary'] },
  detailValue: { ...textStyles['Body/Regular'], color: colors['text/primary'] },
  halves: { flexDirection: 'row', padding: sizes['space/1'], borderRadius: sizes['radius/full'], backgroundColor: colors['surface/card'] },
  half: { flex: 1, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: sizes['radius/full'] },
  halfSelected: { backgroundColor: colors['scoreboard/bg'] },
  halfLabel: { ...textStyles.Tab, color: colors['text/secondary'] },
  halfLabelSelected: { ...textStyles.Tab, color: colors['scoreboard/text'] },
  note: { ...textStyles.Caption, color: colors['text/secondary'] },
  lineup: { flexDirection: 'row', alignItems: 'center', gap: sizes['space/3'], paddingVertical: sizes['space/3'] },
  lineupText: { flex: 1, gap: sizes['space/1'] },
  summary: { ...textStyles.Caption, color: colors['text/secondary'] },
  summaryUnset: { ...textStyles.Caption, color: colors['text/tertiary'] },
  footer: { gap: sizes['space/3'], paddingHorizontal: sizes['space/4'], paddingTop: sizes['space/3'], paddingBottom: sizes['space/2'] },
});
