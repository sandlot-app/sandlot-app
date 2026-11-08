import { tokens } from '@sandlot/tokens';
import { useId } from 'react';
import { Text, View } from 'react-native';
import Svg, { Defs, Mask, Path, Rect, Text as SvgText } from 'react-native-svg';
import { createStyles } from '../../style';
import type { GameShare } from './game-share.ts';
import { fitLastName, heavyWidth } from './fit.ts';
import { Wordmark } from './wordmark.tsx';

// The stat stickers (Figma Stat Sticker 232:13833) and the stat card (Stat Card 223:13847), at their 360-point export
// width. Stickers have one ink and no background, so they lay over a family's own photo or video. With the name off,
// the team name takes the child's name's place, and the first name and the extra team line are hidden.

const { colors, sizes, textStyles } = tokens.modes.Light;

export type Ink = 'white' | 'black';
export type ShareKind = 'poster' | 'lowerThird' | 'jersey' | 'team' | 'card';
export type ImageProps = { share: GameShare; ink: Ink; showName: boolean };

const inkColor = (ink: Ink) => (ink === 'white' ? colors['scoreboard/text'] : colors['text/primary']);
const haloColor = (ink: Ink) => (ink === 'white' ? colors['chip/label/halo'] : colors['surface/card']);
const upper = (value: string) => value.toLocaleUpperCase();

/**
 * Text drawn as an outline outside the letters, like Figma's outside stroke. A mask keeps only the stroke beyond the
 * glyphs, so the seams where a heavy font's letter shapes overlap (inside an A or a K) don't show. The ink's halo sits
 * under it, offset a point, so it stays readable on busy footage.
 */
