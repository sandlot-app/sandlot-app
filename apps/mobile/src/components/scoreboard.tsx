import { tokens } from '@sandlot/tokens';
import type { GameState } from '@sandlot/engine';
import { Text, View } from 'react-native';
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
});
