/**
 * Builds the grammar pattern list (TOPIK 1-4) with Claude, in two passes, then checks it:
 *
 *   1. inventory: for each meaning group, every pattern a learner meets at TOPIK 1-4 (form, level,
 *      register, meaning), using the 국립국어원 standard curriculum (국제 통용 한국어 표준 교육과정) as
 *      the checklist. Resumable: groups already done are skipped.  → out/inventory.json
 *   2. curate: the standard syllabus picked from the inventory (duplicates merged).  → out/curated.json
 *   3. cards: how each pattern attaches, two example sentences (with the pattern's part marked),
 *      similar patterns, and a note.                                      → out/cards.json
 *
 *   npx vite-node --config vitest.config.ts scripts/grammar/buildPatterns.ts -- inventory
 *   npx vite-node --config vitest.config.ts scripts/grammar/buildPatterns.ts -- cards
 *
 * Then scripts/grammar/buildSeed.ts checks everything and writes data/grammarPatterns.json.
 * Needs ANTHROPIC_API_KEY (environment or .dev.vars). Prints what each run cost.
 */
import Anthropic from "@anthropic-ai/sdk";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { GRAMMAR_GROUPS, PATTERN_REGISTER_IDS } from "../../src/data/grammarMeta";
import { patternKey, type Card, type InventoryItem, type Plain } from "./types";

const OUT = "scripts/grammar/out";
const MODEL = "claude-sonnet-5-5";
const PRICE = { input: 2, output: 10 }; // USD per million tokens

function apiKey(): string {
  if (process.env.ANTHROPIC_API_KEY) return process.env.ANTHROPIC_API_KEY;
  const vars = existsSync(".dev.vars") ? readFileSync(".dev.vars", "utf8") : "";
  const key = /^ANTHROPIC_API_KEY=(.+)$/m.exec(vars)?.[1]?.trim();
  if (!key) throw new Error("Set ANTHROPIC_API_KEY (or add it to .dev.vars).");
  return key;
}

const load = <T>(file: string, fallback: T): T =>
  existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as T) : fallback;

const client = () => new Anthropic({ apiKey: apiKey() });
const usage = { input: 0, output: 0 };
const cost = () => (usage.input * PRICE.input + usage.output * PRICE.output) / 1e6;

async function ask<T>(system: string, user: string, schema: object): Promise<T> {
  const response = await client().beta.messages.create({
    model: MODEL,
    max_tokens: 16000,
    system,
    output_config: { effort: "medium", format: { type: "json_schema", schema } },
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    messages: [{ role: "user", content: user }],
  });
  usage.input += response.usage.input_tokens;
  usage.output += response.usage.output_tokens;
  if (response.stop_reason !== "end_turn") throw new Error(`Stopped: ${response.stop_reason}`);
  return JSON.parse(response.content.map((b) => (b.type === "text" ? b.text : "")).join("")) as T;
}

const STYLE = [
  "Write pattern forms the way Korean textbooks do: a leading hyphen for endings, alternations in brackets or",
  "with a slash, and a placeholder N for nouns where needed. Examples: -아요/어요, -(으)ㄹ까요?, -(으)니까,",
  "-고 싶다, -아/어 보다, N이/가, N에서, -는데, -기 때문에.",
].join("\n");

