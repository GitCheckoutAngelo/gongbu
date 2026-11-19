/**
 * Revised Romanization with pronunciation rules via the `koroman` package.
 * Chosen by scoring candidates against the 216 hand-checked words in src/data/words.ts:
 * koroman 211/216, versus 182/216 for the Python `korean-romanizer` package.
 */
import { romanize } from "koroman";
import { romanizerRegistry, type Romanizer } from "../types";

/** Remove Unicode punctuation and symbols (.,!?""「」~ etc.), keeping letters and digits. */
export function stripPunctuation(word: string): string {
  return word.replace(/[\p{P}\p{S}]/gu, "");
}

export class KoromanRomanizer implements Romanizer {
  romanizeWords(words: string[]): string[] {
    return words.map((word) => {
      const cleaned = stripPunctuation(word);
      return cleaned ? romanize(cleaned, { usePronunciationRules: true, casingOption: "lowercase" }) : "";
    });
  }
}

romanizerRegistry.register("koroman", () => new KoromanRomanizer());
