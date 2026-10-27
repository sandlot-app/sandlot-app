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

/**
 * On a field smaller than Figma's, every chip shrinks by the field's own scale, names included, so they keep
 * Figma's spacing instead of piling up (an iPhone SE's field is about two thirds size). The top center stays on
 * the chip's spot. Chips never grow past their Figma size.
 */
export function chipScale(fieldWidth: number) {
  const scale = fieldWidth / 361;
  return scale < 1 ? { transform: [{ scale }], transformOrigin: '50% 0%' } as const : null;
}