async function inventory() {
  const done = load<Record<string, InventoryItem[]>>(`${OUT}/inventory.json`, {});
  const groups = GRAMMAR_GROUPS.filter((g) => !done[g.id]);
  const others = GRAMMAR_GROUPS.map((g) => `${g.id} (${g.label})`).join(", ");
  for (const g of groups) {
    const { patterns } = await ask<{ patterns: Omit<InventoryItem, "group">[] }>(
      [
        "You are an experienced Korean teacher compiling a syllabus of grammar patterns for learners.",
        "Use the 국립국어원 standard curriculum (국제 통용 한국어 표준 교육과정) and the major textbooks (Seoul",
        "National, Yonsei, Sogang) as your checklist. Be accurate: learners will study exactly what you list.",
        STYLE,
      ].join("\n"),
      [
        `List every grammar pattern a learner meets at TOPIK levels 1-4 that belongs in this group:`,
        `"${g.label}" (id ${g.id}).`,
        `Other groups exist (${others}); leave patterns that clearly belong to another group to that group.`,
        "For each pattern: form; level (the TOPIK level, 1-4, where it is usually taught); register (spoken,",
        'written, or both); meaning (short English, e.g. "shall we…? / shall I…?").',
        "Only standard, widely taught patterns. No duplicates or mere spelling variants.",
      ].join("\n"),
      {
        type: "object",
        properties: {
          patterns: {
            type: "array",
            items: {
              type: "object",
              properties: {
                form: { type: "string" },
                level: { type: "integer", enum: [1, 2, 3, 4] },
                register: { type: "string", enum: PATTERN_REGISTER_IDS },
                meaning: { type: "string" },
              },
              required: ["form", "level", "register", "meaning"],
              additionalProperties: false,
            },
          },
        },
        required: ["patterns"],
        additionalProperties: false,
      },
    );
    done[g.id] = patterns.map((p) => ({ ...p, group: g.id }));
    mkdirSync(OUT, { recursive: true });
    writeFileSync(`${OUT}/inventory.json`, JSON.stringify(done, null, 1));
    console.log(`${g.id}: ${patterns.length} patterns. So far $${cost().toFixed(3)}`);
  }
  const total = Object.values(done).reduce((n, list) => n + list.length, 0);
  console.log(`Inventory: ${total} patterns in ${Object.keys(done).length} groups. This run: $${cost().toFixed(3)}`);
}

/**
 * 2. curate: the inventory overlaps (a pattern listed under several groups) and runs long. Claude picks the
 * standard syllabus from it, close to the curriculum's numbers per level (about 45, 45, 67, 67), merging
 * variants and giving each pattern its single best group.                  → out/curated.json
 */
async function curate() {
  const inv = Object.values(load<Record<string, InventoryItem[]>>(`${OUT}/inventory.json`, {})).flat();
  const lines = inv.map((p) => `${p.form} | ${p.group} | TOPIK ${p.level} | ${p.register} | ${p.meaning}`);
  const groups = GRAMMAR_GROUPS.map((g) => `${g.id} (${g.label})`).join(", ");
  const { patterns } = await ask<{ patterns: InventoryItem[] }>(
    [
      "You are an experienced Korean teacher finalizing a grammar syllabus for TOPIK levels 1-4.",
      "The 국립국어원 standard curriculum (국제 통용 한국어 표준 교육과정) teaches about 45 grammar items at level 1,",
      "45 at level 2, 67 at level 3 and 67 at level 4. Aim close to those numbers.",
      STYLE,
    ].join("\n"),
    [
      "Below is a draft list with duplicates (the same pattern under several groups), variants and some rare or",
      "advanced items. Produce the final syllabus:",
      "- keep the standard, widely taught patterns; drop rare, literary or advanced-only items;",
      "- merge duplicates and variants into one entry (one form, written as in textbooks);",
      "- give each pattern its single best group from: " + groups,
      "- set the level where it is usually taught (1-4), the register and a short English meaning.",
      "",
      ...lines,
    ].join("\n"),
    {
      type: "object",
      properties: {
        patterns: {
          type: "array",
          items: {
            type: "object",
            properties: {
              form: { type: "string" },
              level: { type: "integer", enum: [1, 2, 3, 4] },
              group: { type: "string", enum: GRAMMAR_GROUPS.map((g) => g.id) },
              register: { type: "string", enum: PATTERN_REGISTER_IDS },
              meaning: { type: "string" },
            },
            required: ["form", "level", "group", "register", "meaning"],
            additionalProperties: false,
          },
        },
      },
      required: ["patterns"],
      additionalProperties: false,
    },
  );
  writeFileSync(`${OUT}/curated.json`, JSON.stringify(patterns, null, 1));
  const byLevel = patterns.reduce<Record<number, number>>((n, p) => ({ ...n, [p.level]: (n[p.level] ?? 0) + 1 }), {});
  console.log(`Curated: ${patterns.length} patterns ${JSON.stringify(byLevel)}. This run: $${cost().toFixed(3)}`);
}

