/**
 * Today's Common Words numbers for the home page: cards due across all drills, and new words left
 * today in the default drill. Loaded on demand (it pulls in the word list).
 */
import { COMMON_WORDS } from "../../data/commonWords";
import { getProgressStore } from "../progress/registry";
import { localDate } from "./dates";
import { summarize } from "./session";
import { DRILL_MODES } from "./types";

export function wordsToday(): { due: number; fresh: number } {
  const progress = getProgressStore().load();
  const words = [...COMMON_WORDS, ...progress.addedWords];
  const today = localDate();
  const due = DRILL_MODES.reduce((n, m) => n + summarize(words, progress, m.id, today).due, 0);
  const fresh = summarize(words, progress, "read", today).newAvailable;
  return { due, fresh };
}
