import { Registry } from "../../registry";

/** What a provider recognized: one entry per word it heard, with times in seconds. */
export interface RecognizedWord {
  word: string;
  start: number;
  end: number;
}

/**
 * Finds when each word is spoken in a recording (forced alignment). Returns one start time per word
 * of `words`, or null if it can't (the browser then keeps its own estimate).
 */
export interface WordAligner {
  align(mp3: Uint8Array, words: string[]): Promise<number[] | null>;
}

export const alignerRegistry = new Registry<WordAligner>("word aligner");
