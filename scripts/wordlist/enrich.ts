/**
 * Enrich new words with Claude: meaning, part of speech, TOPIK level, pronunciation, rule links,
 * category, register (casual / neutral / formal) and a usage note. Words are taken from
 * out/candidates.json (see merge_candidates.py), most-spoken first, skipping words the app already has
 * and words already enriched (so it can be stopped and resumed).
 *
 * Every reply is checked with the same validation as the app's "Add words" (validateSuggestion), plus
 * the requested spelling, category and register. Anything that fails is listed in out/flagged.json for
 * review instead of being kept. The run prints the tokens used and what they cost.
 *
 *   npx vite-node --config vitest.config.ts scripts/wordlist/enrich.ts -- --limit 20
 *
 * Needs ANTHROPIC_API_KEY (from the environment, or .dev.vars). Billed to that Anthropic account.
 */
import Anthropic from "@anthropic-ai/sdk";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import {
  CATEGORIES,
  CATEGORY_IDS,
  LETTER_NOTES,
  LETTER_NOTE_IDS,
  LEVEL_BANDS,
  PARTS_OF_SPEECH,
  PART_OF_SPEECH_IDS,
  RULE_IDS_FOR_WORDS,
  RULE_SUMMARIES,
  type CategoryId,
  type LevelBand,
} from "../../src/data/vocabularyMeta";
import { SYSTEM_PROMPT as SUGGEST_RULES } from "../../worker/services/wordSuggester/providers/claude";
import { validateSuggestion } from "../../worker/services/wordSuggester/validate";

const OUT = "scripts/wordlist/out";
const MODEL = "claude-sonnet-5-5";
const PRICE_PER_MTOK = { input: 2, output: 10 }; // Claude Sonnet 5.5, USD
const BATCH = 20;
export const REGISTERS = ["casual", "neutral", "formal"] as const;
export type Register = (typeof REGISTERS)[number];

interface Candidate {
  spelling: string;
  homograph: number | null;
  pos: string;
  niklPos: string;
  gloss: string;
  grade: "A" | "B" | "C";
  band: LevelBand;
  writtenRank: number | null;
  spokenCount: number;
  spokenRank: number | null;
  spokenShared: boolean;
  builtIn: boolean;
}

export interface EnrichedWord {
  key: string;
  spelling: string;
  meaning: string;
  pos: string;
  level: number;
  category: CategoryId;
  register: Register;
  pronounced?: string;
  rules: string[];
  letters: string[];
  note?: string;
  source: { nikl: string; grade: string; gloss: string; spokenRank: number | null; spokenShared: boolean };
  model: string;
}

const keyOf = (c: Candidate) => `${c.spelling}|${c.homograph ?? ""}|${c.niklPos}`;

function apiKey(): string {
  if (process.env.ANTHROPIC_API_KEY) return process.env.ANTHROPIC_API_KEY;
  const vars = existsSync(".dev.vars") ? readFileSync(".dev.vars", "utf8") : "";
  const key = /^ANTHROPIC_API_KEY=(.+)$/m.exec(vars)?.[1]?.trim();
  if (!key) throw new Error("Set ANTHROPIC_API_KEY (or add it to .dev.vars).");
  return key;
}

/**
 * New words in speaking order, one card per sense:
 * - a rarer homograph (grade C) is skipped when a commoner sense of the same spelling exists;
 * - the list's separate "auxiliary" entry (않다, 말다 after -지) is skipped when the main verb is there;
 * - entries with the same spelling and the same sense hint (거 as pronoun and as bound noun, both "것")
 *   are one card.
 */