async function cards() {
  const inv = load<InventoryItem[]>(`${OUT}/curated.json`, []);
  const done = load<Record<string, Card>>(`${OUT}/cards.json`, {});
  const todo = inv.filter((p) => !done[patternKey(p)]);
  const allForms = inv.map((p) => p.form).join(", ");
  const BATCH = 15;
  for (let i = 0; i < todo.length; i += BATCH) {
    const batch = todo.slice(i, i + BATCH);
    const { cards: list } = await ask<{ cards: Card[] }>(
      [
        "You write grammar cards for Korean learners. Accuracy matters more than anything.",
        "- attaches: one or two English sentences on how the pattern attaches (to verbs / adjectives / nouns; after",
        '  a vowel or a consonant; irregular stems if relevant). Concrete, e.g. "Verb stem + -을까요 after a consonant',
        '  (먹을까요), -ㄹ까요 after a vowel (갈까요)."',
        "- examples: exactly two natural sentences at the pattern's level, polite 해요체 unless the pattern itself",
        "  is another speech level, each with a faithful English translation, and `part`: the exact substring of",
        "  the Korean sentence that realizes the pattern (e.g. 갈까요 in 같이 갈까요?). `part` must appear in `ko`.",
        "- similar: forms of up to three similar patterns a learner should compare it with, chosen ONLY from the",
        "  given list of all forms (copy them exactly), or empty.",
        '- note: one short line on a common mistake or nuance, or "".',
      ].join("\n"),
      [
        "Patterns (number | form | level | meaning). Return one card per number; the meaning says which use of",
        "the form is meant when a form appears twice.",
        ...batch.map((p, n) => `${n + 1} | ${p.form} | TOPIK ${p.level} | ${p.meaning}`),
        "",
        `All forms in the list: ${allForms}`,
      ].join("\n"),
      {
        type: "object",
        properties: {
          cards: {
            type: "array",
            items: {
              type: "object",
              properties: {
                number: { type: "integer" },
                form: { type: "string" },
                attaches: { type: "string" },
                examples: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: { ko: { type: "string" }, en: { type: "string" }, part: { type: "string" } },
                    required: ["ko", "en", "part"],
                    additionalProperties: false,
                  },
                },
                similar: { type: "array", items: { type: "string" } },
                note: { type: "string" },
              },
              required: ["number", "form", "attaches", "examples", "similar", "note"],
              additionalProperties: false,
            },
          },
        },
        required: ["cards"],
        additionalProperties: false,
      },
    );
    for (const { number, ...c } of list as (Card & { number: number })[]) {
      const p = batch[number - 1];
      if (p && p.form === c.form) done[patternKey(p)] = c;
    }
    writeFileSync(`${OUT}/cards.json`, JSON.stringify(done, null, 1));
    console.log(`cards ${Math.min(i + BATCH, todo.length)}/${todo.length}. So far $${cost().toFixed(3)}`);
  }
  console.log(`Cards: ${Object.keys(done).length} of ${inv.length}. This run: $${cost().toFixed(3)}`);
}

// vite-node doesn't pass the script's own arguments through process.argv reliably, so the step can also
// come from GRAMMAR_STEP.
/**
 * 4. plain: a plain-language face for each pattern (title, one-sentence explanation, a tiny example), for
 * learners who don't know grammar terms like "particle" or "object marker".   → out/plain.json
 */
