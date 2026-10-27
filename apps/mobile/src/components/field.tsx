import { tokens } from '@sandlot/tokens';
import type { Base, GameState } from '@sandlot/engine';
import { useState } from 'react';
import { Image, Platform, View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import { PlayerChip } from '../../scorer-ui';
import { createStyles } from '../../style';
import { playerDisplay } from '../scoring/demo-roster.ts';
import { batterSpot, chipLook, fielderSpots, runnerSpots } from './field-room.ts';

const { colors, sizes } = tokens.modes.Light;

// Figma Field (21:264) is 361 × 390. The chip spots are in field-room.ts.
const designWidth = 361;
const designHeight = 390;
const chipWidth = 74;

const fieldSize = (width: number) => ({ height: (width * designHeight) / designWidth });
const surfaceFrame = (scale: number) => ({ left: -119.5 * scale, top: 0, width: 600 * scale, height: 600 * scale });
const spot = (scale: number, { x, y }: { x: number; y: number }) => ({ left: x * scale - chipWidth / 2, top: y * scale });

export function Field({ state }: { state: GameState }) {
  const [width, setWidth] = useState(designWidth);
  const scale = width / designWidth;
  const chips = chipLook(width);
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
        return <View key={player.id} style={[styles.chip, spot(scale, at), chips.style]}>
          <PlayerChip number={shown.number} name={shown.name} role="fielding" showName={chips.names} />
        </View>;
      })}
      {([1, 2, 3] as const).map((base) => {
        const runner = state.bases[base]?.player;
        if (!runner) return null;
        const shown = playerDisplay(state, batting, runner);
        return <View key={base} style={[styles.chip, spot(scale, runnerSpots[base]), chips.style]} testID={`field-runner-${base}`}>
          <PlayerChip number={shown.number} name={shown.name} role="batting" showName={chips.names} />
        </View>;
      })}
      {batter && state.status !== 'final' ? <View style={[styles.chip, spot(scale, batterSpot), chips.style]}>
        <PlayerChip {...playerDisplay(state, batting, batter)} role="batter" showName={chips.names} />
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
