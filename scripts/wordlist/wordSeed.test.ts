/**
 * Checks on the Common Words list (data/wordSeed.json: the one source of every word, loaded into the
 * database). The words are memorized, so the tests try hard to catch a wrong or missing pronunciation
 * (the pronunciation checks themselves are in src/data/pronunciationCheck.ts), plus structure: unique
 * ids, one answer per English → Korean card, valid links, agreement with the reference pages' example
 * words, and up-to-date romanization.
 */
import { describe, expect, it } from "vitest";
import SEED_JSON from "../../data/wordSeed.json";
import { EXAMPLE_WORDS } from "../../src/data/exampleWords";
import { mainSense, pronunciationProblems } from "../../src/data/pronunciationCheck";
import { RULES } from "../../src/data/rules";
import type { RuleId } from "../../src/data/types";
import {
  CATEGORY_IDS,
  LETTER_NOTE_IDS,
  PART_OF_SPEECH_IDS,
  REGISTER_IDS,
  RULE_IDS_FOR_WORDS,
} from "../../src/data/vocabularyMeta";
import { romanizeWord } from "./romanize";

interface SeedWord {
  id: string;
  spelling: string;
  meaning: string;
  pos: string;
  category: string;
  level: number;
  romanization: string;
  pronounced?: string;
  rules?: string[];
  letters?: string[];
  register: string;
  spokenRank?: number;
  origin: string;
}

const SEED = SEED_JSON as SeedWord[];

describe("Common Words list (data/wordSeed.json)", () => {
  it("has the hand-written words and the generated ones", () => {
    expect(SEED.filter((w) => w.origin === "hand").length).toBeGreaterThanOrEqual(600);
    expect(SEED.every((w) => w.origin === "hand" || w.origin === "nikl")).toBe(true);
  });

  it("has unique ids, and a spelling with several senses has explicit ids", () => {
    expect(new Set(SEED.map((w) => w.id)).size).toBe(SEED.length);
    const count = new Map<string, number>();
    for (const w of SEED) count.set(w.spelling, (count.get(w.spelling) ?? 0) + 1);
    for (const w of SEED) if (count.get(w.spelling)! > 1) expect(w.id, w.spelling).not.toBe(w.spelling);
  });

  it("has one answer per English → Korean card", () => {
    const seen = new Map<string, string>();
    for (const w of SEED) {
      const key = w.meaning.toLowerCase();
      expect(seen.get(key), `"${w.meaning}": ${seen.get(key)} and ${w.id}`).toBeUndefined();
      seen.set(key, w.id);
    }
    // Same main sense and part of speech, and no hint to tell them apart: ambiguous.
    const problems: string[] = [];
    for (const a of SEED.filter((w) => w.origin !== "hand" && !w.meaning.includes("("))) {
      const b = SEED.find((o) => o !== a && o.pos === a.pos && mainSense(o.meaning) === mainSense(a.meaning));
      if (b) problems.push(`${a.id} "${a.meaning}" vs ${b.id} "${b.meaning}"`);
    }
    expect(problems).toEqual([]);
  });

  it("uses valid categories, parts of speech, levels, registers, rule and letter ids", () => {
    const ruleIds = new Set<string>(RULES.map((r) => r.id));
    for (const w of SEED) {
      expect(CATEGORY_IDS, w.id).toContain(w.category);
      expect(PART_OF_SPEECH_IDS, w.id).toContain(w.pos);
      expect(REGISTER_IDS, w.id).toContain(w.register);
      // The hand-written words are TOPIK I (1급–2급).
      expect(w.origin === "hand" ? [1, 2] : [1, 2, 3, 4, 5, 6], w.id).toContain(w.level);
      for (const r of w.rules ?? []) expect(ruleIds.has(r), `${w.id}: ${r}`).toBe(true);
      for (const l of w.letters ?? []) expect(LETTER_NOTE_IDS as string[], w.id).toContain(l);
      expect(w.spelling, w.id).toMatch(/^[가-힣]+( [가-힣]+)*$/);
    }
  });

  it("passes the pronunciation checks for every word", () => {
    expect(SEED.flatMap((w) => pronunciationProblems(w).map((p) => `${w.id}: ${p}`))).toEqual([]);
  });

  it("matches the reference pages' example words wherever a word appears in both", () => {
    const problems: string[] = [];
    for (const w of SEED) {
      const other = (EXAMPLE_WORDS as Record<string, { pronounced?: string; romanization: string }>)[w.spelling];
      if (!other) continue;
      if ((other.pronounced ?? "") !== (w.pronounced ?? "")) {
        problems.push(`${w.id}: pronounced [${w.pronounced ?? ""}] vs exampleWords.ts [${other.pronounced ?? ""}]`);
      }
      if (other.romanization.toLowerCase() !== w.romanization.toLowerCase()) {
        problems.push(`${w.id}: ${w.romanization} vs exampleWords.ts ${other.romanization}`);
      }
    }
    expect(problems).toEqual([]);
  });

  it("has up-to-date romanization (rebuild with scripts/wordlist/buildSeed.ts)", () => {
    for (const w of SEED) expect(w.romanization, w.id).toBe(romanizeWord(w.spelling));
  });

  it("shares its rule ids with the Rules page", () => {
    expect([...RULE_IDS_FOR_WORDS].sort()).toEqual(RULES.map((r) => r.id as RuleId).sort());
  });
});
