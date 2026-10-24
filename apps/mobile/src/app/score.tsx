import type { PitchResult } from '@sandlot/engine';
import { router } from 'expo-router';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { BaseDiamond, Field } from '../components/field.tsx';
import { GameStatus } from '../components/game-status.tsx';
import { useOfflineGame } from '../scoring/use-offline-game.tsx';

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
  color,
}: {
  label: string;
  value: number;
  total: number;
  color: string;
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
            index < value && { backgroundColor: color, borderColor: color },
          ]}
        />
      ))}
    </View>
  );
}

export default function ScoreScreen() {
  const { view, record } = useOfflineGame();
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
  const occupied = ([1, 2, 3] as const).filter((base) => state.bases[base]);
  const basesLabel = occupied.length
    ? `Runners on ${occupied.map((base) => ['first', 'second', 'third'][base - 1]).join(' and ')}.`
    : 'Bases empty.';
  const summary = `Inning ${state.inning}, ${state.half}. ${state.outs} outs. Count ${state.count.balls}-${state.count.strikes}. ${basesLabel}`;

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.page}>
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
              color="#147b55"
            />
            <CountDots
              label="strikes"
              value={state.count.strikes}
              total={3}
              color="#b17613"
            />
            <CountDots
              label="outs"
              value={state.outs}
              total={3}
              color="#b74640"
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
              accessibilityLabel="Undo last pitch"
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
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff' },
  page: { flexGrow: 1 },
  header: {
    paddingHorizontal: 18,
    minHeight: 54,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  nav: { minHeight: 44, minWidth: 64, justifyContent: 'center' },
  navLabel: { color: '#1466cf', fontSize: 15, fontWeight: '600' },
  brand: { color: '#132d43', fontSize: 23, fontWeight: '800' },
  local: { fontSize: 12, color: '#526674' },
  board: { paddingHorizontal: 20, paddingBottom: 12, gap: 10 },
  meta: {
    color: '#526674',
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '600',
  },
  teams: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  team: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12 },
  homeTeam: { flexDirection: 'row-reverse' },
  teamName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#132d43',
    flexShrink: 1,
  },
  score: {
    fontSize: 41,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    color: '#132d43',
  },
  count: { flexDirection: 'row', gap: 20, justifyContent: 'center' },
  countSet: { flexDirection: 'row', gap: 5, alignItems: 'center' },
  countLabel: {
    color: '#526674',
    fontSize: 13,
    fontWeight: '600',
    marginRight: 3,
  },
  dot: {
    width: 8,
    height: 8,
    borderWidth: 1.5,
    borderColor: '#8a9eac',
    borderRadius: 4,
  },
  summary: {
    fontSize: 11,
    color: '#526674',
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  matchup: {
    paddingVertical: 12,
    paddingHorizontal: 18,
    flexDirection: 'row',
    gap: 10,
    backgroundColor: '#f3f7fa',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#e6edf1',
  },
  playerCard: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2eaf0',
    backgroundColor: '#fff',
    gap: 3,
  },
  cardLabel: { color: '#526674', fontSize: 10, fontWeight: '600' },
  player: { fontSize: 16, fontWeight: '700', color: '#132d43' },
  playerDetail: {
    fontSize: 12,
    color: '#526674',
    fontVariant: ['tabular-nums'],
  },
  field: { flexGrow: 1, justifyContent: 'center', backgroundColor: '#d9eff1' },
  dock: {
    paddingTop: 14,
    paddingHorizontal: 18,
    paddingBottom: 8,
    gap: 9,
    backgroundColor: '#fff',
  },
  dockHeading: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  dockTitle: { color: '#132d43', fontSize: 16, fontWeight: '700' },
  hint: { color: '#526674', fontSize: 12 },
  mainButtons: { flexDirection: 'row', gap: 9 },
  pitch: {
    flex: 1,
    minHeight: 57,
    borderRadius: 12,
    padding: 14,
    justifyContent: 'center',
  },
  ball: { backgroundColor: '#e4f3eb' },
  strike: { backgroundColor: '#1466cf' },
  pitchLabel: { fontSize: 17, fontWeight: '600' },
  ballLabel: { color: '#11653f' },
  strikeLabel: { color: '#fff' },
  secondaryButtons: { flexDirection: 'row', gap: 8 },
  secondary: {
    flex: 1,
    minHeight: 48,
    padding: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#dce5ed',
    backgroundColor: '#f7f9fb',
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondaryLabel: {
    color: '#284457',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    justifyContent: 'space-between',
  },
  saveStatus: { flex: 1, gap: 3 },
  saved: { fontSize: 13, fontWeight: '600', color: '#274657' },
  pending: { fontSize: 12, color: '#526674' },
  undo: { minHeight: 44, minWidth: 70, justifyContent: 'center', padding: 8 },
  undoLabel: { color: '#1466cf', fontSize: 15, fontWeight: '600' },
  feedback: { fontSize: 13, color: '#526674', lineHeight: 19 },
  pressed: { opacity: 0.55 },
  wrap: { flexWrap: 'wrap' },
  column: { flexDirection: 'column', alignItems: 'stretch' },
  emptyBrand: {
    color: '#132d43',
    fontSize: 24,
    fontWeight: '700',
    padding: 20,
  },
  homeButton: { minHeight: 48, padding: 20 },
});
