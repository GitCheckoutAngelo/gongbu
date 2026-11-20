/**
 * Claude's generated words (out/enriched.json) with the hand review in corrections.json applied:
 * corrected fields replace Claude's, "pronounced": "" removes a pronunciation, and "exclude" holds a word back.
 */
import { readFileSync } from "node:fs";
import type { EnrichedWord } from "./enrich";

const OUT = "scripts/wordlist/out";
const corrections = JSON.parse(readFileSync("scripts/wordlist/corrections.json", "utf8")) as Record<
  string,
  Partial<EnrichedWord> & { exclude?: string }
>;

export function correctedWords(): EnrichedWord[] {
  const raw = JSON.parse(readFileSync(`${OUT}/enriched.json`, "utf8")) as Record<string, EnrichedWord>;
  return Object.values(raw)
    .filter((w) => !corrections[w.key]?.exclude)
    .map((w) => {
      const fix = corrections[w.key];
      if (!fix) return w;
      const merged = { ...w, ...fix };
      if (merged.pronounced === "") delete merged.pronounced;
      return merged;
    });
}
