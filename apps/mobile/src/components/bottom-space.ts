/**
 * Space to add under the Scorer Bar. On iOS the bar's own bottom padding is Figma's, and the home indicator sits
 * over it as in the frame. Android draws its navigation bar over the app, so the bar has to clear all of it.
 */
export function belowBarSpace(os: string, bottomInset: number): number {
  return os === 'android' ? bottomInset : 0;
}
