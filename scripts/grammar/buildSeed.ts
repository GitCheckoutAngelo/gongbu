/**
 * Builds the grammar pattern list from Claude's drafts (out/curated.json, cards.json, plain.json,
 * families.json) with the hand review in corrections.json applied, checks every card, and writes:
 *
 *   data/grammarPatterns.json      every practice item (committed; tested by scripts/grammar/grammar.test.ts)
 *   scripts/grammar/out/grammar.sql   the D1 "grammar_patterns" table's contents (replaces it)
 *
 *   npx vite-node --config vitest.config.ts scripts/grammar/buildSeed.ts
 *   npx wrangler d1 execute gongbu --local  --file scripts/grammar/out/grammar.sql   (and --remote)
 *
 * Families: near-variants (N부터 N까지 → N에서 N까지) merge into one practice item; the item lists them as
 * `variants` and keeps their old ids as `aliases`, so a learner's earlier choice still finds it.
 * Problems are printed and those patterns left out, so they can be fixed in corrections.json first.
 * Pattern ids are kept: an id already in grammarPatterns.json is reused for the same draft.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import {
  GRAMMAR_GROUP_IDS,
  POLITENESS_IDS,
  type GrammarGroupId,
  type GrammarPattern,
  type Politeness,
} from "../../src/data/grammarMeta";
import { KoromanRomanizer } from "../../worker/services/romanizer/providers/koroman";
import { grammarProblems } from "./check";
import { patternKey, type Card, type InventoryItem, type Plain } from "./types";

const OUT = "scripts/grammar/out";
const SEED = "data/grammarPatterns.json";

const romanizer = new KoromanRomanizer();
/** How a Korean sentence is read (shown as a tooltip on the examples). */
const rom = (ko: string) => romanizer.romanizeWords(ko.split(/\s+/).filter(Boolean)).filter(Boolean).join(" ");

/**
 * Explanations were drafted as "Put it at the end…"; name the pattern instead of "it" ("Put -아요/어요 at
 * the end…"), so a learner never has to guess what "it" is.
 */
const nameThePattern = (explain: string, form: string) => explain.replace(/^((?:\w+ )?)it\b/i, `$1${form}`);

type Correction = Partial<InventoryItem & Card & Plain> & { exclude?: string; mergeInto?: string | null };
type Family = { group: GrammarGroupId; mergeInto: string | null };
type SeedPattern = GrammarPattern & { key: string };

const read = <T>(file: string, fallback: T): T =>
  existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as T) : fallback;