async function plain() {
  const inv = load<InventoryItem[]>(`${OUT}/curated.json`, []);
  const cardsDone = load<Record<string, Card>>(`${OUT}/cards.json`, {});
  const done = load<Record<string, Plain>>(`${OUT}/plain.json`, {});
  const todo = inv.filter((p) => !done[patternKey(p)]);
  const BATCH = 25;
  for (let i = 0; i < todo.length; i += BATCH) {
    const batch = todo.slice(i, i + BATCH);
    const { items } = await ask<{ items: (Plain & { number: number })[] }>(
      [
        "You explain Korean grammar patterns to everyday learners who know NO grammar terms.",
        "Never use words like particle, marker, suffix, stem, conjugate, honorific, clause, subject, object, topic,",
        "modifier, auxiliary, declarative, connective. Say what the pattern lets you SAY, with an example.",
        '- title: 1-5 plain English words for what it means (e.g. "by, using, towards", "shall we…?", "because",',
        '  "want to", "after doing"). Lower case unless a name.',
        "- explain: ONE short sentence (max 25 words) a beginner understands: when you use it and what it adds,",
        '  ideally with a mini example inline (e.g. "Add it after a noun to say how you do something or which',
        '  way you go: 버스로 = by bus.").',
        "- sample: the shortest natural Korean chunk showing it (1-3 words, e.g. 버스로, 같이 갈까요?) and its",
        '  English (e.g. "by bus", "shall we go together?"). Correct, standard Korean.',
      ].join("\n"),
      [
        "Patterns (number | form | meaning | an example sentence):",
        ...batch.map((p, n) => {
          const ex = cardsDone[patternKey(p)]?.examples[0];
          return `${n + 1} | ${p.form} | ${p.meaning} | ${ex ? `${ex.ko} (${ex.en})` : ""}`;
        }),
      ].join("\n"),
      {
        type: "object",
        properties: {
          items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                number: { type: "integer" },
                title: { type: "string" },
                explain: { type: "string" },
                sample: {
                  type: "object",
                  properties: { ko: { type: "string" }, en: { type: "string" } },
                  required: ["ko", "en"],
                  additionalProperties: false,
                },
              },
              required: ["number", "title", "explain", "sample"],
              additionalProperties: false,
            },
          },
        },
        required: ["items"],
        additionalProperties: false,
      },
    );
    for (const { number, ...rest } of items) {
      const p = batch[number - 1];
      if (p) done[patternKey(p)] = rest;
    }
    writeFileSync(`${OUT}/plain.json`, JSON.stringify(done, null, 1));
    console.log(`plain ${Math.min(i + BATCH, todo.length)}/${todo.length}. So far $${cost().toFixed(3)}`);
  }
  console.log(`Plain: ${Object.keys(done).length} of ${inv.length}. This run: $${cost().toFixed(3)}`);
}

/**
 * 5. families: near-variants (N부터 N까지 / N에서 N까지, -아도/어도 되다 / -아도/어도 괜찮다…) merge into one
 * practice item, and every pattern gets one of the "what you want to say" groups.   → out/families.json
 */
async function families() {
  const inv = load<InventoryItem[]>(`${OUT}/curated.json`, []);
  const plainDone = load<Record<string, Plain>>(`${OUT}/plain.json`, {});
  const groups = GRAMMAR_GROUPS.map((g) => `${g.id} (${g.label})`).join(", ");
  const { items } = await ask<{ items: { number: number; group: string; mergeInto: number }[] }>(
    [
      "You organise Korean grammar patterns for learners who practise one pattern at a time in a short text.",
      "1. Merge near-variants into one practice item: patterns that mean the same thing and differ only in",
      "   wording, formality or a small optional part (e.g. N부터 N까지 / N에서 N까지; -아도/어도 되다 /",
      "   -아도/어도 괜찮다; N이에요/예요 / N입니다). For a variant, mergeInto is the number of the main pattern",
      "   (the more common, usually lower-level one); for a main or stand-alone pattern, mergeInto is 0.",
      "   Do NOT merge patterns that a learner should learn to tell apart (e.g. -아서/어서 vs -(으)니까 for",
      "   reasons; 이/가 vs 은/는). Never merge into a pattern that itself merges into another.",
      "2. Give every pattern one group, by what the learner wants to SAY, from: " + groups,
    ].join("\n"),
    [
      "Patterns (number | form | plain title | level):",
      ...inv.map((p, n) => `${n + 1} | ${p.form} | ${plainDone[patternKey(p)]?.title ?? p.meaning} | ${p.level}`),
    ].join("\n"),
    {
      type: "object",
      properties: {
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              number: { type: "integer" },
              group: { type: "string", enum: GRAMMAR_GROUPS.map((g) => g.id) },
              mergeInto: { type: "integer" },
            },
            required: ["number", "group", "mergeInto"],
            additionalProperties: false,
          },
        },
      },
      required: ["items"],
      additionalProperties: false,
    },
  );
  const out: Record<string, { group: string; mergeInto: string | null }> = {};
  for (const { number, group, mergeInto } of items) {
    const p = inv[number - 1];
    const target = mergeInto > 0 && mergeInto !== number ? inv[mergeInto - 1] : undefined;
    if (p) out[patternKey(p)] = { group, mergeInto: target ? patternKey(target) : null };
  }
  writeFileSync(`${OUT}/families.json`, JSON.stringify(out, null, 1));
  const merged = Object.values(out).filter((f) => f.mergeInto).length;
  console.log(`Families: ${Object.keys(out).length} patterns, ${merged} merged into another. $${cost().toFixed(3)}`);
}

