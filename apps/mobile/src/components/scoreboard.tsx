import { tokens } from '@sandlot/tokens';
import type { GameState } from '@sandlot/engine';
import { Image, Text, View } from 'react-native';
import { createStyles } from '../../style';
import { demoTeams } from '../scoring/demo-roster.ts';
import { MiniDiamond } from './field.tsx';

const { colors, sizes, textStyles } = tokens.modes.Light;

/** Figma Scoreboard (24:372), Size=Compact. Screen readers hear `summary` instead of the parts. */
export function Scoreboard({ state, summary }: { state: GameState; summary: string }) {
  const final = state.status === 'final';
  const { balls, strikes } = state.count;
  return (
    <View style={styles.board} accessible accessibilityLabel={summary} accessibilityLiveRegion="polite" testID="score-summary">
      <View style={styles.team}>
        <Text style={styles.abbr} numberOfLines={1}>{demoTeams.away.short}</Text>
        <Text style={styles.score}>{state.score.away}</Text>
      </View>
      <View style={styles.state}>
        <MiniDiamond bases={state.bases} />
        <View>
          <View style={styles.inningRow}>
            {final ? null : <View style={styles.liveDot} />}
            <Text style={styles.inning} numberOfLines={1}>{final ? 'Final' : `${state.half === 'top' ? 'Top' : 'Bottom'} ${state.inning}`}</Text>
          </View>
          {final ? null : <Text style={styles.count} numberOfLines={1}>{balls}–{strikes} · {state.outs} out{state.outs === 1 ? '' : 's'}</Text>}
        </View>
      </View>
      <View style={[styles.team, styles.home]}>
        <Text style={styles.score}>{state.score.home}</Text>
        <Text style={styles.abbr} numberOfLines={1}>{demoTeams.home.short}</Text>
      </View>
    </View>
  );
}

function RoleBadge({ batting }: { batting: boolean }) {
  return <View style={styles.badge}>
    {batting
      ? <View style={styles.batTurn}><Image source={require('../../assets/scorer/bat.png')} accessible={false} style={styles.bat} /></View>
      : <View style={styles.gloveSlot}><Image source={require('../../assets/scorer/glove.png')} accessible={false} style={styles.glove} /></View>}
  </View>;
}

function CountDots({ label, total, filled, color }: { label: string; total: number; filled: number; color: 'count/ball' | 'count/strike' | 'count/out' }) {
  return <View style={styles.countGroup}>
    <Text style={styles.countLabel}>{label}</Text>
    <View style={styles.dots}>
      {Array.from({ length: total }, (_, index) => <View key={index} style={[styles.dot, index < filled ? dotFill[color] : styles.emptyDot]} />)}
    </View>
  </View>;
}

/**
 * Figma Scoreboard (24:372), Size=Expanded, as the Plays tab shows it at the top: role badges, big scores, the count in
 * dots and the Live badge. Screen readers hear `summary` instead of the parts.
 */
export function ExpandedScoreboard({ state, summary }: { state: GameState; summary: string }) {
  const final = state.status === 'final';
  const homeBats = state.half === 'bottom';
  const team = (side: 'away' | 'home') => <View style={[styles.side, side === 'home' && styles.sideHome]}>
    <View style={[styles.nameRow, side === 'home' && styles.nameRowHome]}>
      {side === 'away' ? <RoleBadge batting={!homeBats} /> : null}
      <Text style={[styles.teamName, side === 'home' && styles.right]} numberOfLines={1}>{demoTeams[side].name}</Text>
      {side === 'home' ? <RoleBadge batting={homeBats} /> : null}
    </View>
    <Text style={styles.bigScore}>{state.score[side]}</Text>
    <Text style={styles.sideLabel}>{side === 'away' ? 'Away' : 'Home'}</Text>
  </View>;
  return (
    <View style={styles.expanded} accessible accessibilityLabel={summary} accessibilityLiveRegion="polite" testID="score-summary">
      <View style={styles.expandedInner}>
        <View style={styles.main}>
          {team('away')}
          <View style={styles.gameState}>
            <MiniDiamond bases={state.bases} scale={56 / 30.8} />
            <Text style={styles.bigInning}>{final ? 'Final' : `${state.half === 'top' ? 'Top' : 'Bottom'} ${state.inning}`}</Text>
          </View>
          {team('home')}
        </View>
        <View style={styles.hairline} />
        <View style={styles.footer}>
          <View style={styles.countRow}>
            <CountDots label="B" total={3} filled={state.count.balls} color="count/ball" />
            <CountDots label="S" total={2} filled={state.count.strikes} color="count/strike" />
            <CountDots label="O" total={2} filled={state.outs} color="count/out" />
          </View>
          {final ? null : <View style={styles.liveBadge}><View style={styles.liveBadgeDot} /><Text style={styles.liveBadgeText}>Live</Text></View>}
        </View>
      </View>
    </View>
  );
}