export function queue(candidates: Candidate[]): Candidate[] {
  const best = new Map<string, string>();
  const nonAux = new Set<string>();
  for (const c of candidates) {
    const k = `${c.spelling}|${c.pos}`;
    const g = best.get(k);
    if (!g || c.grade < g) best.set(k, c.grade);
    if (c.niklPos !== "보") nonAux.add(c.spelling);
  }
  const seenSense = new Set<string>();
  return candidates.filter((c) => {
    if (c.builtIn || c.spokenCount === 0 || c.niklPos === "고") return false; // 고 = place names
    if (c.grade === "C" && best.get(`${c.spelling}|${c.pos}`)! < "C") return false;
    if (c.niklPos === "보" && nonAux.has(c.spelling)) return false;
    const sense = `${c.spelling}|${c.gloss.trim()}`;
    if (seenSense.has(sense)) return false;
    seenSense.add(sense);
    return true;
  });
}

const SYSTEM = [
  "You write flashcard entries for specific Korean words a learner has been given.",
  SUGGEST_RULES.split("\n")
    .filter((l) => !l.startsWith("You suggest") && !l.startsWith("Suggest only"))
    .join("\n"),
  "Also, for every word:",
  "- category: the single best-fitting category id. Grammar-like words (bound nouns, auxiliaries) go to the",
  "  closest one (e.g. adverbs, expressions) and the note says how they are used.",
  "- register: casual (mainly heard in casual speech: contractions such as 걔/그거, slang, 반말-only words),",
  "  formal (mainly written or formal speech: 및, 따라서), otherwise neutral.",
  '- note: one short line a learner would want (how it\'s used, a common pattern, politeness), or "".',
  "  Put any uncertainty in the note too.",
  "- Keep the given spelling exactly. The sense hint (hanja or example from the 국립국어원 list) says which",
  "  meaning is meant when a spelling has several.",
  "Return one entry per given word, in the same order.",
].join("\n");

const FORMAT = {
  type: "json_schema",
  schema: {
    type: "object",
    properties: {
      words: {
        type: "array",
        items: {
          type: "object",
          properties: {
            spelling: { type: "string" },
            meaning: { type: "string" },
            pos: { type: "string", enum: PART_OF_SPEECH_IDS },
            level: { type: "integer", enum: [1, 2, 3, 4, 5, 6] },
            category: { type: "string", enum: CATEGORY_IDS },
            register: { type: "string", enum: REGISTERS },
            pronounced: { type: "string" },
            rules: { type: "array", items: { type: "string", enum: RULE_IDS_FOR_WORDS } },
            letters: { type: "array", items: { type: "string", enum: LETTER_NOTE_IDS } },
            note: { type: "string" },
          },
          required: [
            "spelling",
            "meaning",
            "pos",
            "level",
            "category",
            "register",
            "pronounced",
            "rules",
            "letters",
            "note",
          ],
          additionalProperties: false,
        },
      },
    },
    required: ["words"],
    additionalProperties: false,
  },
} as const;

const NIKL_POS: Record<string, string> = {
  명: "noun",
  의: "bound noun",
  대: "pronoun",
  수: "numeral",
  동: "verb",
  형: "adjective",
  보: "auxiliary verb/adjective",
  부: "adverb",
  관: "determiner",
  감: "interjection",
  불: "contraction",
};

function prompt(batch: Candidate[]): string {
  return [
    "Words (spelling | part of speech | sense hint | level band):",
    ...batch.map((c, i) => {
      const band = LEVEL_BANDS.find((b) => b.id === c.band)!;
      return `${i + 1}. ${c.spelling} | ${NIKL_POS[c.niklPos] ?? c.niklPos} | ${c.gloss || "-"} | ${band.label} (TOPIK ${band.levels.join("-")})`;
    }),
    "",
    "Parts of speech: " + PARTS_OF_SPEECH.map((p) => `${p.id} (${p.label})`).join(", "),
    "Categories: " + CATEGORIES.map((c) => `${c.id} (${c.label})`).join(", "),
    "Rule ids: " + RULE_IDS_FOR_WORDS.map((id) => `${id} = ${RULE_SUMMARIES[id]}`).join("; "),
    "Letter note ids: " + LETTER_NOTE_IDS.map((id) => `${id} = ${LETTER_NOTES[id].summary}`).join("; "),
  ].join("\n");
}

