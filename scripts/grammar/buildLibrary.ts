/**
 * Turns the conversation drafts (out/conversations.json) into the ready-made library the Reader serves:
 * each conversation in the Reader's own shape (words with romanization and glosses, sentences with speakers,
 * the words that use the pattern, and the situation), checked, and written to:
 *
 *   data/grammarConversations.json     every conversation (committed; tested by grammar.test.ts)
 *   scripts/grammar/out/conversations.sql   the D1 "grammar_conversations" table's contents (replaces it)
 *
 *   npx vite-node --config vitest.config.ts scripts/grammar/buildLibrary.ts
 *   npx wrangler d1 execute gongbu --local  --file scripts/grammar/out/conversations.sql   (and --remote)
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { PRACTICE_SETTINGS, type GrammarPattern, type Scenario } from "../../src/data/grammarMeta";
import type { GenerateResponse } from "../../src/types";
import {
  alignGlosses,
  alignHighlights,
  alignSentences,
  cleanParagraph,
} from "../../worker/services/paragraph/providers/claude";
import { KoromanRomanizer } from "../../worker/services/romanizer/providers/koroman";
import type { DraftConversation } from "./buildConversations";

const OUT = "scripts/grammar/out";
const LIBRARY = "data/grammarConversations.json";

/** A ready-made conversation: the Reader's paragraph shape, plus its id and pattern. */
export interface LibraryConversation extends GenerateResponse {
  id: string;
  patternId: string;
}

/** Problems with one conversation (empty if none). */
export function conversationProblems(c: LibraryConversation): string[] {
  const problems: string[] = [];
  const sentences = c.sentences ?? [];
  if (sentences.length < 3 || sentences.length > 10) problems.push(`${sentences.length} lines`);
  if (sentences.some((s) => s.speaker !== "A" && s.speaker !== "B")) problems.push("a line without a speaker");
  if (!sentences.some((s) => s.speaker === "A") || !sentences.some((s) => s.speaker === "B")) {
    problems.push("only one speaker");
  }
  if ((c.highlights ?? []).length < 2) problems.push(`the pattern is used ${(c.highlights ?? []).length} time(s)`);
  if (!/[가-힣]/.test(c.paragraph)) problems.push("no Korean");
  const unglossed = c.words.filter((w) => !w.english).length;
  if (unglossed > Math.max(1, c.words.length * 0.1)) problems.push(`${unglossed} words without a gloss`);
  if (sentences.some((s) => !s.english)) problems.push("a line without a translation");
  return problems;
}

function main() {
  const patterns = JSON.parse(readFileSync("data/grammarPatterns.json", "utf8")) as (GrammarPattern & {
    key?: string;
    aliasKeys?: string[];
  })[];
  const scenarios = new Map(
    (JSON.parse(readFileSync("data/scenarios.json", "utf8")) as Scenario[]).map((s) => [s.id, s]),
  );
  const drafts = existsSync(`${OUT}/conversations.json`)
    ? (JSON.parse(readFileSync(`${OUT}/conversations.json`, "utf8")) as Record<string, DraftConversation[]>)
    : {};
  const romanizer = new KoromanRomanizer();

  const library: LibraryConversation[] = [];
  const problems: string[] = [];
  for (const full of patterns) {
    // The pattern as stored with a text (no build-only fields).
    const { key: _key, aliasKeys: _aliasKeys, ...pattern } = full;
    for (const [n, d] of (drafts[full.id] ?? []).entries()) {
      const scenario = scenarios.get(d.scenario);
      const paragraph = cleanParagraph(d.sentences.map((s) => s.korean).join(" "));
      const words = paragraph.split(/\s+/).filter(Boolean);
      const romanized = romanizer.romanizeWords(words);
      const glosses = alignGlosses(paragraph, d.words);
      const sentences = alignSentences(paragraph, d.sentences);
      const conversation: LibraryConversation = {
        id: `${full.id}#${n + 1}`,
        patternId: full.id,
        paragraph,
        translation: sentences.map((s) => s.english).join(" "),
        sentences,
        words: words.map((korean, i) => ({ korean, romanized: romanized[i] ?? "", english: glosses[i] ?? "" })),
        highlights: alignHighlights(paragraph, d.words),
        practice: {
          pattern: pattern as GrammarPattern,
          setting: PRACTICE_SETTINGS.find((s) => s.id === scenario?.setting)?.label ?? "",
          ...(scenario && { scene: scenario.situation, roles: scenario.roles }),
          politeness: d.politeness,
          format: "dialogue",
        },
      };
      const issues = conversationProblems(conversation);
      if (!scenario) issues.push(`unknown scenario ${d.scenario}`);
      if (issues.length) problems.push(`${conversation.id}: ${issues.join("; ")}`);
      else library.push(conversation);
    }
  }

  writeFileSync(LIBRARY, "[\n" + library.map((c) => JSON.stringify(c)).join(",\n") + "\n]\n");
  const q = (v: unknown) =>
    v === undefined || v === null ? "NULL" : typeof v === "number" ? String(v) : `'${String(v).replace(/'/g, "''")}'`;
  const sql = [
    "DELETE FROM grammar_conversations;",
    ...library.map(
      (c, i) =>
        "INSERT INTO grammar_conversations (id, pattern_id, politeness, data, sort) VALUES (" +
        [c.id, c.patternId, c.practice!.politeness, JSON.stringify(c), i].map(q).join(", ") +
        ");",
    ),
  ];
  writeFileSync(`${OUT}/conversations.sql`, sql.join("\n") + "\n");

  const covered = new Set(library.map((c) => c.patternId)).size;
  console.log(`${library.length} conversations for ${covered} of ${patterns.length} patterns -> ${LIBRARY}`);
  if (problems.length) console.log(`${problems.length} left out:\n  ` + problems.join("\n  "));
}

// Run only as a script (the grammar test imports conversationProblems).
if (!process.env.VITEST) main();