const styles = createStyles({
  board: {
    minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: sizes['space/2'],
    paddingHorizontal: sizes['space/4'], paddingVertical: sizes['space/2'],
    backgroundColor: colors['scoreboard/bg'], borderRadius: sizes['radius/xl'], borderWidth: 1, borderColor: colors['border/glass'],
  },
  team: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: sizes['space/1'] },
  home: { justifyContent: 'flex-end' },
  abbr: { ...textStyles['Status/Label'], color: colors['scoreboard/text-muted'], textTransform: 'uppercase', maxWidth: 44 },
  score: { ...textStyles['Score/Compact'], color: colors['scoreboard/text'], fontVariant: ['tabular-nums'] },
  state: { flexDirection: 'row', alignItems: 'center', gap: sizes['space/2'] },
  inningRow: { flexDirection: 'row', alignItems: 'center', gap: sizes['space/1'] },
  liveDot: { width: 6, height: 6, borderRadius: sizes['radius/full'], backgroundColor: colors['status/live'] },
  inning: { ...textStyles.Caption, fontWeight: '600', color: colors['scoreboard/text'], maxWidth: 84 },
  count: { ...textStyles.Caption, color: colors['scoreboard/text-muted'], maxWidth: 84 },
  // Expanded: 20 above and to the sides (space/4 + space/1). Figma's 14 around the hairline is space/3 here.
  expanded: { padding: sizes['space/4'], backgroundColor: colors['scoreboard/bg'], borderRadius: sizes['radius/xl'], borderWidth: 1, borderColor: colors['border/glass'] },
  expandedInner: { paddingHorizontal: sizes['space/1'], paddingTop: sizes['space/1'] },
  main: { flexDirection: 'row', alignItems: 'center', gap: sizes['space/2'] },
  side: { flex: 1, minWidth: 0, alignItems: 'flex-start' },
  sideHome: { alignItems: 'flex-end' },
  nameRow: { alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', gap: sizes['space/2'] },
  nameRowHome: { justifyContent: 'flex-end' },
  teamName: { ...textStyles['Score/Team'], flex: 1, color: colors['scoreboard/text-muted'], textTransform: 'uppercase' },
  right: { textAlign: 'right' },
  bigScore: { ...textStyles['Score/Numeral'], color: colors['scoreboard/text'], fontVariant: ['tabular-nums'] },
  sideLabel: { ...textStyles['Label/Caps'], color: colors['scoreboard/text-muted'], opacity: 0.7, textTransform: 'uppercase' },
  gameState: { alignItems: 'center', gap: sizes['space/2'] },
  bigInning: { ...textStyles['Body/Strong'], color: colors['scoreboard/text'] },
  hairline: { height: 1, marginVertical: sizes['space/3'], backgroundColor: colors['border/glass'] },
  footer: { height: 26, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  countRow: { flexDirection: 'row', alignItems: 'center', gap: sizes['space/3'] },
  countGroup: { flexDirection: 'row', alignItems: 'center', gap: sizes['space/1'] },
  countLabel: { ...textStyles['Label/Caps'], color: colors['scoreboard/text-muted'], textTransform: 'uppercase' },
  dots: { flexDirection: 'row', gap: sizes['space/1'] },
  dot: { width: sizes['dot/size'], height: sizes['dot/size'], borderRadius: sizes['radius/full'] },
  emptyDot: { backgroundColor: colors['count/well'], borderWidth: 1.5, borderColor: colors['border/well'] },
  liveBadge: { height: 26, flexDirection: 'row', alignItems: 'center', gap: sizes['space/1'], paddingHorizontal: sizes['space/2'], borderRadius: sizes['radius/full'], backgroundColor: colors['status/live'] },
  liveBadgeDot: { width: 7, height: 7, borderRadius: sizes['radius/full'], backgroundColor: colors['scoreboard/text'] },
  liveBadgeText: { ...textStyles['Status/Label'], color: colors['scoreboard/text'], textTransform: 'uppercase' },
  // Figma Role badge: a frosted 26 circle with the 16 glove, or the 20 × 5 bat turned 35°, each with its shadow.
  badge: { width: 26, height: 26, borderRadius: sizes['radius/full'], backgroundColor: colors['surface/glass'], borderWidth: 1, borderColor: colors['border/glass'], alignItems: 'center', justifyContent: 'center' },
  gloveSlot: { width: 16, height: 16 },
  glove: { position: 'absolute', left: -0.07, top: 0, width: 16.0687, height: 17.2085 },
  batTurn: { width: 20, height: 5, transform: [{ rotate: '-35deg' }] },
  bat: { position: 'absolute', left: -1.31, top: 0, width: 22.0625, height: 6.1875 },
});

const dotFill = createStyles({
  'count/ball': { backgroundColor: colors['count/ball'] },
  'count/strike': { backgroundColor: colors['count/strike'] },
  'count/out': { backgroundColor: colors['count/out'] },
});