/**
 * 6. levels: the speech levels each pattern is naturally used at (casual 반말 / polite 해요 / formal 합쇼), so
 * the Reader never asks for, say, -아/어 주시겠어요? between close friends.   → out/levels.json
 */
async function levels() {
  const inv = load<InventoryItem[]>(`${OUT}/curated.json`, []);
  const plainDone = load<Record<string, Plain>>(`${OUT}/plain.json`, {});
  const done = load<Record<string, string[]>>(`${OUT}/levels.json`, {});
  const todo = inv.filter((p) => !done[patternKey(p)]);
  const BATCH = 60;
  for (let i = 0; i < todo.length; i += BATCH) {
    const batch = todo.slice(i, i + BATCH);
    const { items } = await ask<{ items: { number: number; levels: string[] }[] }>(
      [
        "For each Korean grammar pattern, list the speech levels at which a native speaker naturally uses it when",
        "talking to someone: casual (반말, close friends), polite (해요체, everyday polite) and formal (합쇼체,",
        "a boss, announcements). Most patterns work at every level because their ending adapts (-(으)ㄹ까? /",
        "-(으)ㄹ까요? / -(으)ㄹ까요?; 먹어서 is fine at any level): list all three for those. Only leave a level out",
        "when the pattern itself fixes the level: e.g. -아/어 주시겠어요? (polite, formal), -(으)십시오 (formal),",
        "-자 (casual), -아요/어요 (polite), -ㅂ니다/습니다 (formal), N이에요/예요 (polite).",
      ].join("\n"),
      [
        "Patterns (number | form | plain title):",
        ...batch.map((p, n) => `${n + 1} | ${p.form} | ${plainDone[patternKey(p)]?.title ?? p.meaning}`),
      ].join("\n"),
      {
        type: "object",
        properties: {
          items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                number: { type: "integer" },
                levels: { type: "array", items: { type: "string", enum: ["casual", "polite", "formal"] } },
              },
              required: ["number", "levels"],
              additionalProperties: false,
            },
          },
        },
        required: ["items"],
        additionalProperties: false,
      },
    );
    for (const { number, levels: lv } of items) {
      const p = batch[number - 1];
      if (p && lv.length) done[patternKey(p)] = [...new Set(lv)];
    }
    writeFileSync(`${OUT}/levels.json`, JSON.stringify(done, null, 1));
    console.log(`levels ${Math.min(i + BATCH, todo.length)}/${todo.length}. So far $${cost().toFixed(3)}`);
  }
  const fixed = Object.values(done).filter((l) => l.length < 3).length;
  console.log(`Levels: ${Object.keys(done).length} patterns, ${fixed} limited to some levels. $${cost().toFixed(3)}`);
}

const STEPS = { inventory, curate, cards, plain, families, levels };
const stepName = (process.env.GRAMMAR_STEP ??
  process.argv.find((a) => a in STEPS) ??
  "inventory") as keyof typeof STEPS;
const step = STEPS[stepName];
void step();
