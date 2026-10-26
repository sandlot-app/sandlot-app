import { tokens } from '@sandlot/tokens';
import type { Base, GameState, Position } from '@sandlot/engine';
import { useState } from 'react';
import { Image, Platform, View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import { PlayerChip } from '../../scorer-ui';
import { createStyles } from '../../style';
import { playerDisplay } from '../scoring/demo-roster.ts';

const { colors, sizes } = tokens.modes.Light;

// Figma Field (21:264) is 361 × 390. Spots are each chip disc's center x and the chip's top y.
const designWidth = 361;
const designHeight = 390;
const chipWidth = 74;
const fielderSpots: Partial<Record<Position, { x: number; y: number }>> = {
  CF: { x: 181, y: 31 }, LF: { x: 68, y: 71 }, RF: { x: 293.5, y: 71 },
  SS: { x: 131, y: 137 }, '2B': { x: 230, y: 137 }, '3B': { x: 56.5, y: 155 },
  '1B': { x: 302, y: 155 }, P: { x: 180.5, y: 205 }, C: { x: 181, y: 329 },
};
const runnerSpots: Record<Base, { x: number; y: number }> = {
  1: { x: 259, y: 201 }, 2: { x: 181, y: 123 }, 3: { x: 103, y: 201 },
};
const batterSpot = { x: 141, y: 268 };

const fieldSize = (width: number) => ({ height: (width * designHeight) / designWidth });
const surfaceFrame = (scale: number) => ({ left: -119.5 * scale, top: 0, width: 600 * scale, height: 600 * scale });
const spot = (scale: number, { x, y }: { x: number; y: number }) => ({ left: x * scale - chipWidth / 2, top: y * scale });

export function Field({ state }: { state: GameState }) {
  const [width, setWidth] = useState(designWidth);
  const scale = width / designWidth;
  const batting = state.half === 'top' ? 'away' : 'home';
  const fielding = state.half === 'top' ? 'home' : 'away';
  const batter = state.lineups[batting][state.nextBatter[batting]]?.player;
  return (
    <View style={[styles.field, fieldSize(width)]} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      importantForAccessibility="no-hide-descendants" accessibilityElementsHidden testID="field">
      <Image source={require('../../assets/scorer/field-surface.png')} accessible={false} style={[styles.surface, surfaceFrame(scale)]} />
      {state.lineups[fielding].map(({ player, position }) => {
        const at = position ? fielderSpots[position] : undefined;
        if (!at) return null;
        const shown = playerDisplay(state, fielding, player);
        return <View key={player.id} style={[styles.chip, spot(scale, at)]}>
          <PlayerChip number={shown.number} name={shown.name} role="fielding" />
        </View>;
      })}
      {([1, 2, 3] as const).map((base) => {
        const runner = state.bases[base]?.player;
        if (!runner) return null;
        const shown = playerDisplay(state, batting, runner);
        return <View key={base} style={[styles.chip, spot(scale, runnerSpots[base])]} testID={`field-runner-${base}`}>
          <PlayerChip number={shown.number} name={shown.name} role="batting" />
        </View>;
      })}
      {batter && state.status !== 'final' ? <View style={[styles.chip, spot(scale, batterSpot)]}>
        <PlayerChip {...playerDisplay(state, batting, batter)} role="batter" />
      </View> : null}
    </View>
  );
}

// Figma Mini Diamond (3:74): 8.8 squares with 3.5 corners, turned 45°.
const miniBases: Record<Base, { x: number; y: number }> = { 2: { x: 15.4, y: 6.6 }, 3: { x: 6.6, y: 15.4 }, 1: { x: 24.2, y: 15.4 } };

/** The scoreboard's runner state: raised yellow when a base is occupied, a recessed well when it's empty. */
export function MiniDiamond({ bases }: { bases: GameState['bases'] }) {
  return <Svg width={30.8} height={22} viewBox="0 0 30.8 22" accessible={Platform.OS === 'web' ? undefined : false} aria-hidden={Platform.OS === 'web' ? true : undefined}>
    {([1, 2, 3] as const).map((base) => {
      const { x, y } = miniBases[base];
      return <Rect key={base} x={x - 4.4} y={y - 4.4} width={8.8} height={8.8} rx={3.5} transform={`rotate(45 ${x} ${y})`}
        fill={bases[base] ? colors['diamond/occupied'] : colors['count/well']}
        stroke={bases[base] ? undefined : colors['border/well']} strokeWidth={bases[base] ? 0 : 0.825} />;
    })}
  </Svg>;
}

const styles = createStyles({
  field: { width: '100%', backgroundColor: colors['field/grass'], borderRadius: sizes['radius/xl'], overflow: 'hidden' },
  surface: { position: 'absolute' },
  chip: { position: 'absolute', width: chipWidth },
});
