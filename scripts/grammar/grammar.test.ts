/** Checks on the grammar pattern list (data/grammarPatterns.json, loaded into the database). */
import { describe, expect, it } from "vitest";
import PATTERNS_JSON from "../../data/grammarPatterns.json";
import {
  GRAMMAR_GROUPS,
  POLITENESS_IDS,
  PRACTICE_SETTINGS,
  type GrammarPattern,
  type Scenario,
} from "../../src/data/grammarMeta";
import CONVERSATIONS_JSON from "../../data/grammarConversations.json";
import SCENARIOS_JSON from "../../data/scenarios.json";
import { conversationProblems, type LibraryConversation } from "./buildLibrary";
import { grammarProblems } from "./check";

const PATTERNS = PATTERNS_JSON as GrammarPattern[];
const SCENARIOS = SCENARIOS_JSON as Scenario[];
const CONVERSATIONS = CONVERSATIONS_JSON as unknown as LibraryConversation[];

describe("grammar patterns (data/grammarPatterns.json)", () => {
  it("covers TOPIK 1-4", () => {
    for (const level of [1, 2, 3, 4]) expect(PATTERNS.filter((p) => p.level === level).length).toBeGreaterThan(30);
  });

  it("has unique ids", () => {
    expect(new Set(PATTERNS.map((p) => p.id)).size).toBe(PATTERNS.length);
  });

  it("passes the card checks for every pattern", () => {
    expect(PATTERNS.flatMap((p) => grammarProblems(p).map((x) => `${p.id}: ${x}`))).toEqual([]);
  });

  it("only links similar patterns that exist", () => {
    const ids = new Set(PATTERNS.map((p) => p.id));
    expect(PATTERNS.flatMap((p) => p.similar.filter((s) => !ids.has(s)).map((s) => `${p.id} → ${s}`))).toEqual([]);
  });

  it("keeps merged variants' old ids as aliases, never clashing with an item's id", () => {
    const ids = new Set(PATTERNS.map((p) => p.id));
    const aliases = PATTERNS.flatMap((p) => p.aliases ?? []);
    expect(aliases.filter((a) => ids.has(a))).toEqual([]);
    expect(new Set(aliases).size).toBe(aliases.length);
  });

  it("has a realistic scenario library: every setting covered, valid levels and groups", () => {
    const groups = new Set<string>(GRAMMAR_GROUPS.map((g) => g.id));
    for (const setting of PRACTICE_SETTINGS) {
      expect(SCENARIOS.filter((s) => s.setting === setting.id).length, setting.id).toBeGreaterThanOrEqual(4);
    }
    for (const s of SCENARIOS) {
      expect(s.situation.length, s.id).toBeGreaterThan(20);
      expect(s.politeness.length, s.id).toBeGreaterThan(0);
      for (const l of s.politeness) expect(POLITENESS_IDS, s.id).toContain(l);
      for (const f of s.functions) expect(groups.has(f), `${s.id}: ${f}`).toBe(true);
    }
    expect(new Set(SCENARIOS.map((s) => s.id)).size).toBe(SCENARIOS.length);
  });

  it("has ready-made conversations that pass the checks, each at a level its pattern is used at", () => {
    const byId = new Map(PATTERNS.map((p) => [p.id, p]));
    const problems: string[] = [];
    for (const c of CONVERSATIONS) {
      problems.push(...conversationProblems(c).map((x) => `${c.id}: ${x}`));
      const pattern = byId.get(c.patternId);
      if (!pattern) problems.push(`${c.id}: unknown pattern`);
      else if (pattern.speechLevels && !pattern.speechLevels.includes(c.practice!.politeness)) {
        problems.push(`${c.id}: ${c.practice!.politeness} isn't a level ${pattern.id} is used at`);
      }
    }
    expect(problems).toEqual([]);
    expect(new Set(CONVERSATIONS.map((c) => c.id)).size).toBe(CONVERSATIONS.length);
  });
});
