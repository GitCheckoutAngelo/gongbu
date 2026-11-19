import type { CommonWord } from "../../data/commonWords";
import type { CardState, DrillMode } from "../srs/types";

export interface ProgressSettings {
  /** New words introduced per day, per drill mode. */
  newPerDay: number;
  /** Most reviews in one session (the rest stay due). */
  maxReviews: number;
}

export interface Progress {
  version: 1;
  /** Keyed by cardKey(wordId, mode). */
  cards: Record<string, CardState>;
  /** How many new cards were started today, per mode (resets when the date changes). */
  newToday: { date: string; counts: Partial<Record<DrillMode, number>> };
  settings: ProgressSettings;
  /** Words the learner approved from "Add words". */
  addedWords: CommonWord[];
}

export const DEFAULT_SETTINGS: ProgressSettings = { newPerDay: 10, maxReviews: 200 };

export function emptyProgress(): Progress {
  return { version: 1, cards: {}, newToday: { date: "", counts: {} }, settings: { ...DEFAULT_SETTINGS }, addedWords: [] };
}

/** Where progress is kept. Swap the implementation in ./stores/ (VITE_PROGRESS_STORE). */
export interface ProgressStore {
  id: string;
  label: string;
  load(): Progress;
  /** Returns false if saving failed (e.g. storage blocked), so the UI can warn. */
  save(progress: Progress): boolean;
}
