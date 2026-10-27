import { tokens } from '@sandlot/tokens';
import { useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { createStyles } from '../../style';
import type { AtBat, HalfInning, PitchMark, PlayRow } from '../scoring/play-log.ts';
import { SmallCaretDownIcon, SmallCaretRightIcon } from './icons.tsx';

const { colors, sizes, textStyles } = tokens.modes.Light;

function Caret({ open }: { open: boolean }) {
  return open ? <SmallCaretDownIcon color={colors['text/tertiary']} /> : <SmallCaretRightIcon color={colors['text/tertiary']} />;
}

/** Figma Pitch Row marks: ball a green dot, strike a yellow dot, foul a yellow ring, in play the baseball. */
function Mark({ mark }: { mark: PitchMark | null }) {
  if (mark === 'in_play')
    return <View style={styles.markSlot}><Image source={require('../../assets/scorer/baseball.png')} accessible={false} style={styles.markBall} /></View>;
  return <View style={styles.markSlot}>{mark ? <View style={[styles.markDot, markStyles[mark]]} /> : null}</View>;
}

function Row({ row }: { row: PlayRow }) {
  return (
    <View style={styles.pitchRow} testID={`play-row-${row.key}`}>
      <Text style={styles.pitchNumber}>{row.number ?? ''}</Text>
      <Mark mark={row.mark} />
      <Text style={[styles.pitchLabel, row.undone && styles.undone]}>{row.label}</Text>
      {row.undone ? <Text style={styles.pitchCount} testID={`play-undone-${row.key}`}>Undone</Text>
        : row.count ? <Text style={styles.pitchCount}>{row.count}</Text> : null}
    </View>
  );
}

/** Figma At Bat (65:2434): the play and the count it ended on; open, the pitches under it. The batter still up stays open. */
function AtBatRow({ atBat, open, onToggle }: { atBat: AtBat; open: boolean; onToggle: () => void }) {
  const shown = atBat.inProgress || open;
  return (
    <View>
      <View style={styles.hairline} />
      <Pressable onPress={atBat.inProgress ? undefined : onToggle} disabled={atBat.inProgress} accessibilityRole="button"
        accessibilityState={atBat.inProgress ? undefined : { expanded: open }} style={styles.summary} testID={`at-bat-${atBat.key}`}>
        <View style={styles.play}>
          <View style={styles.icon}>
            {atBat.kind === 'out' ? <View style={styles.outDot} />
              : <View style={styles.ballSlot}><Image source={require('../../assets/scorer/baseball.png')} accessible={false} style={styles.ball} /></View>}
          </View>
          <View style={styles.text}>
            <Text style={atBat.kind === 'run' ? styles.titleRun : styles.title}>{atBat.title}</Text>
            {atBat.detail ? <Text style={styles.detail}>{atBat.detail}</Text> : null}
          </View>
          {atBat.score ? <View style={styles.scoreChip}><Text style={styles.scoreChipText}>{atBat.score}</Text></View> : null}
        </View>
        <View style={styles.right}>
          <View style={styles.countPill}><Text style={styles.countPillText}>{atBat.count}</Text></View>
          {atBat.inProgress ? null : <Caret open={open} />}
        </View>
      </Pressable>
      {shown && atBat.rows.length ? (
        <View style={styles.pitches}>
          <View style={styles.pitchIndent} />
          <View style={styles.pitchList}>{atBat.rows.map((row) => <Row key={row.key} row={row} />)}</View>
        </View>
      ) : null}
    </View>
  );
}

/** Figma Half Inning Header (65:2344) and its at-bats. The current half has the live dot and is always open. */
function HalfCard({ half, open, onToggle, openAtBats, onToggleAtBat }: {
  half: HalfInning; open: boolean; onToggle: () => void; openAtBats: Record<string, boolean>; onToggleAtBat: (key: string) => void;
}) {
  const shown = half.current || open;
  return (
    <View style={styles.card} testID={`half-${half.label.toLowerCase().replace(' ', '-')}`}>
      <Pressable onPress={half.current ? undefined : onToggle} disabled={half.current} accessibilityRole="button"
        accessibilityState={half.current ? undefined : { expanded: open }} style={styles.header}>
        {half.current ? <View style={styles.liveDot} /> : null}
        <Text style={styles.halfLabel}>{half.label}</Text>
        <Text style={styles.batting} numberOfLines={1}>· {half.batting} batting</Text>
        <Text style={styles.totals}>{half.totals}</Text>
        {half.current ? null : <Caret open={open} />}
      </Pressable>
      {shown ? half.atBats.map((atBat) => (
        <AtBatRow key={atBat.key} atBat={atBat} open={openAtBats[atBat.key] ?? false} onToggle={() => onToggleAtBat(atBat.key)} />
      )) : null}
    </View>
  );
}

/** The Plays tab's list (Figma 69:1895): newest half-inning first, older halves closed until tapped. */
export function PlayLog({ halves }: { halves: HalfInning[] }) {
  const [openHalves, setOpenHalves] = useState<Record<string, boolean>>({});
  const [openAtBats, setOpenAtBats] = useState<Record<string, boolean>>({});
  return (
    <View style={styles.log} testID="play-log">
      {halves.map((half) => (
        <HalfCard key={half.key} half={half} open={openHalves[half.key] ?? false}
          onToggle={() => setOpenHalves({ ...openHalves, [half.key]: !openHalves[half.key] })}
          openAtBats={openAtBats} onToggleAtBat={(key) => setOpenAtBats({ ...openAtBats, [key]: !openAtBats[key] })} />
      ))}
      <Text style={styles.hint}>Tap an inning to open or close it</Text>
    </View>
  );
}

const styles = createStyles({
  log: { gap: sizes['space/3'] },
  card: {
    paddingHorizontal: sizes['space/4'], paddingBottom: sizes['space/1'],
    backgroundColor: colors['surface/card'], borderWidth: 1, borderColor: colors['border/subtle'], borderRadius: sizes['radius/xl'],
  },
  // Figma: 2 above the header, then 12 above and below its 20-tall line.
  header: { minHeight: 46, flexDirection: 'row', alignItems: 'center', gap: sizes['space/2'] },
  liveDot: { width: 8, height: 8, borderRadius: sizes['radius/full'], backgroundColor: colors['status/live'] },
  halfLabel: { ...textStyles['Body/Strong'], color: colors['text/primary'] },
  batting: { ...textStyles['Body/Regular'], flex: 1, color: colors['text/secondary'] },
  totals: { ...textStyles.Caption, color: colors['text/tertiary'] },
  hairline: { height: 1, backgroundColor: colors['border/subtle'] },
  summary: { flexDirection: 'row', alignItems: 'flex-start', gap: sizes['space/2'] },
  play: { flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: sizes['space/3'], paddingVertical: sizes['space/3'] },
  icon: { width: 32, height: 32, borderRadius: sizes['radius/full'], backgroundColor: colors['surface/page'], alignItems: 'center', justifyContent: 'center' },
  // Figma Icon/Baseball at 20, with its shadow overflowing the box as the artwork does.
  ballSlot: { width: 20, height: 20 },
  ball: { position: 'absolute', left: -1.5625, top: -0.625, width: 23.125, height: 23.125 },
  outDot: { width: 10, height: 10, borderRadius: sizes['radius/full'], backgroundColor: colors['count/out'] },
  text: { flex: 1, minWidth: 0 },
  title: { ...textStyles['Body/Regular'], color: colors['text/primary'] },
  titleRun: { ...textStyles['Body/Strong'], color: colors['text/primary'] },
  // Caption with Figma's 2 above it folded into the line.
  detail: { ...textStyles.Caption, lineHeight: 20, color: colors['text/tertiary'] },
  scoreChip: { height: 22, justifyContent: 'center', paddingHorizontal: sizes['space/2'], borderRadius: sizes['radius/full'], backgroundColor: colors['chip/batting/bg'] },
  scoreChipText: { ...textStyles['Status/Label'], color: colors['scoreboard/text'], textTransform: 'uppercase' },
  right: { flexDirection: 'row', alignItems: 'center', paddingTop: sizes['space/3'] },
  countPill: { height: 22, justifyContent: 'center', paddingHorizontal: sizes['space/2'], borderRadius: sizes['radius/full'], backgroundColor: colors['surface/page'] },
  countPillText: { ...textStyles.Caption, fontWeight: '600', color: colors['text/secondary'] },
  pitches: { flexDirection: 'row', paddingBottom: sizes['space/3'] },
  pitchIndent: { width: 44 },
  pitchList: { flex: 1 },
  // Figma Pitch Row: a 14-wide number, 10, the 12 mark, 10, the result, and the count after the pitch.
  pitchRow: { minHeight: 24, flexDirection: 'row', alignItems: 'center', gap: sizes['space/2'] },
  pitchNumber: { ...textStyles.Caption, width: 16, textAlign: 'right', color: colors['text/tertiary'] },
  markSlot: { width: 14, height: 12, justifyContent: 'center' },
  markDot: { width: 10, height: 10, left: 1, borderRadius: sizes['radius/full'] },
  markBall: { position: 'absolute', left: -0.9375, top: -0.375, width: 13.875, height: 13.875 },
  pitchLabel: { ...textStyles.Caption, flex: 1, color: colors['text/primary'] },
  pitchCount: { ...textStyles.Caption, color: colors['text/tertiary'] },
  undone: { color: colors['text/tertiary'], textDecorationLine: 'line-through' },
  hint: { ...textStyles.Caption, color: colors['text/tertiary'], textAlign: 'center' },
});

const markStyles = createStyles({
  ball: { backgroundColor: colors['count/ball'] },
  strike: { backgroundColor: colors['count/strike'] },
  foul: { borderWidth: 2, borderColor: colors['count/strike'] },
});
