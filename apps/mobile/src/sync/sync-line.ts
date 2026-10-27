import type { SyncState } from '../../scorer-ui';
import type { StopReason, UploadStatus } from './upload.ts';

const stopReasons: Record<StopReason, string> = {
  update_app: 'update the app',
  rejected: 'a play was rejected',
  session: 'another phone is scoring',
  conflict: 'the server’s game differs',
  signed_out: 'this phone is signed out',
};

/**
 * The Scorer Bar's sync line (Figma Sync Status 72:2925). A live game is Saved once the server has every play, Saving
 * only while an upload has taken over half a second, and Offline once a try got no answer, through every retry until
 * one does. A stopped queue reads like Offline with its reason; Figma has no state for it.
 */
export function syncLine({ live, waiting, saving, upload, slow, lastPlay }: {
  live: boolean; waiting: number; saving: boolean; upload: UploadStatus | null; slow: boolean; lastPlay: string;
}): SyncState {
  if (saving) return { status: 'saving', lastPlay };
  if (!live) return { status: 'offline', lastPlay, waiting };
  if (!waiting) return { status: 'saved', lastPlay };
  if (upload?.kind === 'stopped') return { status: 'stopped', lastPlay, waiting, reason: stopReasons[upload.reason] };
  if (upload?.kind === 'waiting') return { status: 'offline', lastPlay, waiting };
  return slow ? { status: 'saving', lastPlay } : { status: 'saved', lastPlay };
}
