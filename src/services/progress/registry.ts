import { config } from "../../config";
import { stores } from "./storeRegistry";
import type { ProgressStore } from "./types";

// Auto-discover every store file (same pattern as the TTS providers); each calls registerProgressStore().
import.meta.glob(["./stores/*.ts", "!./stores/*.test.ts"], { eager: true });

let instance: ProgressStore | undefined;

/** The configured store (VITE_PROGRESS_STORE, default "local"). */
export function getProgressStore(): ProgressStore {
  if (!instance) {
    const create = stores.get(config.progressStore) ?? stores.get("local");
    if (!create) throw new Error(`Unknown progress store "${config.progressStore}"`);
    instance = create();
  }
  return instance;
}
