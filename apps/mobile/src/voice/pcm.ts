// 16-bit mono PCM at 24 kHz, the only audio voice-session and voice-parse take (docs/contract.md, Voice).

export const SAMPLE_RATE = 24000;
/** 30 seconds of audio, the longest press, counting the second kept before the touch, and the safety limit that ends a forgotten mic (spec A2). */
export const MAX_CLIP_BYTES = 30 * SAMPLE_RATE * 2;

const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function toBase64(bytes: Uint8Array): string {
  let out = '';
  for (let index = 0; index < bytes.length; index += 3) {
    const [a, b = 0, c = 0] = [bytes[index]!, bytes[index + 1], bytes[index + 2]];
    const triple = (a << 16) | (b << 8) | c;
    out += alphabet[(triple >> 18) & 63]! + alphabet[(triple >> 12) & 63]!
      + (index + 1 < bytes.length ? alphabet[(triple >> 6) & 63]! : '=')
      + (index + 2 < bytes.length ? alphabet[triple & 63]! : '=');
  }
  return out;
}

/** The whole press, kept so it can go to voice-parse when streaming didn't connect (spec A4, A5). */
export class Clip {
  private chunks: Uint8Array[] = [];
  private size = 0;

  get bytes(): number { return this.size; }
  get full(): boolean { return this.size >= MAX_CLIP_BYTES; }

  /** Keeps what fits under 30 seconds and returns that part, so the stream sends the same audio. */
  append(chunk: Uint8Array): Uint8Array {
    const room = MAX_CLIP_BYTES - this.size;
    // Whole samples only, so a cut never splits one.
    const kept = chunk.length <= room ? chunk : chunk.subarray(0, room - (room % 2));
    if (kept.length) {
      this.chunks.push(kept);
      this.size += kept.length;
    }
    return kept;
  }

  /** Every chunk so far, for the socket once it opens. */
  sent(): Uint8Array[] { return [...this.chunks]; }

  join(): Uint8Array {
    const out = new Uint8Array(this.size);
    let at = 0;
    for (const chunk of this.chunks) {
      out.set(chunk, at);
      at += chunk.length;
    }
    return out;
  }
}
