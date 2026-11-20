/**
 * Romanization for the Common Words list: `koroman` (the same library as the Worker's romanizer), plus
 * hand-checked fixes where it disagrees with Revised Romanization. buildSeed.ts writes it into
 * data/wordSeed.json, and the word-list test checks it's up to date.
 */
import { romanize } from "koroman";

/** Revised Romanization fixes, each checked by hand. */
export const ROMANIZATION_OVERRIDES: Record<string, string> = {
  // koroman inserts a ㄴ sound that standard pronunciation doesn't have
  월요일: "woryoil",
  목요일: "mogyoil",
  일요일: "iryoil",
  필요하다: "piryohada",
  // koroman doesn't aspirate ㅅ + ㅎ (RR writes the aspiration in verbs/adjectives)
  따뜻하다: "ttatteutada",
  깨끗하다: "kkaekkeutada",
  // koroman links ㅅ straight into 없 (maseopda); standard [마덥따]
  맛없다: "madeopda",
  // RR keeps ㅎ after ㄱ/ㄷ/ㅂ in nouns (koroman aspirates them)
  입학: "iphak",
  백화점: "baekhwajeom",
};

export function romanizeWord(spelling: string): string {
  return (
    ROMANIZATION_OVERRIDES[spelling] ?? romanize(spelling, { usePronunciationRules: true, casingOption: "lowercase" })
  );
}