function main() {
  const curated = read<InventoryItem[]>(`${OUT}/curated.json`, []);
  const cards = read<Record<string, Card>>(`${OUT}/cards.json`, {});
  const plain = read<Record<string, Plain>>(`${OUT}/plain.json`, {});
  const families = read<Record<string, Family>>(`${OUT}/families.json`, {});
  const levels = read<Record<string, Politeness[]>>(`${OUT}/levels.json`, {});
  const corrections = read<Record<string, Correction>>("scripts/grammar/corrections.json", {});
  const previous = read<SeedPattern[]>(SEED, []);
  // Ids already handed out, by draft key (a merged pattern's id lives on as an alias of its family).
  const idByKey = new Map<string, string>();
  for (const p of previous) {
    idByKey.set(p.key, p.id);
    for (const [i, k] of (p.aliasKeys ?? []).entries()) idByKey.set(k, p.aliases?.[i] ?? k);
  }

  // The same form in two groups (two uses of one ending) gets the draft group in its id.
  const formCount = new Map<string, number>();
  for (const p of curated) formCount.set(p.form, (formCount.get(p.form) ?? 0) + 1);
  const idOf = (p: InventoryItem) =>
    idByKey.get(patternKey(p)) ?? (formCount.get(p.form)! > 1 ? `${p.form} (${p.group})` : p.form);

  const live = curated.filter((p) => !corrections[patternKey(p)]?.exclude);
  const byKey = new Map(live.map((p) => [patternKey(p), p]));
  // Each pattern's family head (following chains: a → b → c gives c), with hand corrections first.
  const mergeTarget = (key: string): string | null => {
    const fix = corrections[key];
    const target = fix && "mergeInto" in fix ? fix.mergeInto : families[key]?.mergeInto;
    return target && byKey.has(target) ? target : null;
  };
  const headOf = (key: string): string => {
    const seen = new Set<string>();
    let k = key;
    for (let next = mergeTarget(k); next && !seen.has(next); next = mergeTarget(k)) {
      seen.add(k);
      k = next;
    }
    return k;
  };
  const members = new Map<string, InventoryItem[]>();
  for (const p of live) {
    const head = headOf(patternKey(p));
    if (head !== patternKey(p)) members.set(head, [...(members.get(head) ?? []), p]);
  }

  const idByForm = new Map<string, string>();
  for (const p of live) {
    const head = byKey.get(headOf(patternKey(p)))!;
    if (!idByForm.has(p.form)) idByForm.set(p.form, idOf(head));
  }

  const patterns: SeedPattern[] = [];
  const problems: string[] = [];
  for (const p of live) {
    const key = patternKey(p);
    if (headOf(key) !== key) continue; // merged into its family's item
    const card = cards[key];
    if (!card) {
      problems.push(`${key}: no card`);
      continue;
    }
    const fix = corrections[key] ?? {};
    const merged = { ...p, ...card, ...(plain[key] ?? {}), ...fix } as InventoryItem & Card & Partial<Plain>;
    const id = idOf(p);
    const variants = members.get(key) ?? [];
    const group = (fix.group ?? families[key]?.group ?? p.group) as GrammarGroupId;
    // The levels the item can be practised at: its own and its variants' (-자 casual + -(으)ㅂ시다 formal).
    const allowed = new Set([key, ...variants.map(patternKey)].flatMap((k) => levels[k] ?? POLITENESS_IDS));
    const speechLevels = POLITENESS_IDS.filter((l) => allowed.has(l));
    const pattern: SeedPattern = {
      id,
      form: merged.form,
      meaning: merged.meaning.trim(),
      title: merged.title?.trim() ?? "",
      explain: nameThePattern(merged.explain?.trim() ?? "", merged.form),
      sample: {
        ko: merged.sample?.ko.trim() ?? "",
        en: merged.sample?.en.trim() ?? "",
        rom: rom(merged.sample?.ko ?? ""),
      },
      level: Math.min(merged.level, ...variants.map((v) => v.level)),
      group,
      register: merged.register as GrammarPattern["register"],
      attaches: merged.attaches.trim(),
      examples: merged.examples.map((e) => ({ ko: e.ko.trim(), en: e.en.trim(), part: e.part.trim(), rom: rom(e.ko) })),
      // Similar patterns by id (unknown forms dropped; never itself or its own variants).
      similar: [...new Set(merged.similar.map((f) => idByForm.get(f)).filter((s): s is string => !!s && s !== id))],
      ...(merged.note?.trim() && { note: merged.note.trim() }),
      ...(speechLevels.length < POLITENESS_IDS.length && { speechLevels }),
      ...(variants.length && {
        variants: variants.map((v) => ({ form: v.form, title: plain[patternKey(v)]?.title ?? v.meaning })),
        aliases: variants.map(idOf),
        aliasKeys: variants.map(patternKey),
      }),
      key,
    };
    const issues = grammarProblems(pattern);
    if (!(GRAMMAR_GROUP_IDS as string[]).includes(group)) issues.push(`group ${group}`);
    if (issues.length) problems.push(`${key}: ${issues.join("; ")}`);
    else patterns.push(pattern);
  }

  // Easiest first within each group (the picker lists groups in order).
  const groupOrder = new Map(GRAMMAR_GROUP_IDS.map((g, i) => [g, i]));
  patterns.sort(
    (a, b) =>
      groupOrder.get(a.group)! - groupOrder.get(b.group)! || a.level - b.level || a.form.localeCompare(b.form, "ko"),
  );
  writeFileSync(SEED, "[\n" + patterns.map((p) => JSON.stringify(p)).join(",\n") + "\n]\n");

  const q = (v: unknown) =>
    v === undefined || v === null ? "NULL" : typeof v === "number" ? String(v) : `'${String(v).replace(/'/g, "''")}'`;
  const now = Date.now();
  // The list is reference data: the table becomes exactly this list (merged items' rows go).
  const sql = [
    `DELETE FROM grammar_patterns WHERE id NOT IN (${patterns.map((p) => q(p.id)).join(", ")});`,
    ...patterns.map(
      (p, i) =>
        "INSERT INTO grammar_patterns (id, form, title, explain, sample, meaning, level, group_id, register, attaches, " +
        "examples, similar, note, variants, aliases, speech_levels, sort, updated_at) VALUES (" +
        [
          p.id,
          p.form,
          p.title,
          p.explain,
          JSON.stringify(p.sample),
          p.meaning,
          p.level,
          p.group,
          p.register,
          p.attaches,
          JSON.stringify(p.examples),
          JSON.stringify(p.similar),
          p.note,
          JSON.stringify(p.variants ?? []),
          JSON.stringify(p.aliases ?? []),
          JSON.stringify(p.speechLevels ?? POLITENESS_IDS),
          i,
          now,
        ]
          .map(q)
          .join(", ") +
        ") ON CONFLICT (id) DO UPDATE SET form = excluded.form, title = excluded.title, explain = excluded.explain, " +
        "sample = excluded.sample, meaning = excluded.meaning, level = excluded.level, group_id = excluded.group_id, " +
        "register = excluded.register, attaches = excluded.attaches, examples = excluded.examples, " +
        "similar = excluded.similar, note = excluded.note, variants = excluded.variants, aliases = excluded.aliases, " +
        "speech_levels = excluded.speech_levels, " +
        "sort = excluded.sort, updated_at = excluded.updated_at;",
    ),
  ];
  writeFileSync(`${OUT}/grammar.sql`, sql.join("\n") + "\n");

  const byGroup = patterns.reduce<Record<string, number>>((n, p) => ({ ...n, [p.group]: (n[p.group] ?? 0) + 1 }), {});
  const merged = patterns.reduce((n, p) => n + (p.variants?.length ?? 0), 0);
  console.log(`${patterns.length} practice items (${merged} variants merged in) -> ${SEED}`);
  console.log(JSON.stringify(byGroup));
  if (problems.length) {
    console.log(`${problems.length} left out (fix in corrections.json):\n  ` + problems.join("\n  "));
  }
}

main();
