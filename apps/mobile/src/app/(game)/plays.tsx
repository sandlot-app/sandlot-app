import { router } from 'expo-router';
import { useState } from 'react';
import { Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';
import { tokens } from '@sandlot/tokens';
import type { GameState, TeamSide } from '@sandlot/engine';
import { createStyles } from '../../../style';
import { GameStatus } from '../../components/game-status.tsx';
import { bookStyles } from '../../components/book-ui.tsx';
import { BookIcon } from '../../components/book-icons.tsx';
import { basesSummary } from '../../scoring/game-summary.ts';
import { inningLog, pitchCount, pitchLabels, playTitle } from '../../scoring/play-log-presentation.ts';
import type { SavedPlay } from '../../scoring/play-log.ts';
import { teamNames } from '../../scoring/roster-presentation.ts';
import { useOfflineGame } from '../../scoring/use-offline-game.tsx';
import { playerPresentation } from '../../scoring/player-presentation.ts';

const {colors, sizes, textStyles} = tokens.modes.Light;

function ScoreDiamond({bases}: {bases: GameState['bases']}) {
  return <Svg width={50} height={36} viewBox="0 0 50 36" accessible={Platform.OS === 'web' ? undefined : false} aria-hidden={Platform.OS === 'web' ? true : undefined}>
    <Path d="m25 1 8 8-8 8-8-8Z" fill={bases[2] ? colors['count/strike'] : colors['chip/outline']} stroke={colors['border/well']} strokeWidth={1.5} />
    <Path d="m14 12 8 8-8 8-8-8Z" fill={bases[3] ? colors['count/strike'] : colors['chip/outline']} stroke={colors['border/well']} strokeWidth={1.5} />
    <Path d="m36 12 8 8-8 8-8-8Z" fill={bases[1] ? colors['count/strike'] : colors['chip/outline']} stroke={colors['border/well']} strokeWidth={1.5} />
  </Svg>;
}

function Baseball() {
  return <Svg width={22} height={22} viewBox="0 0 24 24" accessible={Platform.OS === 'web' ? undefined : false} aria-hidden={Platform.OS === 'web' ? true : undefined}>
    <Circle cx={12} cy={12} r={10} fill={colors['surface/card']} stroke={colors['border/subtle']} />
    <Path d="M6 4c6 4 6 12 0 16M18 4c-6 4-6 12 0 16m-9-11-3 1m4 2-3 1m2 2-3 1m9-7 3 1m-4 2 3 1m-2 2 3 1" fill="none" stroke={colors['status/live']} strokeWidth={1} />
  </Svg>;
}

function PlayRow({play, all, ordinal}: {play: SavedPlay; all: readonly SavedPlay[]; ordinal: number}) {
  const pitch = play.commands.find((command) => command.kind === 'pitch');
  return <View style={styles.pitchRow} testID={`play-${play.firstSeq}`}>
    <Text style={styles.sequence}>{pitch ? ordinal : ''}</Text>
    <View style={[styles.dot, pitch?.kind === 'pitch' && pitch.result === 'ball' ? styles.ball : pitch?.kind === 'pitch' && pitch.result !== 'in_play' ? styles.strike : styles.resultDot]} />
    <View style={styles.playDescription}><Text style={[bookStyles.caption, play.undone && styles.undone]}>{pitch?.kind === 'pitch' ? pitchLabels[pitch.result] : playTitle(play, all)}</Text>
      {play.undone ? <Text style={styles.undoLabel} testID={`play-undone-${play.firstSeq}`}>Undone</Text> : null}
    </View>
    {pitch ? <Text style={styles.muted}>{pitchCount(play)}</Text> : null}
  </View>;
}

export default function PlaysScreen() {
  const {view} = useOfflineGame();
  const [openInnings, setOpenInnings] = useState<Record<string, boolean>>({});
  const [openAtBats, setOpenAtBats] = useState<Record<number, boolean>>({});
  const game = view.kind === 'ready' || view.kind === 'saving' ? view.game : null;
  if (!game) return <SafeAreaView style={bookStyles.screen}><GameStatus /><Pressable style={bookStyles.linkTap} onPress={() => router.replace('/')} accessibilityRole="button"><Text style={bookStyles.link}>Your games</Text></Pressable></SafeAreaView>;
  const state = game.state;
  const innings = inningLog(game.plays);
  const teamLabel = (side: TeamSide) => {
    const player = game.setup.roster[side][0];
    return player && playerPresentation(player, 'Player').named ? teamNames[side] : side === 'away' ? 'Away' : 'Home';
  };
  return <SafeAreaView style={bookStyles.screen} testID="plays-screen">
    <View style={bookStyles.header}>
      <Pressable style={bookStyles.headerSide} accessibilityRole="button" accessibilityLabel="Your games" onPress={() => router.replace('/')}><BookIcon name="caret-left" size={24} color={colors['text/primary']} /></Pressable>
      <View style={styles.brandRow}><Text style={styles.brand} accessibilityLabel="Sandlot">sandlot</Text><Svg width={24} height={24} viewBox="0 0 24 24" accessible={Platform.OS === 'web' ? undefined : false} aria-hidden={Platform.OS === 'web' ? true : undefined}><Path d="m12 2 9 9-6 6m-6 0-6-6 9-9M10 20h4" fill="none" stroke={colors['logo/emblem']} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" /></Svg></View>
      <View style={bookStyles.headerSide} />
    </View>
    <ScrollView contentContainerStyle={bookStyles.content}>
      <View style={styles.scoreboard}>
        <View style={styles.scoreTop}><Text style={styles.teamName}>{teamLabel('away').toUpperCase()}</Text><Text style={styles.teamName}>{teamLabel('home').toUpperCase()}</Text></View>
        <View style={styles.scoreMiddle}><Text style={styles.score}>{state.score.away}</Text><View style={styles.inning}><ScoreDiamond bases={state.bases} /><Text style={styles.inningText}>{state.half === 'top' ? 'Top' : 'Bottom'} {state.inning}</Text></View><Text style={styles.score}>{state.score.home}</Text></View>
        <View style={styles.scoreBottomLabels}><Text style={styles.scoreLabel}>AWAY</Text><Text style={styles.scoreLabel}>HOME</Text></View>
        <View style={styles.scoreBottom}><View style={styles.counts}>
          {([['B', 4, state.count.balls], ['S', 3, state.count.strikes], ['O', 3, state.outs]] as const).map(([label, total, value]) => <View key={label} style={styles.count}><Text style={styles.countLabel}>{label}</Text>{Array.from({length: total}, (_, index) => <View key={index} style={[styles.countDot, index < value && (label === 'B' ? styles.ball : label === 'S' ? styles.strike : styles.resultDot)]} />)}</View>)}
        </View><Text style={styles.waiting}>{game.waitingPlays} waiting</Text></View>
      </View>
      <View style={styles.tabs}><Pressable testID="tab-field" accessibilityRole="button" style={styles.tab} onPress={() => router.replace('/score')}><Text style={bookStyles.strong}>Field</Text></Pressable><View style={[styles.tab, styles.activeTab]} accessibilityRole="tab" accessibilityState={{selected: true}} testID="tab-plays"><Text style={styles.activeTabText}>Plays</Text></View></View>
      <View style={styles.log} testID="play-log">
        {innings.map((inning, inningIndex) => {
          const expanded = openInnings[inning.key] ?? inningIndex === 0;
          return <View key={inning.key} style={bookStyles.card}>
            <Pressable accessibilityRole="button" accessibilityState={{expanded}} testID={`inning-${inning.key}`} onPress={() => setOpenInnings({...openInnings, [inning.key]: !expanded})} style={styles.inningHeader}>
              <View style={styles.inningHeading}>{inningIndex === 0 ? <View style={styles.resultDotSmall} /> : null}<Text style={bookStyles.strong}>{inning.half === 'top' ? 'Top' : 'Bottom'} {inning.inning}<Text style={styles.muted}> · {teamLabel(inning.side)} batting</Text></Text></View>
              <Text style={styles.muted}>{inning.runs} R · {inning.hits} H</Text>{expanded ? null : <BookIcon name="caret-right" size={16} />}
            </Pressable>
            {expanded ? [...inning.entries].reverse().map((entry, index) => {
              const latest = entry.plays.at(-1)!;
              const headerPlay = [...entry.plays].reverse().find((play) => !play.undone) ?? latest;
              const completed = headerPlay.before.half !== headerPlay.after.half || headerPlay.before.inning !== headerPlay.after.inning || headerPlay.before.nextBatter[inning.side] !== headerPlay.after.nextBatter[inning.side];
              const headerCount = completed ? headerPlay.before.count : headerPlay.after.count;
              const halfEnded = headerPlay.commands[0]?.kind !== 'undo' && (headerPlay.before.half !== headerPlay.after.half || headerPlay.before.inning !== headerPlay.after.inning);
              const open = openAtBats[entry.key] ?? index === 0;
              const undone = entry.plays.every((play) => play.undone);
              return <View key={entry.key} style={styles.atBat}>
                <Pressable testID={`at-bat-${latest.firstSeq}`} accessibilityRole="button" accessibilityState={{expanded: open}} onPress={() => setOpenAtBats({...openAtBats, [entry.key]: !open})} style={styles.atBatHeader}>
                  <View style={styles.baseball}><Baseball /></View><View style={styles.playDescription}><Text style={[bookStyles.body, undone && styles.undone]}>{playTitle(headerPlay, game.plays)}</Text><Text style={styles.muted}>{halfEnded ? '3 outs · half-inning ended' : `${headerPlay.after.outs} ${headerPlay.after.outs === 1 ? 'out' : 'outs'} · ${basesSummary(headerPlay.after.bases).replace(/\.$/, '').toLowerCase()}`}</Text></View>
                  <Text style={styles.countPill}>{headerCount.balls}–{headerCount.strikes}</Text><BookIcon name={open ? 'caret-down' : 'caret-right'} size={14} />
                </Pressable>
                {open ? <View style={styles.pitchList}>{entry.plays.map((play, playIndex) => <PlayRow key={play.id} play={play} all={game.plays} ordinal={entry.plays.slice(0, playIndex + 1).filter((previous) => previous.commands.some((command) => command.kind === 'pitch')).length} />)}</View> : null}
              </View>;
            }) : null}
          </View>;
        })}
      </View>
      <Text style={styles.hint}>Tap an inning to open or close it</Text>
    </ScrollView>
  </SafeAreaView>;
}

const styles = createStyles({
  brandRow: {flexDirection: 'row', alignItems: 'center', gap: sizes['space/1']},
  brand: {fontSize: 24, fontWeight: '800', letterSpacing: -1, color: colors['scoreboard/bg']},
  scoreboard: {backgroundColor: colors['scoreboard/bg'], borderRadius: sizes['radius/xl'], padding: sizes['space/4'], gap: sizes['space/1']},
  scoreTop: {flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: sizes['space/1']},
  teamName: {...textStyles['Score/Team'], color: colors['scoreboard/text-muted']},
  scoreMiddle: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'},
  score: {...textStyles['Score/Numeral'], color: colors['scoreboard/text']},
  inning: {alignItems: 'center'},
  inningText: {...textStyles['Body/Strong'], color: colors['scoreboard/text']},
  scoreBottomLabels: {flexDirection: 'row', justifyContent: 'space-between'},
  scoreLabel: {...textStyles['Label/Caps'], color: colors['scoreboard/text-muted']},
  scoreBottom: {borderTopWidth: 1, borderTopColor: colors['scoreboard/divider'], paddingTop: sizes['space/3'], marginTop: sizes['space/2'], flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: sizes['space/2']},
  counts: {flexDirection: 'row', gap: sizes['space/2']},
  count: {flexDirection: 'row', alignItems: 'center', gap: sizes['space/1']},
  countLabel: {...textStyles['Label/Caps'], color: colors['scoreboard/text-muted']},
  countDot: {width: 12, height: 12, borderWidth: 1.5, borderColor: colors['border/well'], borderRadius: sizes['radius/full'], backgroundColor: colors['chip/outline']},
  waiting: {...textStyles['Label/Caps'], color: colors['scoreboard/text-muted']},
  tabs: {minHeight: 44, flexDirection: 'row', padding: sizes['space/1'], backgroundColor: colors['surface/card'], borderWidth: 1, borderColor: colors['border/subtle'], borderRadius: sizes['radius/full']},
  tab: {flex: 1, minHeight: 36, alignItems: 'center', justifyContent: 'center', borderRadius: sizes['radius/full']},
  activeTab: {backgroundColor: colors['scoreboard/bg']},
  activeTabText: {...textStyles['Body/Strong'], color: colors['text/on-accent']},
  log: {gap: sizes['space/3']},
  inningHeader: {minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: sizes['space/2']},
  inningHeading: {flex: 1, flexDirection: 'row', alignItems: 'center', gap: sizes['space/1']},
  resultDotSmall: {width: 8, height: 8, borderRadius: sizes['radius/full'], backgroundColor: colors['status/live']},
  atBat: {borderTopWidth: 1, borderTopColor: colors['border/subtle'], paddingVertical: sizes['space/3']},
  atBatHeader: {flexDirection: 'row', alignItems: 'flex-start', gap: sizes['space/2']},
  baseball: {width: 30, height: 30, borderRadius: sizes['radius/full'], backgroundColor: colors['surface/page'], alignItems: 'center', justifyContent: 'center'},
  playDescription: {flex: 1, gap: sizes['space/1']},
  muted: {...textStyles.Caption, color: colors['text/tertiary']},
  countPill: {...textStyles.Caption, fontWeight: '600', color: colors['text/secondary'], backgroundColor: colors['surface/page'], borderRadius: sizes['radius/full'], paddingHorizontal: sizes['space/2']},
  pitchList: {paddingLeft: sizes['space/6'], paddingTop: sizes['space/2'], gap: sizes['space/2']},
  pitchRow: {flexDirection: 'row', alignItems: 'center', gap: sizes['space/2'], minHeight: 28},
  sequence: {...textStyles.Caption, width: 18, textAlign: 'right', color: colors['text/tertiary']},
  dot: {width: 10, height: 10, borderRadius: sizes['radius/full']},
  ball: {backgroundColor: colors['count/ball']},
  strike: {backgroundColor: colors['count/strike']},
  resultDot: {backgroundColor: colors['status/live']},
  undone: {textDecorationLine: 'line-through', color: colors['text/tertiary']},
  undoLabel: {...textStyles['Label/Caps'], color: colors['text/warning']},
  hint: {...textStyles.Caption, color: colors['text/tertiary'], textAlign: 'center'},
});