function load<T>(file: string, fallback: T): T {
  return existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as T) : fallback;
}

async function main() {
  const limitArg = process.argv.indexOf("--limit");
  const limit = limitArg > 0 ? Number(process.argv[limitArg + 1]) : BATCH;
  const candidates = load<Candidate[]>(`${OUT}/candidates.json`, []);
  const enriched = load<Record<string, EnrichedWord>>(`${OUT}/enriched.json`, {});
  const flagged = load<Record<string, { candidate: Candidate; reason: string; raw?: unknown }>>(
    `${OUT}/flagged.json`,
    {},
  );
  const todo = queue(candidates)
    .filter((c) => !enriched[keyOf(c)] && !flagged[keyOf(c)])
    .slice(0, limit);
  if (!todo.length) return console.log("Nothing left to enrich.");

  const client = new Anthropic({ apiKey: apiKey() });
  const usage = { input: 0, output: 0 };
  for (let i = 0; i < todo.length; i += BATCH) {
    const batch = todo.slice(i, i + BATCH);
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      system: SYSTEM,
      output_config: { effort: "medium", format: FORMAT },
      // If a request is ever declined, the API retries it on a fallback model it chooses.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      messages: [{ role: "user", content: prompt(batch) }],
    });
    usage.input += response.usage.input_tokens;
    usage.output += response.usage.output_tokens;
    if (response.stop_reason === "refusal" || response.stop_reason === "max_tokens") {
      for (const c of batch) flagged[keyOf(c)] = { candidate: c, reason: `stopped: ${response.stop_reason}` };
      continue;
    }
    const text = response.content.map((b) => (b.type === "text" ? b.text : "")).join("");
    const words = (JSON.parse(text) as { words: Record<string, unknown>[] }).words;
    batch.forEach((c, n) => {
      const raw = words[n];
      const valid = validateSuggestion(raw, c.band);
      const reason = !raw
        ? "missing from reply"
        : !valid
          ? "failed validation"
          : valid.spelling !== c.spelling
            ? `spelling changed to ${valid.spelling}`
            : !(CATEGORY_IDS as unknown[]).includes(raw.category)
              ? "bad category"
              : !(REGISTERS as readonly unknown[]).includes(raw.register)
                ? "bad register"
                : null;
      if (reason || !valid) {
        flagged[keyOf(c)] = { candidate: c, reason: reason ?? "invalid", raw };
        return;
      }
      enriched[keyOf(c)] = {
        key: keyOf(c),
        ...valid,
        category: raw.category as CategoryId,
        register: raw.register as Register,
        source: {
          nikl: c.niklPos,
          grade: c.grade,
          gloss: c.gloss,
          spokenRank: c.spokenRank,
          spokenShared: c.spokenShared,
        },
        model: response.model,
      };
    });
    writeFileSync(`${OUT}/enriched.json`, JSON.stringify(enriched, null, 1));
    writeFileSync(`${OUT}/flagged.json`, JSON.stringify(flagged, null, 1));
    const cost = (usage.input * PRICE_PER_MTOK.input + usage.output * PRICE_PER_MTOK.output) / 1e6;
    console.log(
      `batch ${i / BATCH + 1}: ${batch.length} words. So far ${usage.input} in / ${usage.output} out tokens = $${cost.toFixed(3)}`,
    );
  }
  const cost = (usage.input * PRICE_PER_MTOK.input + usage.output * PRICE_PER_MTOK.output) / 1e6;
  console.log(
    `Done: ${Object.keys(enriched).length} enriched in total, ${Object.keys(flagged).length} flagged. ` +
      `This run: $${cost.toFixed(3)} ($${((cost / todo.length) * 1000).toFixed(2)} per 1,000 words).`,
  );
}

if (!process.env.WORDLIST_NO_MAIN) void main();
