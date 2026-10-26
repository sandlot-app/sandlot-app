import { useState } from 'react';
import { tokens } from '@sandlot/tokens';
import { createStyles } from '../../../style';
import type { PitchResult } from '@sandlot/engine';
import { router } from 'expo-router';
import {
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { BaseDiamond, Field } from '../../components/field.tsx';
import { PlaySheets } from '../../components/play-sheets.tsx';
import { beginInPlay } from '../../scoring/tap-play.ts';
import type { PlayDraft } from '../../scoring/tap-play.ts';
import { GameStatus } from '../../components/game-status.tsx';
import { basesSummary, blockedMessages, gameSummary } from '../../scoring/game-summary.ts';
import { useOfflineGame } from '../../scoring/use-offline-game.tsx';

const { colors, sizes } = tokens.modes.Light;

const pitches: {
  result: Exclude<PitchResult, 'in_play'>;
  label: string;
  main?: boolean;
}[] = [
  { result: 'ball', label: 'Ball', main: true },
  { result: 'called_strike', label: 'Called strike', main: true },
  { result: 'swinging_strike', label: 'Swinging strike' },
  { result: 'foul', label: 'Foul' },
  { result: 'hit_by_pitch', label: 'Hit by pitch' },
];

function CountDots({
  label,
  value,
  total,
  kind,
}: {
  label: string;
  value: number;
  total: number;
  kind: 'ballDot' | 'strikeDot' | 'outDot';
}) {
  return (
    <View
      style={styles.countSet}
      accessible
      accessibilityLabel={`${value} ${label}`}
    >
      <Text style={styles.countLabel}>{label[0]!.toUpperCase()}</Text>
      {Array.from({ length: total }, (_, index) => (
        <View
          key={index}
          style={[
            styles.dot,
            index < value && styles[kind],
          ]}
        />
      ))}
    </View>
  );
}

export default function ScoreScreen() {
  const { view, record } = useOfflineGame();
  const [draft, setDraft] = useState<PlayDraft | null>(null);
  const { height, fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const game =
    view.kind === 'ready' || view.kind === 'saving' || view.kind === 'blocked'
      ? view.game
      : null;
  const saving = view.kind === 'saving';
  const enabled =
    view.kind === 'ready' && game !== null && game.state.status !== 'final';
  const largeText = fontScale > 1.35;
  const fieldHeight = Math.max(
    120,
    Math.min(326, height - insets.top - insets.bottom - 500),
  );

  if (!game)
    return (
      <SafeAreaView style={styles.screen}>
        <Text style={styles.emptyBrand} accessibilityLabel="Sandlot">
          sandlot.
        </Text>
        <GameStatus />
        <Pressable
          onPress={() => router.replace('/')}
          accessibilityRole="button"
          style={styles.homeButton}
          testID="empty-game-navigation"
        >
          <Text style={styles.navLabel}>Your games</Text>
        </Pressable>
      </SafeAreaView>
    );

  const state = game.state;
  const battingSide = state.half === 'top' ? 'away' : 'home';
  const pitchingSide = state.half === 'top' ? 'home' : 'away';
  const pitcher = state.pitchers[pitchingSide];
  const batterIndex = state.nextBatter[battingSide];
  const basesLabel = basesSummary(state.bases);
  const summary = gameSummary(state);

  const gameContent = (
    <>
      <View style={[styles.header, largeText && styles.wrap]}>
        <Pressable
          onPress={() => router.replace('/')}
          style={({ pressed }) => [styles.nav, pressed && styles.pressed]}
          accessibilityRole="button"
          testID="games-navigation"
        >
          <Text style={styles.navLabel}>‹ Games</Text>
        </Pressable>
        <Text
          style={styles.brand}
          accessibilityLabel="Sandlot"
          testID="sandlot-brand"
        >
          sandlot.
        </Text>
        <Text style={styles.local}>Local game</Text>
      </View>
      <View style={styles.board}>
        <Text style={styles.meta}>
          {state.half === 'top' ? '▲ Top' : '▼ Bottom'} {state.inning} ·
          Mustang{state.status === 'final' ? ' · Final' : ''}
        </Text>
        <View style={styles.teams}>
          <View style={[styles.team, largeText && styles.column]}>
            <Text style={styles.teamName}>Away</Text>
            <Text style={styles.score}>{state.score.away}</Text>
          </View>
          {!largeText && (
            <View accessibilityLabel={basesLabel}>
              <BaseDiamond bases={state.bases} />
            </View>
          )}
          <View
            style={[styles.team, styles.homeTeam, largeText && styles.column]}
          >
            <Text style={styles.teamName}>Home</Text>
            <Text style={styles.score}>{state.score.home}</Text>
          </View>
        </View>
        <View style={[styles.count, largeText && styles.wrap]}>
          <CountDots
            label="balls"
            value={state.count.balls}
            total={4}
            kind="ballDot"
          />
          <CountDots
            label="strikes"
            value={state.count.strikes}
            total={3}
            kind="strikeDot"
          />
          <CountDots
            label="outs"
            value={state.outs}
            total={3}
            kind="outDot"
          />
        </View>
        <Text
          testID="score-summary"
          accessibilityLiveRegion="polite"
          style={styles.summary}
        >
          {summary}
        </Text>
      </View>
      <View style={[styles.matchup, largeText && styles.column]}>
        <View style={styles.playerCard}>
          <Text style={styles.cardLabel}>
            PITCHING · {pitchingSide.toUpperCase()}
          </Text>
          <Text style={styles.player}>
            Pitcher #
            {state.lineups[pitchingSide].findIndex(
              (slot) => slot.player.id === pitcher?.id,
            ) + 1}
          </Text>
          <Text style={styles.playerDetail} testID="pitch-total">
            {pitcher ? (state.pitchCounts[pitcher.id] ?? 0) : 0} pitches
          </Text>
        </View>
        <View style={styles.playerCard}>
          <Text style={styles.cardLabel}>
            BATTING · {battingSide.toUpperCase()}
          </Text>
          <Text style={styles.player}>Batter #{batterIndex + 1}</Text>
          <Text style={styles.playerDetail}>
            Batting {batterIndex + 1} in the order
          </Text>
        </View>
      </View>
      {!largeText && (
        <View
          style={styles.field}
          importantForAccessibility="no-hide-descendants"
          accessibilityElementsHidden
        >
          <Field bases={state.bases} height={fieldHeight} />
        </View>
      )}
    </>
  );
  const dock = (
    <View style={styles.dock}>
      <View style={[styles.dockHeading, largeText && styles.wrap]}>
        <Text style={styles.dockTitle}>Record a pitch</Text>
        <Text style={styles.hint}>
          {saving ? 'Saving…' : 'Tap to score'}
        </Text>
      </View>
      <View style={[styles.mainButtons, largeText && styles.column]}>
        {pitches
          .filter((pitch) => pitch.main)
          .map((pitch) => (
            <Pressable
              key={pitch.result}
              testID={`pitch-${pitch.result}`}
              disabled={!enabled}
              accessibilityRole="button"
              accessibilityState={{ disabled: !enabled }}
              onPress={() => {
                void record({ kind: 'pitch', result: pitch.result });
              }}
              style={({ pressed }) => [
                styles.pitch,
                pitch.result === 'ball' ? styles.ball : styles.strike,
                (!enabled || pressed) && styles.pressed,
              ]}
            >
              <Text
                style={[
                  styles.pitchLabel,
                  pitch.result === 'ball'
                    ? styles.ballLabel
                    : styles.strikeLabel,
                ]}
              >
                {pitch.label}
              </Text>
            </Pressable>
          ))}
      </View>
      <View style={[styles.secondaryButtons, largeText && styles.column]}>
        {pitches
          .filter((pitch) => !pitch.main)
          .map((pitch) => (
            <Pressable
              key={pitch.result}
              testID={`pitch-${pitch.result}`}
              disabled={!enabled}
              accessibilityRole="button"
              accessibilityState={{ disabled: !enabled }}
              onPress={() => {
                void record({ kind: 'pitch', result: pitch.result });
              }}
              style={({ pressed }) => [
                styles.secondary,
                (!enabled || pressed) && styles.pressed,
              ]}
            >
              <Text style={styles.secondaryLabel}>{pitch.label}</Text>
            </Pressable>
          ))}
      </View>
      <View style={styles.mainButtons}>
        <Pressable testID="pitch-in-play" accessibilityRole="button" disabled={!enabled}
          accessibilityState={{disabled: !enabled}} onPress={() => setDraft(beginInPlay(game))} style={styles.secondary}>
          <Text style={styles.secondaryLabel}>In play</Text>
        </Pressable>
        <Pressable testID="scorer-more" accessibilityRole="button" disabled={!enabled}
          accessibilityState={{disabled: !enabled}} onPress={() => setDraft({kind: 'more', game})} style={styles.secondary}>
          <Text style={styles.secondaryLabel}>More</Text>
        </Pressable>
      </View>
      {state.alerts.map((alert, index) => <Text key={index} style={styles.feedback} testID={`league-alert-${alert.kind}`}>
        {alert.kind === 'pitch_count_near_limit' ? `Pitcher is ${alert.remaining} pitches from the limit.`
          : alert.kind === 'pitch_count_at_limit' ? 'Pitcher has reached the pitch limit.'
          : alert.kind === 'pitcher_outs_today_at_limit' ? 'Pitcher has reached the daily outs limit.'
          : alert.kind === 'run_limit_reached' ? 'Half-inning run limit reached.'
          : alert.kind === 'time_limit_reached' ? 'Game time limit reached.' : 'Defensive innings requirement is not met.'}
      </Text>)}
      <View style={[styles.statusRow, largeText && styles.column]}>
        <View style={styles.saveStatus} accessibilityLiveRegion="polite">
          <Text style={styles.saved} testID="save-status">
            {saving
              ? 'Saving on this phone…'
              : `${game.waitingPlays} ${game.waitingPlays === 1 ? 'play' : 'plays'} saved on this phone`}
          </Text>
          <Text style={styles.pending} testID="waiting-plays">
            {game.waitingPlays} waiting to sync · Local demo
          </Text>
        </View>
        <Pressable
          testID="undo-play"
          disabled={view.kind !== 'ready' || !game.canUndo}
          accessibilityRole="button"
          accessibilityLabel="Undo last play"
          accessibilityState={{
            disabled: view.kind !== 'ready' || !game.canUndo,
          }}
          onPress={() => {
            void record({ kind: 'undo' });
          }}
          style={({ pressed }) => [
            styles.undo,
            (!game.canUndo || saving || pressed) && styles.pressed,
          ]}
        >
          <Text style={styles.undoLabel}>↶ Undo</Text>
        </Pressable>
      </View>
      {view.kind === 'ready' && view.message && (
        <Text
          testID="action-message"
          style={styles.feedback}
          accessibilityLiveRegion="polite"
        >
          {view.message}
        </Text>
      )}
      <GameStatus />
    </View>
  );

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.screen} accessibilityElementsHidden={draft !== null} importantForAccessibility={draft ? 'no-hide-descendants' : 'auto'}>
      {largeText ? (
        <ScrollView contentContainerStyle={styles.page}>
          {gameContent}
          {dock}
        </ScrollView>
      ) : (
        <>
          <ScrollView
            testID="game-content"
            style={styles.scrolling}
            contentContainerStyle={styles.page}
          >
            {gameContent}
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
  screen: { flex: 1, backgroundColor: colors['surface/card'] },
  scrolling: { flex: 1 },
  page: { flexGrow: 1 },
  header: {
    paddingHorizontal: sizes['space/4'],
    minHeight: 54,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: sizes['space/2'],
  },
  nav: { minHeight: 44, minWidth: 64, justifyContent: 'center' },
  navLabel: { color: colors['action/primary'], fontSize: 15, fontWeight: '600' },
  brand: { color: colors['text/primary'], fontSize: 23, fontWeight: '800' },
  local: { fontSize: 12, color: colors['text/secondary'] },
  board: { paddingHorizontal: sizes['space/4'], paddingBottom: sizes['space/3'], gap: sizes['space/3'] },
  meta: {
    color: colors['text/secondary'],
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '600',
  },
  teams: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: sizes['space/3'],
  },
  team: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: sizes['space/3'] },
  homeTeam: { flexDirection: 'row-reverse' },
  teamName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors['text/primary'],
    flexShrink: 1,
  },
  score: {
    fontSize: 41,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    color: colors['text/primary'],
  },
  count: { flexDirection: 'row', gap: sizes['space/4'], justifyContent: 'center' },
  countSet: { flexDirection: 'row', gap: sizes['space/1'], alignItems: 'center' },
  countLabel: {
    color: colors['text/secondary'],
    fontSize: 13,
    fontWeight: '600',
    marginRight: sizes['space/1'],
  },
  dot: {
    width: 8,
    height: 8,
    borderWidth: 1.5,
    borderColor: colors['count/empty'],
    borderRadius: sizes['radius/sm'],
  },
  ballDot: { backgroundColor: colors['count/ball'], borderColor: colors['count/ball'] },
  strikeDot: { backgroundColor: colors['count/strike'], borderColor: colors['count/strike'] },
  outDot: { backgroundColor: colors['count/out'], borderColor: colors['count/out'] },
  summary: {
    fontSize: 11,
    color: colors['text/secondary'],
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  matchup: {
    paddingVertical: sizes['space/3'],
    paddingHorizontal: sizes['space/4'],
    flexDirection: 'row',
    gap: sizes['space/3'],
    backgroundColor: colors['surface/page'],
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors['border/subtle'],
  },
  playerCard: {
    flex: 1,
    padding: sizes['space/3'],
    borderRadius: sizes['radius/md'],
    borderWidth: 1,
    borderColor: colors['border/subtle'],
    backgroundColor: colors['surface/card'],
    gap: sizes['space/1'],
  },
  cardLabel: { color: colors['text/secondary'], fontSize: 10, fontWeight: '600' },
  player: { fontSize: 16, fontWeight: '700', color: colors['text/primary'] },
  playerDetail: {
    fontSize: 12,
    color: colors['text/secondary'],
    fontVariant: ['tabular-nums'],
  },
  field: { flexGrow: 1, justifyContent: 'center', backgroundColor: colors['surface/voice'] },
  dock: {
    paddingTop: sizes['space/4'],
    paddingHorizontal: sizes['space/4'],
    paddingBottom: sizes['space/2'],
    gap: sizes['space/2'],
    backgroundColor: colors['surface/card'],
  },
  dockHeading: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: sizes['space/2'],
  },
  dockTitle: { color: colors['text/primary'], fontSize: 16, fontWeight: '700' },
  hint: { color: colors['text/secondary'], fontSize: 12 },
  mainButtons: { flexDirection: 'row', gap: sizes['space/2'] },
  pitch: {
    flex: 1,
    minHeight: 57,
    borderRadius: sizes['radius/md'],
    padding: sizes['space/4'],
    justifyContent: 'center',
  },
  ball: { backgroundColor: colors['surface/voice'] },
  strike: { backgroundColor: colors['action/primary'] },
  pitchLabel: { fontSize: 17, fontWeight: '600' },
  ballLabel: { color: colors['logo/background'] },
  strikeLabel: { color: colors['surface/card'] },
  secondaryButtons: { flexDirection: 'row', gap: sizes['space/2'] },
  secondary: {
    flex: 1,
    minHeight: 48,
    padding: sizes['space/2'],
    borderRadius: sizes['radius/md'],
    borderWidth: 1,
    borderColor: colors['border/subtle'],
    backgroundColor: colors['surface/page'],
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondaryLabel: {
    color: colors['text/primary'],
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sizes['space/3'],
    justifyContent: 'space-between',
  },
  saveStatus: { flex: 1, gap: sizes['space/1'] },
  saved: { fontSize: 13, fontWeight: '600', color: colors['text/primary'] },
  pending: { fontSize: 12, color: colors['text/secondary'] },
  undo: { minHeight: 44, minWidth: 70, justifyContent: 'center', padding: sizes['space/2'] },
  undoLabel: { color: colors['action/primary'], fontSize: 15, fontWeight: '600' },
  feedback: { fontSize: 13, color: colors['text/secondary'], lineHeight: 19 },
  pressed: { opacity: 0.55 },
  wrap: { flexWrap: 'wrap' },
  column: { flexDirection: 'column', alignItems: 'stretch' },
  emptyBrand: {
    color: colors['text/primary'],
    fontSize: 24,
    fontWeight: '700',
    padding: sizes['space/4'],
  },
  homeButton: { minHeight: 48, padding: sizes['space/4'] },
});
