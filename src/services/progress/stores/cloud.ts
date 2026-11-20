/**
 * Progress kept in this browser (as with the "local" store) and backed up online under this browser's
 * sync key. Every save is written locally at once and uploaded a moment later; the server merges
 * uploads, and newer progress from the server is merged back in (see mergeProgress). Works offline:
 * failed uploads are retried on the next save or visit.
 */
import { fetchCloudProgress, uploadCloudProgress } from "../../../api/client";
import { parseProgress } from "../backup";
import { mergeProgress, sameProgress } from "../merge";
import { registerProgressStore } from "../storeRegistry";
import type { Progress, ProgressStore } from "../types";
import { LocalStorageProgressStore } from "./localStorage";

const UPLOAD_DELAY_MS = 2000;

export class CloudProgressStore implements ProgressStore {
  readonly id = "cloud";
  readonly label = "this browser, backed up online";

  private readonly local = new LocalStorageProgressStore();
  private readonly listeners = new Set<(progress: Progress) => void>();
  private uploadTimer: ReturnType<typeof setTimeout> | undefined;
  private pulled = false;

  load(): Progress {
    return this.local.load();
  }

  save(progress: Progress): boolean {
    const ok = this.local.save(progress);
    clearTimeout(this.uploadTimer);
    this.uploadTimer = setTimeout(() => void this.upload(), UPLOAD_DELAY_MS);
    return ok;
  }

  subscribe(listener: (progress: Progress) => void): () => void {
    this.listeners.add(listener);
    if (!this.pulled) {
      this.pulled = true;
      void this.pull();
    }
    return () => this.listeners.delete(listener);
  }

  /** Take in progress from the server: merge, keep locally, and tell the page if anything changed. */
  private absorb(remote: Progress): Progress {
    const local = this.local.load();
    const merged = mergeProgress(local, remote);
    if (!sameProgress(merged, local)) {
      this.local.save(merged);
      this.listeners.forEach((l) => l(merged));
    }
    return merged;
  }

  private async pull(): Promise<void> {
    try {
      const raw = await fetchCloudProgress();
      const merged = raw ? this.absorb(parseProgress(raw)) : this.local.load();
      // Upload if this browser had something the server didn't.
      if (!raw || !sameProgress(merged, parseProgress(raw))) await this.upload();
    } catch {
      this.pulled = false; // offline or server trouble: try again next time
    }
  }

  private async upload(): Promise<void> {
    clearTimeout(this.uploadTimer);
    try {
      this.absorb(parseProgress(await uploadCloudProgress(this.local.load())));
    } catch {
      // Offline or server trouble: the next save (or visit) uploads again.
    }
  }
}

registerProgressStore("cloud", () => new CloudProgressStore());
