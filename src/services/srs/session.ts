/**
 * Daily sessions over the word list: which cards are due, which new words to introduce, and how a
 * grade updates progress. Pure functions (no storage, no React), so they're easy to test.
 */
import type { CommonWord } from "../../data/vocabularyMeta";
import type { CategoryId } from "../../data/vocabularyMeta";
import type { Progress } from "../progress/types";
import type { CardState, DrillMode, Grade, Scheduler } from "./types";

export const cardKey = (wordId: string, mode: DrillMode) => `${wordId}|${mode}`;

/** Answered "again" at some point and not yet right twice in a row since. */
export const MISTAKE_CLEAR_STREAK = 2;
export function isMistake(card: CardState | undefined): boolean {
  return !!card && card.everWrong && card.streak < MISTAKE_CLEAR_STREAK;
}

export interface SessionOptions {
  mode: DrillMode;
  /** Only this category (undefined = all). */
  category?: CategoryId;
  /** Only words answered wrong recently, due or not (no new words). */
  mistakesOnly?: boolean;
  /** An extra batch of this many new words, beyond the daily limit (no reviews). */
  extraNew?: number;
  /** Re-drill the cards already reviewed today (practice: doesn't stretch their intervals). */
  reviewedToday?: boolean;
  today: string;
}

export interface SessionCard {
  word: CommonWord;
  isNew: boolean;
  /** Reviewed before it's due (mistakes drill): a correct answer doesn't stretch the interval. */
  early: boolean;
}

export function newCountToday(progress: Progress, mode: DrillMode, today: string): number {
  return progress.newToday.date === today ? (progress.newToday.counts[mode] ?? 0) : 0;
}

/**
 * The order new words are introduced: easier levels first, then the most-spoken words first (words with
 * no spoken rank keep their list order, after the ranked ones of the same level).
 */
export function introductionOrder(a: CommonWord, b: CommonWord): number {
  return a.level - b.level || (a.spokenRank ?? Infinity) - (b.spokenRank ?? Infinity) || 0;
}

/** Today's queue: due reviews (oldest first), then up to the daily number of new words. */
export function buildSession(words: CommonWord[], progress: Progress, opts: SessionOptions): SessionCard[] {
  const pool = opts.category ? words.filter((w) => w.category === opts.category) : words;
  const stateOf = (w: CommonWord) => progress.cards[cardKey(w.id, opts.mode)];

  if (opts.extraNew) {
    return pool
      .filter((w) => !stateOf(w))
      .sort(introductionOrder)
      .slice(0, opts.extraNew)
      .map((word) => ({ word, isNew: true, early: false }));
  }

  if (opts.reviewedToday) {
    return pool
      .filter((w) => stateOf(w)?.lastReviewed === opts.today)
      .map((word) => ({ word, isNew: false, early: stateOf(word)!.due > opts.today }));
  }

  if (opts.mistakesOnly) {
    return pool
      .filter((w) => isMistake(stateOf(w)))
      .sort((a, b) => stateOf(a)!.due.localeCompare(stateOf(b)!.due))
      .slice(0, progress.settings.maxReviews)
      .map((word) => ({ word, isNew: false, early: stateOf(word)!.due > opts.today }));
  }

  const due = pool
    .filter((w) => {
      const s = stateOf(w);
      return s && s.due <= opts.today;
    })
    .sort((a, b) => stateOf(a)!.due.localeCompare(stateOf(b)!.due))
    .slice(0, progress.settings.maxReviews)
    .map((word) => ({ word, isNew: false, early: false }));

  const newLeft = Math.max(0, progress.settings.newPerDay - newCountToday(progress, opts.mode, opts.today));
  const fresh = pool
    .filter((w) => !stateOf(w))
    .sort(introductionOrder)
    .slice(0, newLeft)
    .map((word) => ({ word, isNew: true, early: false }));

  return [...due, ...fresh];
}

/** Progress after answering one card. */
export function applyGrade(
  progress: Progress,
  card: SessionCard,
  mode: DrillMode,
  grade: Grade,
  today: string,
  scheduler: Scheduler,
): Progress {
  const key = cardKey(card.word.id, mode);
  const prev = progress.cards[key];
  let next: CardState;
  if (card.early && prev && grade !== "again") {
    // Practising a mistake before it's due: count the correct answer, keep the schedule.
    next = { ...prev, streak: prev.streak + 1, lastReviewed: today };
  } else {
    next = scheduler.review(prev, grade, today);
  }

  const newToday =
    prev === undefined
      ? {
          date: today,
          counts: {
            ...(progress.newToday.date === today ? progress.newToday.counts : {}),
            [mode]: newCountToday(progress, mode, today) + 1,
          },
        }
      : progress.newToday;

  return { ...progress, cards: { ...progress.cards, [key]: next }, newToday };
}

/** Where an "again" card goes back in the queue: a few cards later, so it's seen again this session. */
export const REQUEUE_GAP = 3;
export function requeue<T>(queue: T[], index: number, item: T): T[] {
  const at = Math.min(queue.length, index + 1 + REQUEUE_GAP);
  return [...queue.slice(0, at), item, ...queue.slice(at)];
}

export interface ModeSummary {
  due: number;
  newAvailable: number;
  mistakes: number;
  learned: number;
  /** Words never started (available for an extra batch). */
  unseen: number;
  reviewedToday: number;
}

export function summarize(
  words: CommonWord[],
  progress: Progress,
  mode: DrillMode,
  today: string,
  category?: CategoryId,
): ModeSummary {
  const pool = category ? words.filter((w) => w.category === category) : words;
  let due = 0;
  let unseen = 0;
  let mistakes = 0;
  let reviewedToday = 0;
  for (const w of pool) {
    const s = progress.cards[cardKey(w.id, mode)];
    if (!s) unseen++;
    else if (s.due <= today) due++;
    if (isMistake(s)) mistakes++;
    if (s?.lastReviewed === today) reviewedToday++;
  }
  const newLeft = Math.max(0, progress.settings.newPerDay - newCountToday(progress, mode, today));
  return {
    due: Math.min(due, progress.settings.maxReviews),
    newAvailable: Math.min(unseen, newLeft),
    mistakes,
    learned: pool.length - unseen,
    unseen,
    reviewedToday,
  };
}
