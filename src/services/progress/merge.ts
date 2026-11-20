/**
 * Combine two copies of Common Words progress (e.g. this browser's and the cloud's), so reviews made
 * on different devices are all kept. Used by the browser when it syncs and by the server when it saves.
 *
 * - Cards: per card, the more recent review wins (then the later due date, then more reps).
 * - Added words: everything from both (by id).
 * - Settings: whichever was changed more recently.
 * - New cards started today: the higher count per mode, for the later date.
 */
import type { CardState } from "../srs/types";
import type { Progress } from "./types";

function newerCard(a: CardState, b: CardState): CardState {
  if (a.lastReviewed !== b.lastReviewed) return a.lastReviewed > b.lastReviewed ? a : b;
  if (a.due !== b.due) return a.due > b.due ? a : b;
  return b.reps > a.reps ? b : a;
}

export function mergeProgress(a: Progress, b: Progress): Progress {
  const cards: Progress["cards"] = { ...a.cards };
  for (const [key, card] of Object.entries(b.cards)) {
    cards[key] = cards[key] ? newerCard(cards[key], card) : card;
  }

  const seen = new Set(a.addedWords.map((w) => w.id));
  const addedWords = [...a.addedWords, ...b.addedWords.filter((w) => !seen.has(w.id))];

  const aAt = a.settingsChangedAt ?? 0;
  const bAt = b.settingsChangedAt ?? 0;
  const settingsFrom = bAt > aAt ? b : a;

  let newToday = a.newToday;
  if (b.newToday.date > a.newToday.date) newToday = b.newToday;
  else if (b.newToday.date === a.newToday.date) {
    const counts = { ...a.newToday.counts };
    for (const [mode, n] of Object.entries(b.newToday.counts) as [keyof typeof counts, number][]) {
      counts[mode] = Math.max(counts[mode] ?? 0, n);
    }
    newToday = { date: a.newToday.date, counts };
  }

  return {
    version: 1,
    cards,
    newToday,
    settings: { ...settingsFrom.settings },
    ...(Math.max(aAt, bAt) > 0 && { settingsChangedAt: Math.max(aAt, bAt) }),
    addedWords,
  };
}

/** True if the two copies hold the same data. */
export function sameProgress(a: Progress, b: Progress): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
