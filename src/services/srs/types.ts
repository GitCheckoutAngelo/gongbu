/** Spaced-repetition types. A scheduler only decides intervals; sessions and storage live elsewhere. */

/** The three drills. Each word has a separate schedule per mode (like forward/reverse cards). */
export type DrillMode = "read" | "recall" | "listen";
export const DRILL_MODES: { id: DrillMode; label: string; description: string }[] = [
  { id: "read", label: "Read → meaning", description: "See the Hangul, recall the meaning." },
  { id: "recall", label: "English → Korean", description: "See the English, recall the Korean word." },
  { id: "listen", label: "Listen → meaning", description: "Hear the word, recall the meaning." },
];

export type Grade = "again" | "hard" | "good" | "easy";
export const GRADES: Grade[] = ["again", "hard", "good", "easy"];

/** Review state of one card (one word in one mode). Dates are local "YYYY-MM-DD". */
export interface CardState {
  /** Ease factor (SM-2: starts at 2.5, never below 1.3). */
  ease: number;
  /** Days until the next review (0 = again today). */
  interval: number;
  /** Successful reviews in a row since the card was last forgotten. */
  reps: number;
  /** Times the card was forgotten after being learned. */
  lapses: number;
  due: string;
  lastReviewed: string;
  /** Correct answers in a row (for "my mistakes"). */
  streak: number;
  /** Ever answered "again". */
  everWrong: boolean;
}

export interface Scheduler {
  id: string;
  label: string;
  /** The next state after answering `grade` on `today`. `prev` is undefined for a new card. */
  review(prev: CardState | undefined, grade: Grade, today: string): CardState;
}
