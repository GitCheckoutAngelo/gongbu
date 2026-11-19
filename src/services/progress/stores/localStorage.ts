/** Progress in this browser's localStorage. Export a backup to move it to another device. */
import { parseProgress } from "../backup";
import { registerProgressStore } from "../storeRegistry";
import { emptyProgress, type Progress, type ProgressStore } from "../types";

// Keeps the project's old name (korean-reader) on purpose: changing it would lose everyone's saved progress.
export const STORAGE_KEY = "korean-reader.commonWords.v1";

/** The subset of Storage used here (tests pass a Map-backed fake). */
export type KeyValueStorage = Pick<Storage, "getItem" | "setItem">;

export class LocalStorageProgressStore implements ProgressStore {
  readonly id = "local";
  readonly label = "This browser";

  constructor(private readonly storage: () => KeyValueStorage | undefined = () => globalThis.localStorage) {}

  load(): Progress {
    try {
      const raw = this.storage()?.getItem(STORAGE_KEY);
      return raw ? parseProgress(JSON.parse(raw)) : emptyProgress();
    } catch {
      // Unavailable or damaged storage: start fresh rather than break the page.
      return emptyProgress();
    }
  }

  save(progress: Progress): boolean {
    try {
      const storage = this.storage();
      if (!storage) return false;
      storage.setItem(STORAGE_KEY, JSON.stringify(progress));
      return true;
    } catch {
      return false;
    }
  }
}

registerProgressStore("local", () => new LocalStorageProgressStore());
