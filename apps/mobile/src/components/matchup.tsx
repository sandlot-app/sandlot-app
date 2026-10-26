import { tokens } from '@sandlot/tokens';
import type { Alert, GameState, RuleSet } from '@sandlot/engine';
import { Image, Text, View } from 'react-native';
import { createStyles } from '../../style';
import { playerDisplay } from '../scoring/demo-roster.ts';

const { colors, sizes, textStyles } = tokens.modes.Light;

const alertText = (alert: Alert) =>
  alert.kind === 'pitch_count_near_limit' ? `Pitcher is ${alert.remaining} pitches from the limit.`
    : alert.kind === 'pitch_count_at_limit' ? 'Pitcher has reached the pitch limit.'
      : alert.kind === 'pitcher_outs_today_at_limit' ? 'Pitcher has reached the daily outs limit.'
        : alert.kind === 'run_limit_reached' ? 'Half-inning run limit reached.'
          : alert.kind === 'time_limit_reached' ? 'Game time limit reached.' : 'Defensive innings requirement is not met.';

const meterFill = (share: number) => ({ width: `${Math.min(100, share * 100)}%` as const });

/** Figma Matchup (34:345): the batter and on deck, then the pitcher and their pitch meter. */
export function Matchup({ state, limits }: { state: GameState; limits: RuleSet['pitchCountLimits'] }) {
  const batting = state.half === 'top' ? 'away' : 'home';
  const fielding = state.half === 'top' ? 'home' : 'away';
  const lineup = state.lineups[batting];
  const batter = lineup[state.nextBatter[batting]]?.player;
  const onDeck = lineup[(state.nextBatter[batting] + 1) % lineup.length]?.player;
  const pitcher = state.pitchers[fielding];
  const thrown = pitcher ? (state.pitchCounts[pitcher.id] ?? 0) : 0;
  const pitches = !limits ? `${thrown} pitches`
    : thrown > limits.limit ? `${thrown} / ${limits.limit} · ${thrown - limits.limit} over`
      : `${thrown} / ${limits.limit} pitches`;
  const meter = !limits ? null : thrown >= limits.limit ? styles.overLimit : thrown >= limits.warnAt ? styles.nearLimit : styles.normal;
  const shownBatter = batter ? playerDisplay(state, batting, batter) : null;
  const shownPitcher = pitcher ? playerDisplay(state, fielding, pitcher) : null;
  return (
    <View style={styles.card} testID="matchup">
      <View style={styles.block}>
        <View style={styles.labelRow}>
          <Text style={styles.label}>At bat</Text>
          {shownBatter ? <Text style={styles.label}>#{shownBatter.number}</Text> : null}
        </View>
        <Text style={styles.name} numberOfLines={1}>{shownBatter?.name ?? '—'}</Text>
        {onDeck ? <Text style={styles.onDeck} numberOfLines={1}>On deck: {playerDisplay(state, batting, onDeck).name}</Text> : null}
      </View>
      <View style={styles.divider} />
      <View style={styles.block}>
        <View style={styles.labelRow}>
          <Text style={styles.label}>Pitching</Text>
          {shownPitcher ? <Text style={styles.label}>#{shownPitcher.number}</Text> : null}
          <View style={styles.spacer} />
          <Text style={styles.line} numberOfLines={1} testID="pitch-total">{pitches}</Text>
        </View>
        <Text style={styles.name} numberOfLines={1}>{shownPitcher?.name ?? '—'}</Text>
        {limits && meter ? <View style={styles.track}><View style={[styles.fill, meter, meterFill(thrown / limits.limit)]} /></View> : null}
        {state.alerts.map((alert, index) => <Text key={index} style={styles.alert} testID={`league-alert-${alert.kind}`}>{alertText(alert)}</Text>)}
      </View>
    </View>
  );
}

/** Figma Last Pitch (34:364), Result only or Before first pitch. */
export function LastPitch({ label, pitch }: { label: string | null; pitch: number | null }) {
  return (
    <View style={styles.lastPitch} testID="last-pitch">
      <View style={styles.ballSlot}>
        <Image source={require('../../assets/scorer/baseball.png')} accessible={false} style={styles.ball} />
      </View>
      <Text style={styles.lastText} numberOfLines={1}>
        {label ? <Text style={styles.lastResult}>{label}</Text> : 'First pitch coming up'}
      </Text>
      {pitch ? <Text style={styles.pitchNumber}>Pitch {pitch}</Text> : null}
    </View>
  );
}

const styles = createStyles({
  card: {
    gap: sizes['space/3'], paddingTop: sizes['space/3'], paddingBottom: sizes['space/4'], paddingHorizontal: sizes['space/4'],
    backgroundColor: colors['surface/card'], borderWidth: 1, borderColor: colors['border/subtle'], borderRadius: sizes['radius/xl'],
  },
  block: { gap: 0 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: sizes['space/1'], minHeight: 20 },
  label: { ...textStyles['Label/Caps'], color: colors['text/tertiary'], textTransform: 'uppercase' },
  spacer: { flex: 1 },
  line: { ...textStyles['Body/Regular'], color: colors['text/secondary'], textAlign: 'right', flexShrink: 1, maxWidth: 210 },
  name: { ...textStyles['Player/Name'], color: colors['text/primary'] },
  onDeck: { ...textStyles.Caption, color: colors['text/tertiary'], paddingTop: sizes['space/1'] },
  divider: { height: 1, backgroundColor: colors['border/subtle'] },
  track: { height: 4, marginTop: sizes['space/2'], borderRadius: sizes['radius/full'], backgroundColor: colors['border/subtle'], overflow: 'hidden' },
  fill: { height: 4, borderRadius: sizes['radius/full'] },
  normal: { backgroundColor: colors['scoreboard/bg'] },
  nearLimit: { backgroundColor: colors['count/strike'] },
  overLimit: { backgroundColor: colors['count/out'] },
  alert: { ...textStyles.Caption, color: colors['text/warning'], paddingTop: sizes['space/2'] },
  lastPitch: {
    minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: sizes['space/2'],
    paddingLeft: sizes['space/3'], paddingRight: sizes['space/4'],
    backgroundColor: colors['surface/card'], borderWidth: 1, borderColor: colors['border/subtle'], borderRadius: sizes['radius/full'],
  },
  ballSlot: { width: 22, height: 22 },
  ball: { position: 'absolute', left: -1.72, top: -0.69, width: 25.4375, height: 25.4375 },
  lastText: { ...textStyles['Body/Regular'], color: colors['text/secondary'], flex: 1 },
  lastResult: { ...textStyles['Body/Strong'], color: colors['text/primary'] },
  pitchNumber: { ...textStyles.Caption, color: colors['text/tertiary'] },
});
