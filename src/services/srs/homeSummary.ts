/**
 * Today's Common Words numbers for the home page: cards due across all drills, and new words left
 * today in the default drill. Loaded on demand; it needs the word list from the server.
 */
import { getProgressStore } from "../progress/registry";
import { localDate } from "./dates";
import { summarize } from "./session";
import { DRILL_MODES } from "./types";
import { loadWords } from "../words/wordList";

export async function wordsToday(): Promise<{ due: number; fresh: number }> {
  const progress = getProgressStore().load();
  const words = [...(await loadWords()), ...progress.addedWords];
  const today = localDate();
  const due = DRILL_MODES.reduce((n, m) => n + summarize(words, progress, m.id, today).due, 0);
  const fresh = summarize(words, progress, "read", today).newAvailable;
  return { due, fresh };
}