function OutlineText({ text, size, width, height, x, anchor, color, halo, stroke }:
  { text: string; size: number; width: number; height: number; x: number; anchor: 'start' | 'middle'; color: string; halo: string | null; stroke: number }) {
  const id = `outline${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  // The outline sits outside the letters, so the drawing is padded by the stroke on every side, or it clips at the top.
  const pad = stroke * 2;
  const glyph = { x, y: pad + size * 0.78, fontSize: size, fontWeight: '900' as const, textAnchor: anchor };
  height += pad * 2;
  return <Svg width={width} height={height}>
    <Defs>
      <Mask id={id} maskUnits="userSpaceOnUse" x={0} y={0} width={width} height={height}>
        <SvgText {...glyph} fill="none" stroke="white" strokeWidth={stroke * 2} strokeLinejoin="round">{text}</SvgText>
        <SvgText {...glyph} fill="black">{text}</SvgText>
      </Mask>
    </Defs>
    {halo ? <Rect y={1} width={width} height={height} fill={halo} fillOpacity={0.35} mask={`url(#${id})`} /> : null}
    <Rect width={width} height={height} fill={color} mask={`url(#${id})`} />
  </Svg>;
}

/** A big jersey number as an outline. */
const outlinedWidth = (text: string, size: number, stroke: number) => Math.ceil(heavyWidth(text) * size) + stroke * 4;

function Outlined({ text, size, ink, stroke }: { text: string; size: number; ink: Ink | 'card'; stroke: number }) {
  const width = outlinedWidth(text, size, stroke);
  return <OutlineText text={text} size={size} width={width} height={Math.ceil(size * 0.84)} x={stroke * 2} anchor="start" stroke={stroke}
    color={ink === 'card' ? colors['scoreboard/text'] : inkColor(ink)} halo={ink === 'card' ? null : haloColor(ink)} />;
}

const twoDigits = (share: GameShare) => share.number.length > 1;

export function Poster({ share, ink, showName }: ImageProps) {
  const s = ink === 'white' ? white : black;
  const numberSize = twoDigits(share) ? 76 : 112;
  const last = fitLastName(showName ? share.last : share.team, 360 - outlinedWidth(share.number, numberSize, 2) - 12, 26);
  return <View style={styles.poster} collapsable={false}>
    {showName ? <Text style={[styles.team, s.text]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{upper(share.team)}</Text> : null}
    <View style={styles.posterPlayer}>
      <Outlined text={share.number} size={numberSize} ink={ink} stroke={2} />
      <View style={styles.posterName}>
        {showName ? <Text style={[styles.first, s.text]}>{upper(share.first)}</Text> : null}
        <Text style={[styles.posterLast, s.text, last.style]} numberOfLines={2}>{last.text}</Text>
      </View>
    </View>
    <View style={[styles.posterStats, s.rule]}>
      {share.stats.map((cell) => <View key={cell.label} style={styles.posterCell}>
        <Text style={[styles.posterValue, s.text]}>{cell.value}</Text>
        <Text style={[styles.statLabel, s.text]}>{cell.label}</Text>
      </View>)}
    </View>
    <View style={styles.posterFooter}>
      <Text style={[styles.highlight, s.text]} numberOfLines={2}>{share.bestPlay ?? ''}</Text>
      <Wordmark width={84} ink={inkColor(ink)} />
    </View>
  </View>;
}

export function LowerThird({ share, ink, showName }: ImageProps) {
  const s = ink === 'white' ? white : black;
  return <View style={styles.lowerThird} collapsable={false}>
    <Outlined text={share.number} size={twoDigits(share) ? 52 : 64} ink={ink} stroke={1.5} />
    <View style={[styles.lowerRule, s.fill]} />
    <View style={styles.lowerStack}>
      {showName ? <Text style={[styles.statLabel, s.text]}>{upper(share.team)}</Text> : null}
      <Text style={[styles.lowerName, s.text]} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.6}>
        {upper(showName ? `${share.first} ${share.last}` : share.team)}
      </Text>
      <Text style={[styles.statLabel, s.text]}>{share.gameLine}</Text>
    </View>
    <Wordmark width={64} ink={inkColor(ink)} />
  </View>;
}

export function Jersey({ share, ink, showName }: ImageProps) {
  const s = ink === 'white' ? white : black;
  return <View style={styles.jersey} collapsable={false}>
    <Text style={[styles.jerseyName, s.text]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5}>
      {upper(showName ? share.last : share.team)}
    </Text>
    <Text style={[twoDigits(share) ? styles.jerseyNumberTwo : styles.jerseyNumber, s.text]}>{share.number}</Text>
    <View style={styles.jerseyMeta}>
      <Text style={[styles.statLabel, s.text]}>{showName ? `${upper(share.team)} · ${share.season}` : share.season}</Text>
      <View style={[styles.jerseyDivider, s.fill]} />
      <Wordmark width={64} ink={inkColor(ink)} />
    </View>
  </View>;
}

export function Team({ share, ink, showName }: ImageProps) {
  const s = ink === 'white' ? white : black;
  const name = upper(share.team);
  const size = Math.min(112, Math.floor(348 / heavyWidth(name)));
  return <View style={styles.teamSticker} collapsable={false}>
    <OutlineText text={name} size={size} width={360} height={Math.ceil(size * 0.9)} x={180} anchor="middle" stroke={2}
      color={inkColor(ink)} halo={haloColor(ink)} />
    <Text style={[styles.teamPlayer, s.text]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5}>
      {showName ? `#${share.number} ${upper(share.last)}` : `#${share.number}`}
    </Text>
    <View style={styles.teamBrand}><Wordmark width={64} ink={inkColor(ink)} /></View>
  </View>;
}

/** The finished 360 × 450 card, exported at 3x as 1080 × 1350. */
export function StatCard({ share, showName }: Omit<ImageProps, 'ink'>) {
  const last = fitLastName(showName ? share.last : share.team, 160, 18);
  return <View style={styles.card} collapsable={false}>
    <View style={styles.cardVisual}>
      <View style={twoDigits(share) ? styles.cardNumberTwo : styles.cardNumber}>
        <Outlined text={share.number} size={twoDigits(share) ? 112 : 232} ink="card" stroke={2.5} />
      </View>
    </View>
    <Svg width={360} height={372} viewBox="0 0 360 372" style={styles.cardDiagonal}>
      <Path d="M177 0H360V372H111Z" fill={colors['scoreboard/bg']} />
      <Path d="M171 0H177L111 372H105Z" fill={colors['logo/emblem']} />
    </Svg>
    <View style={styles.cardColumn}>
      <View>
        {showName ? <Text style={styles.cardTeam} numberOfLines={2}>{upper(share.team)}</Text> : null}
        <Text style={styles.cardMuted}>{`${share.date} · ${upper(share.division)}`}</Text>
      </View>
      <View style={styles.cardName}>
        {showName ? <Text style={styles.cardFirst}>{upper(share.first)}</Text> : null}
        <Text style={[styles.cardLast, last.style]} numberOfLines={2}>{last.text}</Text>
        <Text style={styles.cardMuted}>{[`#${share.number}`, share.position].filter(Boolean).join(' · ')}</Text>
      </View>
      <View style={styles.cardRows}>
        {share.stats.map((cell) => <View key={cell.label} style={styles.cardRow}>
          <View style={styles.cardLabelPill}><Text style={styles.cardLabel}>{cell.label}</Text></View>
          <View style={styles.cardValuePill}><Text style={styles.cardValue}>{cell.value}</Text></View>
        </View>)}
      </View>
    </View>
    <View style={styles.cardBar}>
      <View style={styles.cardPlay}>
        {share.bestPlay ? <>
          <Text style={styles.cardMuted}>BEST PLAY</Text>
          <Text style={styles.cardHighlight} numberOfLines={2}>{share.bestPlay}</Text>
        </> : null}
      </View>
      <View style={styles.cardLogo}><Wordmark width={78} ink={colors['scoreboard/text']} emblemColor={colors['logo/emblem']} /></View>
    </View>
  </View>;
}

export const shareImages: Record<Exclude<ShareKind, 'card'>, (props: ImageProps) => React.ReactNode> = {
  poster: Poster, lowerThird: LowerThird, jersey: Jersey, team: Team,
};

const halo = { textShadowOffset: { width: 0, height: 1 }, textShadowRadius: sizes['radius/sm'] };
const white = createStyles({
  text: { color: colors['scoreboard/text'], textShadowColor: colors['chip/label/halo'], ...halo },
  rule: { borderTopColor: colors['scoreboard/text'] },
  fill: { backgroundColor: colors['scoreboard/text'] },
});
const black = createStyles({
  text: { color: colors['text/primary'], textShadowColor: colors['surface/card'], ...halo },
  rule: { borderTopColor: colors['text/primary'] },
  fill: { backgroundColor: colors['text/primary'] },
});

const display = { fontWeight: '900', textTransform: 'uppercase' } as const;
const styles = createStyles({
  // Poster
  poster: { width: 360, gap: sizes['space/4'] },
  team: { ...textStyles['Score/Team'], textTransform: 'uppercase' },
  posterPlayer: { flexDirection: 'row', alignItems: 'flex-end', gap: sizes['space/3'] },
  posterName: { flex: 1 },
  first: { ...textStyles['Player/Name'], textTransform: 'uppercase' },
  posterLast: { ...display, fontSize: 60, lineHeight: 60, letterSpacing: -1.8 },
  posterStats: { flexDirection: 'row', borderTopWidth: 2, paddingTop: sizes['space/2'] },
  posterCell: { width: 90 },
  posterValue: { ...textStyles['Score/Numeral'] },
  statLabel: { ...textStyles['Status/Label'], textTransform: 'uppercase' },
  posterFooter: { flexDirection: 'row', alignItems: 'flex-end', gap: sizes['space/3'] },
  highlight: { ...textStyles['Body/Strong'], flex: 1 },
  // Lower third
  lowerThird: { width: 360, flexDirection: 'row', alignItems: 'center', gap: sizes['space/3'] },
  lowerRule: { width: 2, height: 52 },
  lowerStack: { flex: 1, gap: sizes['space/1'] },
  lowerName: { ...display, fontSize: 24, lineHeight: 30, letterSpacing: -0.48 },
  // Jersey
  jersey: { width: 360, alignItems: 'center' },
  jerseyName: { ...display, fontSize: 44, lineHeight: 58, letterSpacing: 5.3, textAlign: 'center' },
  jerseyNumber: { fontWeight: '900', fontSize: 200, lineHeight: 204, letterSpacing: -8 },
  jerseyNumberTwo: { fontWeight: '900', fontSize: 150, lineHeight: 156, letterSpacing: -6 },
  jerseyMeta: { flexDirection: 'row', alignItems: 'center', gap: sizes['space/3'], paddingTop: sizes['space/3'] },
  jerseyDivider: { width: 1.5, height: 14 },
  // Team
  teamSticker: { width: 360, alignItems: 'center' },
  teamPlayer: { ...display, fontSize: 44, lineHeight: 58, letterSpacing: -0.88, textAlign: 'center' },
  teamBrand: { paddingTop: sizes['space/3'] },
  // Card
  card: { width: 360, height: 450, overflow: 'hidden', backgroundColor: colors['scoreboard/bg'] },
  cardVisual: { position: 'absolute', left: 0, top: 0, width: 200, height: 372, overflow: 'hidden', backgroundColor: colors['count/well'] },
  cardNumber: { position: 'absolute', left: -4, top: 56 },
  cardNumberTwo: { position: 'absolute', left: -2, top: 110 },
  cardDiagonal: { position: 'absolute', left: 0, top: 0 },
  cardColumn: { position: 'absolute', left: 184, top: 20, width: 160, gap: sizes['space/4'] },
  cardTeam: { ...textStyles['Status/Label'], color: colors['scoreboard/text'] },
  cardMuted: { ...textStyles['Label/Caps'], color: colors['scoreboard/text-muted'], textTransform: 'uppercase' },
  cardName: { gap: sizes['space/1'] },
  cardFirst: { ...textStyles['Player/Name'], color: colors['scoreboard/text'], textTransform: 'uppercase' },
  cardLast: { ...display, fontSize: 60, lineHeight: 60, letterSpacing: -1.8, color: colors['scoreboard/text'] },
  cardRows: { gap: sizes['space/1'] },
  cardRow: { flexDirection: 'row', height: 30, gap: sizes['space/1'] },
  cardLabelPill: { width: 52, borderRadius: sizes['radius/sm'], backgroundColor: colors['count/well'], alignItems: 'center', justifyContent: 'center' },
  cardLabel: { ...textStyles['Status/Label'], color: colors['scoreboard/text-muted'] },
  cardValuePill: { flex: 1, borderRadius: sizes['radius/sm'], backgroundColor: colors['surface/card'], alignItems: 'center', justifyContent: 'center' },
  cardValue: { ...textStyles['Score/Compact'], color: colors['text/primary'] },
  cardBar: { position: 'absolute', left: 0, top: 372, width: 360, height: 78, borderTopWidth: 1, borderTopColor: colors['border/glass'],
    flexDirection: 'row', alignItems: 'center', gap: sizes['space/2'], paddingHorizontal: sizes['space/4'] },
  cardPlay: { flex: 1 },
  cardHighlight: { ...textStyles['Body/Strong'], color: colors['scoreboard/text'] },
  cardLogo: { backgroundColor: colors['logo/background'], borderRadius: sizes['radius/sm'], paddingHorizontal: sizes['space/2'], paddingVertical: sizes['space/1'] },
});
