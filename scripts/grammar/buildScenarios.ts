/**
 * Writes the scenario library for grammar practice: for each practice setting, about eight short,
 * realistic situations that actually happen in daily life in Korea, each with who A and B are, the speech
 * levels it suits, and the kinds of things people say in it (grammar groups). The Reader picks one that
 * fits the learner's setting, speech level and pattern, so Claude writes a conversation instead of
 * inventing a situation.                                                  → data/scenarios.json
 *
 *   npx vite-node --config vitest.config.ts scripts/grammar/buildScenarios.ts
 *
 * Resumable (settings already written are kept). Needs ANTHROPIC_API_KEY (environment or .dev.vars).
 */
import Anthropic from "@anthropic-ai/sdk";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { GRAMMAR_GROUPS, POLITENESS_IDS, PRACTICE_SETTINGS, type Scenario } from "../../src/data/grammarMeta";

const FILE = "data/scenarios.json";
const MODEL = "claude-sonnet-5-5";

function apiKey(): string {
  if (process.env.ANTHROPIC_API_KEY) return process.env.ANTHROPIC_API_KEY;
  const vars = existsSync(".dev.vars") ? readFileSync(".dev.vars", "utf8") : "";
  const key = /^ANTHROPIC_API_KEY=(.+)$/m.exec(vars)?.[1]?.trim();
  if (!key) throw new Error("Set ANTHROPIC_API_KEY (or add it to .dev.vars).");
  return key;
}

const SYSTEM = [
  "You write short scenario briefs for Korean conversation practice. Each scenario is a small, ordinary moment",
  "that really happens in daily life in Korea (not a sitcom plot): a clear reason to talk, a concrete detail,",
  "and often a small twist (something is sold out, a wrong order, running late, a choice to make).",
  "For each scenario give:",
  "- id: short kebab-case, unique within the setting (e.g. oat-milk);",
  "- situation: ONE or TWO English sentences describing what happens and what each person wants, concrete",
  "  (names of drinks, times, places), with no dialogue;",
  "- roles: who A and B are, 1-3 English words each (e.g. customer, barista);",
  "- politeness: the speech levels at which this exchange naturally happens between these two people:",
  "  casual (반말: close friends, siblings, someone much younger), polite (해요체: staff and customers,",
  "  colleagues, strangers), formal (합쇼체: a boss, an interview, official service). Usually exactly one;",
  "- functions: the kinds of things people naturally say in it, as group ids from this list (2-5):",
  ...GRAMMAR_GROUPS.map((g) => `  ${g.id}: ${g.label}`),
].join("\n");

const FORMAT = {
  type: "json_schema",
  schema: {
    type: "object",
    properties: {
      scenarios: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: { type: "string" },
            situation: { type: "string" },
            roles: {
              type: "object",
              properties: { A: { type: "string" }, B: { type: "string" } },
              required: ["A", "B"],
              additionalProperties: false,
            },
            politeness: { type: "array", items: { type: "string", enum: POLITENESS_IDS } },
            functions: { type: "array", items: { type: "string", enum: GRAMMAR_GROUPS.map((g) => g.id) } },
          },
          required: ["id", "situation", "roles", "politeness", "functions"],
          additionalProperties: false,
        },
      },
    },
    required: ["scenarios"],
    additionalProperties: false,
  },
} as const;

async function main() {
  const saved: Scenario[] = existsSync(FILE) ? JSON.parse(readFileSync(FILE, "utf8")) : [];
  const done = new Set(saved.map((s) => s.setting));
  const client = new Anthropic({ apiKey: apiKey() });
  let input = 0;
  let output = 0;
  for (const setting of PRACTICE_SETTINGS.filter((s) => !done.has(s.id))) {
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      system: SYSTEM,
      output_config: { effort: "medium", format: FORMAT },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      messages: [
        {
          role: "user",
          content:
            `Setting: "${setting.label}". Write 8 different scenarios that happen in this setting. ` +
            "Cover all three speech levels across them (at least two each where the setting allows; fewer for " +
            "formal if it rarely happens there). Vary what people do: asking, deciding, explaining, complaining, " +
            "planning, comparing, reacting.",
        },
      ],
    });
    input += response.usage.input_tokens;
    output += response.usage.output_tokens;
    if (response.stop_reason !== "end_turn") throw new Error(`${setting.id}: stopped (${response.stop_reason})`);
    const text = response.content.map((b) => (b.type === "text" ? b.text : "")).join("");
    const list = (JSON.parse(text) as { scenarios: Omit<Scenario, "setting">[] }).scenarios;
    for (const s of list) saved.push({ ...s, id: `${setting.id}/${s.id}`, setting: setting.id });
    // One scenario per line: readable diffs.
    writeFileSync(FILE, "[\n" + saved.map((s) => JSON.stringify(s)).join(",\n") + "\n]\n");
    const cost = (input * 2 + output * 10) / 1e6;
    console.log(`${setting.id}: ${list.length} scenarios. So far $${cost.toFixed(3)}`);
  }
  console.log(`${saved.length} scenarios in ${FILE}`);
}

void main();
