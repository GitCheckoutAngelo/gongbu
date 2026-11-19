import { config } from "../../config";
import { schedulers } from "./schedulerStore";
import type { Scheduler } from "./types";

// Auto-discover every scheduler file (same pattern as the TTS providers); each calls registerScheduler().
import.meta.glob(["./schedulers/*.ts", "!./schedulers/*.test.ts"], { eager: true });

export function listSchedulers(): Scheduler[] {
  return [...schedulers.values()];
}

/** The configured scheduler (VITE_SRS_SCHEDULER, default "sm2"). */
export function getScheduler(id: string = config.srsScheduler): Scheduler {
  const s = schedulers.get(id) ?? schedulers.get("sm2");
  if (!s) throw new Error(`Unknown scheduler "${id}"`);
  return s;
}
