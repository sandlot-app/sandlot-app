import { tokens } from '@sandlot/tokens';
import type { GameState } from '@sandlot/engine';
import { Platform } from 'react-native';
import Svg, {
  Circle,
  ClipPath,
  Defs,
  Ellipse,
  G,
  LinearGradient,
  Path,
  Rect,
  Stop,
  Text as SvgText,
} from 'react-native-svg';

const { colors } = tokens.modes.Light;

const positions = [
  { label: 'LF', x: 78, y: 105 },
  { label: 'CF', x: 195, y: 83 },
  { label: 'RF', x: 312, y: 105 },
  { label: 'SS', x: 139, y: 158 },
  { label: '2B', x: 251, y: 158 },
  { label: '3B', x: 61, y: 192 },
  { label: '1B', x: 329, y: 192 },
  { label: 'P', x: 195, y: 208 },
  { label: 'C', x: 195, y: 305 },
];
const basePoints = [
  { base: 1, x: 319, y: 212 },
  { base: 2, x: 195, y: 148 },
  { base: 3, x: 71, y: 212 },
] as const;

export function BaseDiamond({ bases }: { bases: GameState['bases'] }) {
  return (
    <Svg
      width={50}
      height={43}
      viewBox="0 0 50 43"
      accessible={Platform.OS === 'web' ? undefined : false}
      aria-hidden={Platform.OS === 'web' ? true : undefined}
    >
      <Path
        d="m25 2 8 8-8 8-8-8Z"
        fill={bases[2] ? colors['count/ball'] : colors['surface/card']}
        stroke={colors['border/subtle']}
        strokeWidth={1.5}
      />
      <Path
        d="m14 13 8 8-8 8-8-8Z"
        fill={bases[3] ? colors['count/ball'] : colors['surface/card']}
        stroke={colors['border/subtle']}
        strokeWidth={1.5}
      />
      <Path
        d="m36 13 8 8-8 8-8-8Z"
        fill={bases[1] ? colors['count/ball'] : colors['surface/card']}
        stroke={colors['border/subtle']}
        strokeWidth={1.5}
      />
      <Path d="m22 35 3 3 3-3v-4h-6Z" fill={colors['text/primary']} />
    </Svg>
  );
}

export function Field({
  bases,
  height,
}: {
  bases: GameState['bases'];
  height: number;
}) {
  return (
    <Svg
      width="100%"
      height={height}
      viewBox="0 0 390 326"
      preserveAspectRatio="none"
      accessible={Platform.OS === 'web' ? undefined : false}
      aria-hidden={Platform.OS === 'web' ? true : undefined}
    >
      <Defs>
        <LinearGradient id="sky" x2="0" y2="1">
          <Stop stopColor={colors['surface/page']} />
          <Stop offset="1" stopColor={colors['surface/voice']} />
        </LinearGradient>
        <LinearGradient id="grass" x2="0" y2="1">
          <Stop stopColor={colors['field/grass-stripe']} />
          <Stop offset="1" stopColor={colors['field/grass']} />
        </LinearGradient>
        <LinearGradient id="clay" x2="0" y2="1">
          <Stop stopColor={colors['field/mound']} />
          <Stop offset="1" stopColor={colors['field/dirt']} />
        </LinearGradient>
        <ClipPath id="outfield">
          <Path d="M-15 87Q195 21 405 87L405 326H-15Z" />
        </ClipPath>
        <ClipPath id="innergrass">
          <Path d="M195 281 31 196Q195 110 359 196Z" />
        </ClipPath>
      </Defs>
      <Rect width="390" height="326" fill="url(#sky)" />
      <Path
        d="M-20 82Q195 12 410 82"
        fill="none"
        stroke={colors['scoreboard/text-muted']}
        strokeWidth="13"
      />
      <Path d="M-20 81Q195 15 410 81V113H-20Z" fill={colors['scoreboard/bg']} />
      <Path
        d="M-20 80Q195 14 410 80"
        fill="none"
        stroke={colors['field/mound']}
        strokeWidth="2.2"
      />
      <Path d="M-15 97Q195 30 405 97V326H-15Z" fill="url(#grass)" />
      <G clipPath="url(#outfield)" opacity=".14" fill={colors['field/grass-stripe']}>
        <Path d="M-200 180 260 20 295 35-160 220Z" />
        <Path d="M-100 235 340 70 375 85-60 270Z" />
        <Path d="M10 290 440 125 475 140 45 323Z" />
        <Path d="M135 345 550 180 585 195 170 378Z" />
        <Path d="M255 400 670 235 705 250 290 433Z" />
      </G>
      <Path d="M-15 254 195 122 405 254 405 326H-15Z" fill="url(#clay)" />
      <Path d="M-20 196 195 301 410 196V244Q195 396-20 244Z" fill={colors['field/grass']} />
      <Path d="M195 293-10 196Q195 82 400 196Z" fill="url(#clay)" />
      <Path d="M195 281 31 196Q195 110 359 196Z" fill={colors['field/grass-stripe']} />
      <G clipPath="url(#innergrass)" fill={colors['field/grass']} opacity=".2">
        <Path d="M-15 214 282 104 312 118 15 230Z" />
        <Path d="M48 248 345 138 375 152 78 264Z" />
        <Path d="M113 281 410 171 440 185 143 297Z" />
      </G>
      <Path
        d="M195 276 71 212 195 148 319 212Z"
        fill="none"
        stroke={colors['field/line']}
        strokeWidth="1.2"
        opacity=".85"
      />
      <Path
        d="M195 276-15 168M195 276 405 168"
        fill="none"
        stroke={colors['field/line']}
        strokeWidth="1.4"
        opacity=".8"
      />
      <Ellipse cx="195" cy="223" rx="19" ry="8" fill={colors['field/mound']} />
      <Rect x="190" y="221" width="10" height="2" rx="1" fill={colors['field/base']} />
      <G fill={colors['field/base']} stroke={colors['field/dirt']} strokeWidth=".6">
        <Path d="m195 144 5 4-5 4-5-4Z" />
        <Path d="m71 208 5 4-5 4-5-4Z" />
        <Path d="m319 208 5 4-5 4-5-4Z" />
        <Path d="M191 272h8v5l-4 3-4-3Z" />
      </G>
      <G fill="none" stroke={colors['field/line']} strokeWidth=".8" opacity=".8">
        <Path d="M181 269h6v12h-6ZM203 269h6v12h-6Z" />
        <Path d="M173 285Q195 301 217 285" />
      </G>
      {positions.map(({ label, x, y }) => (
        <G key={label} transform={`translate(${x} ${y})`}>
          <Circle
            r="12"
            fill={label === 'P' ? colors['chip/fielding/bg'] : colors['scoreboard/bg']}
            stroke={colors['chip/outline']}
            strokeWidth=".8"
          />
          <SvgText
            y="3.5"
            textAnchor="middle"
            fontWeight="600"
            fontSize="10"
            fill={label === 'P' ? colors['chip/fielding/text'] : colors['surface/card']}
          >
            {label}
          </SvgText>
        </G>
      ))}
      {basePoints
        .filter(({ base }) => bases[base])
        .map(({ base, x, y }) => (
          <G key={base} transform={`translate(${x} ${y})`}>
            <Circle r="10" fill={colors['action/primary']} stroke={colors['surface/card']} strokeWidth="2" />
            <SvgText
              y="3.5"
              textAnchor="middle"
              fontWeight="700"
              fontSize="11"
              fill={colors['surface/card']}
            >
              {base}
            </SvgText>
          </G>
        ))}
    </Svg>
  );
}
