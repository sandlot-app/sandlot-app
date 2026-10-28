// Sizing rules for the heavy display type on stat stickers and the card (#70, Figma 236:13863 worst cases). Pure, so it's
// tested without rendering.

const upper = (value: string) => value.toLocaleUpperCase();

// Rough advance widths of heavy capitals and digits, in ems, so outlined text gets room without measuring it first.
const wide = new Set(['M', 'W']);
const narrow = new Set(['I', '1', ' ', '.', '-', "'", '’']);
const digits = new Set(['0', '2', '3', '4', '5', '6', '7', '8', '9']);
/** About how wide `text` sets in a heavy weight, in ems. It errs wide, since outlined text can't shrink to fit. */
export function heavyWidth(text: string): number {
  return [...text].reduce((sum, letter) => sum + (wide.has(letter) ? 1.0 : narrow.has(letter) ? 0.4 : digits.has(letter) ? 0.66 : 0.78), 0);
}

/**
 * A last name sized to its column: a long one breaks after its hyphen or first space (Oberhauser- / Wettstein), and the
 * longest line sets the size, from 60 down to `floor`. iOS won't shrink one long word to fit, it breaks it, so the size is
 * chosen here.
 */
export function fitLastName(name: string, column: number, floor: number): { text: string; style: { fontSize: number; lineHeight: number } } {
  const upperName = upper(name);
  const at = upperName.indexOf('-') >= 0 ? upperName.indexOf('-') + 1 : upperName.indexOf(' ');
  const text = heavyWidth(upperName) * 60 > column && at > 0
    ? `${upperName.slice(0, at).trimEnd()}\n${upperName.slice(at).trimStart()}` : upperName;
  const longest = Math.max(...text.split('\n').map(heavyWidth));
  const fontSize = Math.max(floor, Math.min(60, Math.floor(column / longest)));
  return { text, style: { fontSize, lineHeight: Math.round(fontSize * 1.1) } };
}
