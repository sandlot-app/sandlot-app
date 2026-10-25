import type { ColorToken, RadiusToken, SpacingToken } from '@sandlot/tokens';
import { StyleSheet, type ImageStyle, type TextStyle, type ViewStyle } from 'react-native';

type NativeKey = keyof ViewStyle | keyof TextStyle | keyof ImageStyle;
type NativeValue<K extends NativeKey> =
  (K extends keyof ViewStyle ? ViewStyle[K] : never) |
  (K extends keyof TextStyle ? TextStyle[K] : never) |
  (K extends keyof ImageStyle ? ImageStyle[K] : never);

type TokenStyle = {
  [K in NativeKey]?: K extends 'color' | `${string}Color` ? ColorToken
    : K extends `padding${string}` | `margin${string}` | 'gap' | 'rowGap' | 'columnGap' ? SpacingToken | 0
      : K extends `${string}Radius` ? RadiusToken | 0
        : NativeValue<K>;
};

export function createStyles<const S extends Record<string, TokenStyle>>(styles: S): Readonly<S> {
  return StyleSheet.create(styles);
}
