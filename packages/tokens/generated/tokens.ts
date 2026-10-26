// DO NOT EDIT. Generated from figma-variables.json.
declare const tokenBrand: unique symbol;
export type ColorToken = string & { readonly [tokenBrand]: 'color' };
export type SpacingToken = number & { readonly [tokenBrand]: 'spacing' };
export type RadiusToken = number & { readonly [tokenBrand]: 'radius' };
export const tokens = {
  "modes": {
    "Light": {
      colors: {
        "action/primary": "#1D5FD6" as ColorToken,
        "action/soft": "#E7EEFB" as ColorToken,
        "border/glass": "#FFFFFF1A" as ColorToken,
        "border/subtle": "#D9DDD9" as ColorToken,
        "border/warning": "#F5C04A" as ColorToken,
        "border/well": "#FFFFFF3D" as ColorToken,
        "chip/batting/bg": "#1D5FD6" as ColorToken,
        "chip/batting/text": "#FFFFFF" as ColorToken,
        "chip/fielding/bg": "#FFFFFF" as ColorToken,
        "chip/fielding/text": "#14201B" as ColorToken,
        "chip/label/halo": "#0E3328" as ColorToken,
        "chip/label/text": "#FFFFFF" as ColorToken,
        "chip/outline": "#0E3328" as ColorToken,
        "count/ball": "#5CCB76" as ColorToken,
        "count/empty": "#B9D3C8" as ColorToken,
        "count/out": "#EF5A4C" as ColorToken,
        "count/strike": "#F5C04A" as ColorToken,
        "count/well": "#0E3328" as ColorToken,
        "diamond/empty": "#B9D3C8" as ColorToken,
        "diamond/occupied": "#F5C04A" as ColorToken,
        "field/base": "#FFFFFF" as ColorToken,
        "field/dirt": "#C4855A" as ColorToken,
        "field/grass": "#3B7A3A" as ColorToken,
        "field/grass-stripe": "#458842" as ColorToken,
        "field/line": "#FFFFFF" as ColorToken,
        "field/mound": "#D49A70" as ColorToken,
        "icon/bat": "#E3B072" as ColorToken,
        "logo/background": "#0C4C39" as ColorToken,
        "logo/emblem": "#FF7519" as ColorToken,
        "ring/followed": "#F07A1A" as ColorToken,
        "scoreboard/bg": "#174D3C" as ColorToken,
        "scoreboard/divider": "#1F6149" as ColorToken,
        "scoreboard/text": "#FFFFFF" as ColorToken,
        "scoreboard/text-muted": "#B9D3C8" as ColorToken,
        "status/delayed": "#A9B8C6" as ColorToken,
        "status/live": "#EF5A4C" as ColorToken,
        "status/offline": "#F2A73B" as ColorToken,
        "status/reconnecting": "#9AA19D" as ColorToken,
        "surface/card": "#FFFFFF" as ColorToken,
        "surface/glass": "#FFFFFF1F" as ColorToken,
        "surface/page": "#F7F5EF" as ColorToken,
        "surface/voice": "#E3EEE9" as ColorToken,
        "surface/warning": "#FDF1CC" as ColorToken,
        "text/danger": "#B42318" as ColorToken,
        "text/on-accent": "#FFFFFF" as ColorToken,
        "text/primary": "#14201B" as ColorToken,
        "text/secondary": "#4A5751" as ColorToken,
        "text/tertiary": "#7D8883" as ColorToken,
        "text/warning": "#B45309" as ColorToken
      },
      sizes: {
        "chip/batter-size": 40,
        "chip/outline-width": 1.5,
        "chip/size": 34,
        "dot/size": 12,
        "radius/full": 999 as RadiusToken,
        "radius/lg": 20 as RadiusToken,
        "radius/md": 12 as RadiusToken,
        "radius/sm": 6 as RadiusToken,
        "radius/xl": 28 as RadiusToken,
        "ring/width": 3,
        "space/1": 4 as SpacingToken,
        "space/2": 8 as SpacingToken,
        "space/3": 12 as SpacingToken,
        "space/4": 16 as SpacingToken,
        "space/6": 24 as SpacingToken,
        "tap/min": 44
      },
      textStyles: {
  "Body/Regular": {
    "fontSize": 15,
    "fontWeight": 400,
    "lineHeight": 20,
    "letterSpacing": 0
  },
  "Body/Strong": {
    "fontSize": 15,
    "fontWeight": 600,
    "lineHeight": 20,
    "letterSpacing": 0
  },
  "Caption": {
    "fontSize": 13,
    "fontWeight": 400,
    "lineHeight": 18,
    "letterSpacing": 0
  },
  "Chip/Name": {
    "fontSize": 11,
    "fontWeight": 600,
    "lineHeight": 13,
    "letterSpacing": 0.11
  },
  "Chip/Number": {
    "fontSize": 15,
    "fontWeight": 700,
    "lineHeight": 18,
    "letterSpacing": 0
  },
  "Label/Caps": {
    "fontSize": 11,
    "fontWeight": 600,
    "lineHeight": 14,
    "letterSpacing": 0.66
  },
  "Player/Name": {
    "fontSize": 22,
    "fontWeight": 700,
    "lineHeight": 26,
    "letterSpacing": -0.22
  },
  "Score/Compact": {
    "fontSize": 24,
    "fontWeight": 600,
    "lineHeight": 28,
    "letterSpacing": -0.48
  },
  "Score/Inning": {
    "fontSize": 13,
    "fontWeight": 600,
    "lineHeight": 16,
    "letterSpacing": 0.78
  },
  "Score/Numeral": {
    "fontSize": 48,
    "fontWeight": 600,
    "lineHeight": 52,
    "letterSpacing": -1.44
  },
  "Score/Team": {
    "fontSize": 15,
    "fontWeight": 600,
    "lineHeight": 20,
    "letterSpacing": 0.6
  },
  "Status/Label": {
    "fontSize": 12,
    "fontWeight": 700,
    "lineHeight": 16,
    "letterSpacing": 0.48
  },
  "Tab": {
    "fontSize": 14,
    "fontWeight": 600,
    "lineHeight": 20,
    "letterSpacing": -0.14
  }
}
    }
  }
} as const;
