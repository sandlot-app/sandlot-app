import { tokens } from '@sandlot/tokens';
import type { Alert, GameState, PlayerRef } from '@sandlot/engine';
import { useMemo, useState } from 'react';
import { Image, Platform, Text, View, type TextLayoutEvent } from 'react-native';
import Svg, { Line } from 'react-native-svg';
import { createStyles } from '../../style';
import { playerDisplay } from '../scoring/demo-roster.ts';
import { ticketLines, type PitchTone } from '../scoring/matchup-line.ts';
import type { SavedGame } from '../scoring/offline-game.ts';

const { colors, sizes, textStyles } = tokens.modes.Light;

const alertText = (alert: Alert) =>
  alert.kind === 'pitch_count_near_limit' ? `Pitcher is ${alert.remaining} pitches from the limit.`
    : alert.kind === 'pitch_count_at_limit' ? 'Pitcher has reached the pitch limit.'
      : alert.kind === 'pitcher_outs_today_at_limit' ? 'Pitcher has reached the daily outs limit.'
        : alert.kind === 'run_limit_reached' ? 'Half-inning run limit reached.'
          : alert.kind === 'time_limit_reached' ? 'Game time limit reached.' : 'Defensive innings requirement is not met.';

const toneStyle = (tone: PitchTone) => tone === 'danger' ? styles.danger : tone === 'warning' ? styles.warning : null;

/** Figma Matchup ticket (200:14580): the batter and their game so far, a tear line, then the pitcher and their count. */
export function MatchupTicket({ game }: { game: SavedGame }) {
  const { batter, pitcher } = useMemo(() => ticketLines(game), [game]);
  const { state } = game;
  const batting = state.half === 'top' ? 'away' : 'home';
  const fielding = state.half === 'top' ? 'home' : 'away';
  const batterStat = batter?.stat ?? '';
  const pitchStat = pitcher ? `· ${pitcher.count.count}` : '';
  // Stat lines never shorten. When one wraps, both icon marks hide for these lines at this width, which gives
  // each half 40 points back. New lines or a new width show the marks again and measure afresh.
  const [width, setWidth] = useState(0);
  const [hiddenFor, setHiddenFor] = useState<string | null>(null);
  const key = `${width}|${batterStat}|${pitchStat}`;
  const marks = hiddenFor !== key;
  const onStatLayout = (event: TextLayoutEvent) => {
    if (marks && width && event.nativeEvent.lines.length > 1) setHiddenFor(key);
  };
  return (
    <View style={styles.ticket} onLayout={(event) => setWidth(Math.round(event.nativeEvent.layout.width))} testID="matchup">
      <Half mark={marks ? 'bat' : null} name={shownName(state, batting, batter?.player)} unset={!batter}>
        <Text style={styles.stat} onTextLayout={onStatLayout} testID="batter-stat">At bat · {batterStat}</Text>
      </Half>
      <Svg width={1} height={39} accessible={Platform.OS === 'web' ? undefined : false} aria-hidden={Platform.OS === 'web' ? true : undefined}>
        <Line x1={0.5} y1={0} x2={0.5} y2={39} stroke={colors['border/subtle']} strokeWidth={1} strokeDasharray="3 3" />
      </Svg>
      <Half mark={marks ? 'ball' : null} name={shownName(state, fielding, pitcher?.player)} unset={!pitcher}>
        <Text style={styles.stat} onTextLayout={onStatLayout} testID="pitch-total" accessibilityLabel={pitcher ? `Pitching, ${pitcher.count.spoken}` : 'Pitching'}>
          Pitching{pitcher ? ' · ' : ''}{pitcher ? <Text style={toneStyle(pitcher.count.tone)}>{pitcher.count.count}</Text> : null}
        </Text>
      </Half>
      {/* The scalloped cut-outs, in the page color: one at each corner and a notch at each end of the tear line. */}
      <View style={[styles.corner, styles.topLeft]} />
      <View style={[styles.corner, styles.topRight]} />
      <View style={[styles.corner, styles.bottomLeft]} />
      <View style={[styles.corner, styles.bottomRight]} />
      <View style={[styles.notch, styles.notchTop]} />
      <View style={[styles.notch, styles.notchBottom]} />
    </View>
  );
}

function shownName(state: GameState, side: 'home' | 'away', player: PlayerRef | undefined) {
  return player ? playerDisplay(state, side, player).name : 'Not set';
}

function Half({ mark, name, unset, children }: { mark: 'bat' | 'ball' | null; name: string; unset: boolean; children: React.ReactNode }) {
  return (
    <View style={styles.half}>
      {mark ? <View style={styles.mark}>
        {mark === 'bat'
          ? <View style={styles.batTurn}><Image source={require('../../assets/scorer/bat.png')} accessible={false} style={styles.bat} /></View>
          : <View style={styles.ballSlot}><Image source={require('../../assets/scorer/baseball.png')} accessible={false} style={styles.ball} /></View>}
      </View> : null}
      <View style={styles.text}>
        <Text style={[styles.name, unset && styles.unset]} numberOfLines={1} ellipsizeMode="tail">{name}</Text>
        {children}
      </View>
    </View>
  );
}

/** The engine's league alerts for the last play, under the ticket. */
export function LeagueAlerts({ alerts }: { alerts: Alert[] }) {
  return alerts.map((alert, index) => <Text key={index} style={styles.alert} accessibilityLiveRegion="polite" testID={`league-alert-${alert.kind}`}>{alertText(alert)}</Text>);
}

const styles = createStyles({
  ticket: {
    flexDirection: 'row', alignItems: 'center', gap: sizes['space/3'],
    paddingHorizontal: sizes['space/4'], paddingVertical: sizes['space/3'],
    backgroundColor: colors['surface/card'], overflow: 'hidden',
  },
  half: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: sizes['space/2'] },
  mark: { width: 32, height: 32, borderRadius: sizes['radius/full'], backgroundColor: colors['surface/voice'], alignItems: 'center', justifyContent: 'center' },
  // Figma Icon/Bat: an 18 × 4.5 bat turned 45°, drawn from the same artwork as the batter's chip.
  batTurn: { width: 18, height: 4.5, transform: [{ rotate: '-45deg' }] },
  bat: { position: 'absolute', left: -1.18, top: 0, width: 19.856, height: 5.569 },
  ballSlot: { width: 18, height: 18 },
  ball: { position: 'absolute', left: -1.41, top: -0.56, width: 20.8125, height: 20.8125 },
  text: { flex: 1, minWidth: 0 },
  name: { ...textStyles['Body/Strong'], color: colors['text/primary'] },
  unset: { color: colors['text/secondary'] },
  stat: { ...textStyles.Caption, color: colors['text/secondary'] },
  warning: { color: colors['text/warning'] },
  danger: { color: colors['text/danger'] },
  corner: { position: 'absolute', width: 20, height: 20, borderRadius: sizes['radius/full'], backgroundColor: colors['surface/page'] },
  topLeft: { left: -10, top: -10 },
  topRight: { right: -10, top: -10 },
  bottomLeft: { left: -10, bottom: -10 },
  bottomRight: { right: -10, bottom: -10 },
  notch: { position: 'absolute', left: '50%', width: 16, height: 16, transform: [{ translateX: -8 }], borderRadius: sizes['radius/full'], backgroundColor: colors['surface/page'] },
  notchTop: { top: -8 },
  notchBottom: { bottom: -8 },
  alert: { ...textStyles.Caption, color: colors['text/warning'] },
});
