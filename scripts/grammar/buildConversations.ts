/**
 * Writes the ready-made conversation library for grammar practice: for each pattern, about four short
 * conversations, each in a real situation from data/scenarios.json where that pattern naturally comes up,
 * together covering the speech levels the pattern is used at. Claude writes only the dialogue (with
 * translations and word glosses); the situation is fixed, so it stays realistic.
 *
 *   GRAMMAR_LIMIT=5 npx vite-node --config vitest.config.ts scripts/grammar/buildConversations.ts   (a trial)
 *   npx vite-node --config vitest.config.ts scripts/grammar/buildConversations.ts                   (the rest)
 *
 * Resumable: patterns already written are skipped (out/conversations.json). Prints the cost.
 * Then scripts/grammar/buildLibrary.ts checks them and writes the database file.
 */
import Anthropic from "@anthropic-ai/sdk";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import {
  POLITENESS,
  POLITENESS_IDS,
  PRACTICE_SETTINGS,
  type GrammarPattern,
  type Politeness,
  type Scenario,
} from "../../src/data/grammarMeta";

const OUT = "scripts/grammar/out";
const MODEL = process.env.GRAMMAR_MODEL ?? "claude-sonnet-5-5";
const PER_PATTERN = 4;
const PARALLEL = 4;

export interface DraftConversation {
  scenario: string;
  politeness: Politeness;
  sentences: { korean: string; english: string; speaker: "A" | "B" }[];
  words: { word: string; english: string; pattern: boolean }[];
}

function apiKey(): string {
  if (process.env.ANTHROPIC_API_KEY) return process.env.ANTHROPIC_API_KEY;
  const vars = existsSync(".dev.vars") ? readFileSync(".dev.vars", "utf8") : "";
  const key = /^ANTHROPIC_API_KEY=(.+)$/m.exec(vars)?.[1]?.trim();
  if (!key) throw new Error("Set ANTHROPIC_API_KEY (or add it to .dev.vars).");
  return key;
}

/** A small stable hash, so each pattern gets the same situations on every run. */
const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

/**
 * Four situations for a pattern: ones whose kind of talk matches the pattern's group first, at speech levels
 * the pattern is used at, each level covered where possible, all from different settings.
 */
export function pickScenarios(pattern: GrammarPattern, scenarios: Scenario[]): { s: Scenario; level: Politeness }[] {
  const allowed = pattern.speechLevels ?? POLITENESS_IDS;
  const usable = scenarios.filter((s) => s.politeness.some((p) => allowed.includes(p)));
  const ranked = [...usable].sort(
    (a, b) =>
      Number(b.functions.includes(pattern.group)) - Number(a.functions.includes(pattern.group)) ||
      hash(pattern.id + a.id) - hash(pattern.id + b.id),
  );
  const picked: { s: Scenario; level: Politeness }[] = [];
  const settings = new Set<string>();
  // One per allowed level first (polite, casual, formal), then the best remaining.
  const order = (["polite", "casual", "formal"] as Politeness[]).filter((l) => allowed.includes(l));
  for (const level of order) {
    const s = ranked.find((x) => x.politeness.includes(level) && !settings.has(x.setting));
    if (s) {
      picked.push({ s, level });
      settings.add(s.setting);
    }
  }
  for (const s of ranked) {
    if (picked.length >= PER_PATTERN) break;
    if (settings.has(s.setting) || picked.some((p) => p.s.id === s.id)) continue;
    const level = s.politeness.find((p) => allowed.includes(p))!;
    picked.push({ s, level });
    settings.add(s.setting);
  }
  return picked.slice(0, PER_PATTERN);
}

const LEVEL_TEXT: Record<Politeness, string> = {
  casual: "casual 반말",
  polite: "polite 해요체",
  formal: "formal 합쇼체",
};

const SYSTEM = [
  "You write short Korean conversations for learners practising one grammar pattern. Each conversation is a",
  "real moment between two people, A and B, in the situation given: natural, the way Korean speakers really",
  "talk there, with a reason to talk, replies that answer, and a small outcome. 3-6 lines in all.",
  "- Use the grammar pattern (or one of its listed variants) at least twice in each conversation, only where",
  "  a native speaker naturally would; never force it.",
  "- Write every line at the speech level given, adapting the pattern's ending to it (the pattern is shown in",
  "  its textbook polite form: at casual level -(으)ㄹ까요? becomes -(으)ㄹ까?, -아/어 주세요 becomes -아/어 줘;",
  "  at formal level use 합쇼체). If one speaker would naturally use a different level (a grandmother to a",
  "  grandchild), that's fine; follow the situation.",
  "- Vocabulary at the pattern's level (TOPIK 1-2 beginner, 3-4 intermediate). Correct, standard Korean spacing.",
  "- For each line: the Korean, a faithful English translation, and the speaker (A or B).",
  "- words: every space-separated word of the whole conversation, in order, exactly as written (punctuation",
  "  included), each with a short English gloss in context and pattern: true if it contains the practised",
  "  pattern (or a variant).",
].join("\n");

