/**
 * SM-2 (the algorithm classic Anki is based on), with four grades:
 * - again: forgotten. Start over (due today), ease −0.20.
 * - hard:  remembered with effort. Short step (×1.2), ease −0.15.
 * - good:  remembered. 1 day, then 6 days, then interval × ease.
 * - easy:  remembered instantly. Bigger step (× ease × 1.3), ease +0.15.
 */
import { addDays } from "../dates";
import { registerScheduler } from "../schedulerStore";
import type { CardState, Grade, Scheduler } from "../types";

export const START_EASE = 2.5;
export const MIN_EASE = 1.3;
const MAX_INTERVAL = 3650;

function nextInterval(prev: CardState, grade: Exclude<Grade, "again">): number {
  const { reps, interval, ease } = prev;
  const hard = reps === 0 ? 1 : Math.max(interval + 1, Math.round(interval * 1.2));
  const good = reps === 0 ? 1 : reps === 1 ? 6 : Math.max(hard + 1, Math.round(interval * ease));
  const easy = reps === 0 ? 4 : reps === 1 ? 8 : Math.max(good + 1, Math.round(interval * ease * 1.3));
  return Math.min(MAX_INTERVAL, { hard, good, easy }[grade]);
}

export const sm2: Scheduler = {
  id: "sm2",
  label: "SM-2",
  review(prev, grade, today) {
    const s: CardState = prev ?? {
      ease: START_EASE,
      interval: 0,
      reps: 0,
      lapses: 0,
      due: today,
      lastReviewed: today,
      streak: 0,
      everWrong: false,
    };
    if (grade === "again") {
      return {
        ...s,
        ease: Math.max(MIN_EASE, s.ease - 0.2),
        interval: 0,
        reps: 0,
        lapses: s.lapses + (s.reps > 0 ? 1 : 0),
        due: today,
        lastReviewed: today,
        streak: 0,
        everWrong: true,
      };
    }
    const interval = nextInterval(s, grade);
    const easeChange = grade === "hard" ? -0.15 : grade === "easy" ? 0.15 : 0;
    return {
      ...s,
      ease: Math.max(MIN_EASE, s.ease + easeChange),
      interval,
      reps: s.reps + 1,
      due: addDays(today, interval),
      lastReviewed: today,
      streak: s.streak + 1,
    };
  },
};

registerScheduler(sm2);
