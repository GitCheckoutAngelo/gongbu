import type { Scheduler } from "./types";

// Kept separate from registry.ts so scheduler modules can import it without a circular import.
export const schedulers = new Map<string, Scheduler>();

/** Called at module load by each file in ./schedulers/. */
export function registerScheduler(scheduler: Scheduler): void {
  schedulers.set(scheduler.id, scheduler);
}
