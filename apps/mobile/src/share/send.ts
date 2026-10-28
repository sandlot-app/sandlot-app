import * as Clipboard from 'expo-clipboard';
import { Asset, requestPermissionsAsync } from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import { PixelRatio, Platform } from 'react-native';
import { captureRef, releaseCapture } from 'react-native-view-shot';

// Turns the picked stickers and card into PNGs and sends them where the family chose. Files get the library's own
// random names, so a child's name never lands in a file name. Nothing is uploaded by Sandlot.

/** One image to send: the hidden full-size view and its laid-out height in points. */
export type Capture = { view: Parameters<typeof captureRef>[0]; height: number };

// view-shot takes width and height in points and multiplies them by the screen's pixel ratio, so 1080 pixels wide on
// any phone is 1080 / ratio points. Stickers and the card are laid out 360 points wide.
const exportPixels = 1080;
const options = (capture: Capture) => {
  const width = exportPixels / PixelRatio.get();
  return { format: 'png' as const, width, height: width * capture.height / 360 };
};

/** Saves every capture to Photos, asking for add-only access the first time. */
export async function saveToPhotos(captures: Capture[]): Promise<string> {
  const permission = await requestPermissionsAsync(true);
  if (!permission.granted) return 'Photos access is off. Turn it on in Settings to save.';
  for (const capture of captures) {
    const uri = await captureRef(capture.view, { ...options(capture), result: 'tmpfile' });
    try {
      await Asset.create(uri);
    } finally {
      releaseCapture(uri);
    }
  }
  return captures.length === 1 ? 'Saved to Photos.' : `Saved ${captures.length} to Photos.`;
}

/** Copies one capture, to paste into a story. */
export async function copyImage(capture: Capture): Promise<string> {
  await Clipboard.setImageAsync(await captureRef(capture.view, { ...options(capture), result: 'base64' }));
  return 'Copied. Paste it into your story.';
}

// Android files handed to the share sheet, kept until the next share, when the target app is long done with them.
// view-shot also clears its leftovers when the app starts.
let shared: string[] = [];

/** Opens the phone's share sheet with one capture. */
export async function shareSheet(capture: Capture): Promise<string | null> {
  if (!(await Sharing.isAvailableAsync())) return 'Sharing isn’t available on this phone.';
  shared.forEach(releaseCapture);
  shared = [];
  const uri = await captureRef(capture.view, { ...options(capture), result: 'tmpfile' });
  try {
    await Sharing.shareAsync(uri, { mimeType: 'image/png', UTI: 'public.png' });
  } finally {
    // iOS settles once the sheet closes. Android can settle as soon as the chooser hands off, before the target app has
    // read the file, so there it waits for the next share.
    if (Platform.OS === 'ios') releaseCapture(uri);
    else shared.push(uri);
  }
  return null;
}