const FORMAT = {
  type: "json_schema",
  schema: {
    type: "object",
    properties: {
      conversations: {
        type: "array",
        items: {
          type: "object",
          properties: {
            number: { type: "integer" },
            sentences: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  korean: { type: "string" },
                  english: { type: "string" },
                  speaker: { type: "string", enum: ["A", "B"] },
                },
                required: ["korean", "english", "speaker"],
                additionalProperties: false,
              },
            },
            words: {
              type: "array",
              items: {
                type: "object",
                properties: { word: { type: "string" }, english: { type: "string" }, pattern: { type: "boolean" } },
                required: ["word", "english", "pattern"],
                additionalProperties: false,
              },
            },
          },
          required: ["number", "sentences", "words"],
          additionalProperties: false,
        },
      },
    },
    required: ["conversations"],
    additionalProperties: false,
  },
} as const;

async function main() {
  const patterns = JSON.parse(readFileSync("data/grammarPatterns.json", "utf8")) as GrammarPattern[];
  const scenarios = JSON.parse(readFileSync("data/scenarios.json", "utf8")) as Scenario[];
  const file = process.env.GRAMMAR_OUT ?? `${OUT}/conversations.json`;
  const done: Record<string, DraftConversation[]> = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : {};
  const limit = Number(process.env.GRAMMAR_LIMIT) || Infinity;
  const todo = patterns.filter((p) => !done[p.id]).slice(0, limit);
  const client = new Anthropic({ apiKey: apiKey() });
  const usage = { input: 0, output: 0 };
  const [pin, pout] = MODEL.includes("haiku") ? [0.1, 0.5] : [2, 10];
  const cost = () => (usage.input * pin + usage.output * pout) / 1e6;

  const write = async (pattern: GrammarPattern) => {
    const picks = pickScenarios(pattern, scenarios);
    const levelName = (l: Politeness) => POLITENESS.find((p) => p.id === l)!.label;
    const prompt = [
      `Grammar pattern: ${pattern.form} (${pattern.title}; ${pattern.meaning}). TOPIK level ${pattern.level}.`,
      `How it attaches: ${pattern.attaches}`,
      pattern.variants?.length ? `Variants that also count: ${pattern.variants.map((v) => v.form).join(", ")}.` : "",
      "",
      `Write ${picks.length} conversations, one per situation:`,
      ...picks.map(
        ({ s, level }, n) =>
          `${n + 1}. ${PRACTICE_SETTINGS.find((x) => x.id === s.setting)?.label}: ${s.situation} ` +
          `A is the ${s.roles.A}, B is the ${s.roles.B}. Speech level: ${LEVEL_TEXT[level]} (${levelName(level)}).`,
      ),
    ]
      .filter(Boolean)
      .join("\n");
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      system: SYSTEM,
      output_config: { effort: "medium", format: FORMAT },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      messages: [{ role: "user", content: prompt }],
    });
    usage.input += response.usage.input_tokens;
    usage.output += response.usage.output_tokens;
    if (response.stop_reason !== "end_turn") throw new Error(`${pattern.id}: stopped (${response.stop_reason})`);
    const text = response.content.map((b) => (b.type === "text" ? b.text : "")).join("");
    const list = (JSON.parse(text) as { conversations: (Omit<DraftConversation, "scenario" | "politeness"> & { number: number })[] })
      .conversations;
    done[pattern.id] = list.flatMap(({ number, ...c }) => {
      const pick = picks[number - 1];
      return pick ? [{ ...c, scenario: pick.s.id, politeness: pick.level }] : [];
    });
  };

  mkdirSync(OUT, { recursive: true });
  for (let i = 0; i < todo.length; i += PARALLEL) {
    const batch = todo.slice(i, i + PARALLEL);
    const results = await Promise.allSettled(batch.map(write));
    results.forEach((r, n) => r.status === "rejected" && console.warn(`  ${batch[n].id}: ${r.reason}`));
    writeFileSync(file, JSON.stringify(done, null, 1));
    console.log(`${Math.min(i + PARALLEL, todo.length)}/${todo.length} patterns. So far $${cost().toFixed(3)}`);
  }
  const per = todo.length ? cost() / todo.length : 0;
  console.log(
    `Done: ${Object.keys(done).length} of ${patterns.length} patterns written. This run $${cost().toFixed(3)} ` +
      `($${per.toFixed(4)} per pattern; about $${(per * patterns.length).toFixed(2)} for all ${patterns.length}).`,
  );
}

// Run only as a script (buildLibrary.ts imports the types and pickScenarios).
if (!process.env.GRAMMAR_NO_MAIN) void main();
