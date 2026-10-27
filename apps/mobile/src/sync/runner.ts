import { uploadWaiting, type Send, type UploadResult, type UploadStore } from './upload.ts';

/**
 * Runs uploads one at a time. A database closes only once `idle` resolves, so a reopen in the middle of an upload
 * never pulls the database out from under it. Asking again while a game's run is going runs it once more afterwards,
 * so a play saved meanwhile still uploads.
 */
export function createUploadRunner(send: Send, slowMs = 500) {
  let active: { store: UploadStore; done: Promise<UploadResult>; again: Promise<UploadResult> | null } | null = null;

  function start(store: UploadStore, after: Promise<unknown>, onSlow: (slow: boolean) => void): Promise<UploadResult> {
    const done = after.then(() => undefined, () => undefined).then(async () => {
      // Figma's Sync Status shows Saving… only once an upload has taken over half a second.
      const timer = setTimeout(() => onSlow(true), slowMs);
      try {
        return await uploadWaiting(store, send);
      } finally {
        clearTimeout(timer);
        onSlow(false);
      }
    });
    const entry = { store, done, again: null as Promise<UploadResult> | null };
    active = entry;
    void done.then(() => undefined, () => undefined).then(() => {
      if (active === entry) active = null;
    });
    return done;
  }

  return {
    run(store: UploadStore, onSlow: (slow: boolean) => void = () => {}): Promise<UploadResult> {
      if (active?.store === store) {
        const current = active;
        current.again ??= start(store, current.done, onSlow);
        return current.again;
      }
      return start(store, active?.done ?? Promise.resolve(), onSlow);
    },
    /** Resolves once no upload is running, so its database can close. */
    idle: async (): Promise<void> => {
      while (active) await active.done.then(() => undefined, () => undefined);
    },
  };
}
