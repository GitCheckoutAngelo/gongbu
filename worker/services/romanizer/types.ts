import { Registry } from "../../registry";

export interface Romanizer {
  /** One romanization per input word, in the same order. */
  romanizeWords(words: string[]): string[];
}

export const romanizerRegistry = new Registry<Romanizer>("romanizer");
