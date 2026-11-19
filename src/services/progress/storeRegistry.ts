import type { ProgressStore } from "./types";

// Kept separate from registry.ts so store modules can import it without a circular import.
export const stores = new Map<string, () => ProgressStore>();

/** Called at module load by each file in ./stores/. */
export function registerProgressStore(id: string, create: () => ProgressStore): void {
  stores.set(id, create);
}
