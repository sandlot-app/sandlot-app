import type { Base, Position } from '@sandlot/engine';
import { tokens } from '@sandlot/tokens';

// Figma Field (21:264) is 361 × 390. The field keeps that shape and shrinks to the room left above what sits
// below it, with Figma's 12 gap between them, so the whole screen fits without scrolling.
const fieldShape = 361 / 390;
const fieldGap = 12;

export function fieldWidth(room: { width: number; height: number }, below: number): { width: number } | null {
  return room.width ? { width: Math.max(0, Math.min(room.width, (room.height - below - fieldGap) * fieldShape)) } : null;
}

/**
 * How much of the bottom the field must stay clear of. Messages and the transcript card sit over the field for a
 * moment, so normally only the Scorer Bar takes room. A saved game that won't open stays until the scorer acts,
 * so then the whole dock, error card included, does.
 */
export function roomBelowField({ blocked, bar, dock }: { blocked: boolean; bar: number; dock: number }): number {
  return blocked ? dock : bar;
}

// Figma Field's spots: each chip disc's center x and the chip's top y.
export const fielderSpots: Partial<Record<Position, { x: number; y: number }>> = {
  CF: { x: 181, y: 31 }, LF: { x: 68, y: 71 }, RF: { x: 293.5, y: 71 },
  SS: { x: 131, y: 137 }, '2B': { x: 230, y: 137 }, '3B': { x: 56.5, y: 155 },
  '1B': { x: 302, y: 155 }, P: { x: 180.5, y: 205 }, C: { x: 181, y: 329 },
};
export const runnerSpots: Record<Base, { x: number; y: number }> = {
  1: { x: 259, y: 201 }, 2: { x: 181, y: 123 }, 3: { x: 103, y: 201 },
};
export const batterSpot = { x: 141, y: 268 };

// Chip names are never drawn smaller than this, so they stay readable at a glance outdoors. Christian lowered it from
// 10 to 9 on 2026-10-27 so the iPhone 17 Pro keeps its names under the Field and Plays tabs.
const minNameSize = 9;
const minChipScale = minNameSize / tokens.modes.Light.textStyles['Chip/Name'].fontSize;

const { sizes } = tokens.modes.Light;
const discs = [
  ...Object.values(fielderSpots).map((spot) => ({ spot, size: sizes['chip/size'] })),
  ...Object.values(runnerSpots).map((spot) => ({ spot, size: sizes['chip/size'] })),
  { spot: batterSpot, size: sizes['chip/batter-size'] },
];

/** Whether any two discs touch, with chips at `chip` scale on a field this wide. Each chip hangs from its spot. */
function touching(fieldWidth: number, chip: number): boolean {
  const field = fieldWidth / 361;
  const placed = discs.map(({ spot, size }) => ({ x: spot.x * field, y: spot.y * field + (size * chip) / 2, r: (size * chip) / 2 }));
  return placed.some((a, index) => placed.slice(index + 1).some((b) => Math.hypot(a.x - b.x, a.y - b.y) <= a.r + b.r + 1));
}

/** The largest chip scale, up to the names' floor, at which no two discs touch. */
function clearScale(fieldWidth: number): number {
  let [low, high] = [0, minChipScale];
  for (let step = 0; step < 20; step += 1) {
    const middle = (low + high) / 2;
    if (touching(fieldWidth, middle)) high = middle;
    else low = middle;
  }
  return touching(fieldWidth, minChipScale) ? low : minChipScale;
}

/**
 * How the chips draw on a field this wide. On a field smaller than Figma's, every chip shrinks by the field's own
 * scale, names included, so the chips keep Figma's spacing, until the names would drop below 9 points. On a field
 * tighter than that, such as an iPhone SE's, the chips drop their names and shrink only as far as they must for no two
 * to touch. The top center stays on the chip's spot, and chips never grow past their Figma size.
 */
export function chipLook(fieldWidth: number) {
  const names = fieldWidth / 361 >= minChipScale;
  const scale = names ? Math.min(1, fieldWidth / 361) : clearScale(fieldWidth);
  return {
    style: scale < 1 ? { transform: [{ scale }], transformOrigin: '50% 0%' } as const : null,
    names,
  };
}
