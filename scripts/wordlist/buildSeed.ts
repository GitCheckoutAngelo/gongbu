/**
 * Updates the word list, data/wordSeed.json: the one source of every Common Word (edit hand-written words
 * there directly). This adds or refreshes the generated words (out/enriched.json with corrections.json
 * applied), regenerates romanization, and recomputes spoken ranks. Writes:
 *
 *   data/wordSeed.json               every word (committed; tested by scripts/wordlist/wordSeed.test.ts)
 *   scripts/wordlist/out/words.sql   upserts for the D1 "words" table, which the app reads
 *
 *   npx vite-node --config vitest.config.ts scripts/wordlist/buildSeed.ts
 *   npx wrangler d1 execute gongbu --local  --file scripts/wordlist/out/words.sql
 *   npx wrangler d1 execute gongbu --remote --file scripts/wordlist/out/words.sql
 *
 * Word ids are saved in learners' progress, so they never change: an id already in wordSeed.json is
 * reused for the same source word on every rebuild. A spelling with several senses gets ids with a
 * meaning suffix (맞다-correct, 맞다-hit), like 눈-snow. Words are never removed here: a learner may have
 * progress on them (a generated word that's later held back is reported instead).
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import type { CommonWord, Register } from "../../src/data/vocabularyMeta";
import { romanizeWord } from "./romanize";
import { correctedWords } from "./corrections";

const SEED = "data/wordSeed.json";
const OUT = "scripts/wordlist/out";

/** A word in the shared list: the app's word shape, plus where it came from. */
export interface SeedWord extends Omit<CommonWord, "source"> {
  register: Register;
  /** "hand": written and checked by hand; "nikl": generated from the 국립국어원 list and reviewed. */
  origin: "hand" | "nikl";
  /** The generated word's source key (spelling|homograph|POS), so its id stays the same across rebuilds. */
  sourceKey?: string;
}

// ---------- spoken frequency (from spoken_frequency.py's output and the raw subtitle forms)

const GROUPS: Record<string, string[]> = {
  verb: ["VV", "VA", "VX"],
  adjective: ["VV", "VA", "VX"],
  noun: ["NNG", "NNB", "NP", "NR"],
  pronoun: ["NNG", "NNB", "NP", "NR"],
  numeral: ["NNG", "NNB", "NP", "NR", "MM"],
  counter: ["NNB", "NNG"],
  adverb: ["MAG", "MAJ"],
  conjunction: ["MAJ", "MAG"],
  determiner: ["MM"],
  interjection: ["IC"],
};
const lemmaCounts = new Map<string, number>();
for (const line of readFileSync(`${OUT}/spoken_frequency.tsv`, "utf8").split("\n").slice(1)) {
  const [lemma, tag, count] = line.split("\t");
  if (lemma) lemmaCounts.set(`${lemma}|${tag}`, Number(count));
}
const formCounts = new Map<string, number>();
for (const line of readFileSync("scripts/wordlist/sources/ko_full.txt", "utf8").split("\n")) {
  const i = line.lastIndexOf(" ");
  if (i > 0) formCounts.set(line.slice(0, i), Number(line.slice(i + 1)));
}

/** How often a word is spoken: its dictionary form's count, or (set phrases like 안녕하세요) the exact form's. */
function spokenCount(w: { spelling: string; pos: string }): number {
  const byLemma = (GROUPS[w.pos] ?? []).reduce((n, tag) => n + (lemmaCounts.get(`${w.spelling}|${tag}`) ?? 0), 0);
  if (byLemma) return byLemma;
  const parts = w.spelling.split(" ");
  return Math.min(...parts.map((p) => formCounts.get(p) ?? 0));
}

// ---------- ids

/** A short English tag for a sense: the main gloss's first word, or first two (줄-line, 지다-lose, 막-just-now). */
const slug = (meaning: string, words = 1) =>
  meaning
    .toLowerCase()
    .replace(/\([^)]*\)/g, "")
    .split(/[;,]/)[0]
    .replace(/^to (be )?/, "")
    .replace(/[^a-z ]+/g, " ")
    .trim()
    .split(/ +/)
    .slice(0, words)
    .join("-") || "word";

export function readSeed(): SeedWord[] {
  return existsSync(SEED) ? (JSON.parse(readFileSync(SEED, "utf8")) as SeedWord[]) : [];
}

function main() {
  const words = readSeed();
  const indexByKey = new Map(words.flatMap((w, i) => (w.sourceKey ? [[w.sourceKey, i] as const] : [])));
  const generated = correctedWords();
  const generatedKeys = new Set(generated.map((g) => g.key));
  const usedIds = new Set(words.map((w) => w.id));
  const spellingCount = new Map<string, number>();
  for (const w of words) spellingCount.set(w.spelling, (spellingCount.get(w.spelling) ?? 0) + 1);
  for (const g of generated) {
    if (!indexByKey.has(g.key)) spellingCount.set(g.spelling, (spellingCount.get(g.spelling) ?? 0) + 1);
  }

  let added = 0;
  for (const g of generated) {
    const existing = indexByKey.get(g.key);
    let id = existing !== undefined ? words[existing].id : undefined;
    if (!id) {
      id = spellingCount.get(g.spelling)! > 1 ? `${g.spelling}-${slug(g.meaning)}` : g.spelling;
      if (usedIds.has(id)) id = `${g.spelling}-${slug(g.meaning, 2)}`;
      for (let n = 2; usedIds.has(id); n++) id = `${g.spelling}-${slug(g.meaning)}-${n}`;
      usedIds.add(id);
    }
    const word: SeedWord = {
      id,
      spelling: g.spelling,
      meaning: g.meaning,
      pos: g.pos as SeedWord["pos"],
      category: g.category,
      level: g.level as SeedWord["level"],
      romanization: "",
      ...(g.pronounced && { pronounced: g.pronounced }),
      ...(g.rules.length && { rules: g.rules as SeedWord["rules"] }),
      ...(g.letters.length && { letters: g.letters as SeedWord["letters"] }),
      ...(g.note && { note: g.note }),
      register: g.register,
      origin: "nikl",
      sourceKey: g.key,
    };
    if (existing !== undefined) words[existing] = word;
    else {
      words.push(word);
      added++;
    }
  }
  const heldBack = words.filter((w) => w.sourceKey && !generatedKeys.has(w.sourceKey));
  if (heldBack.length) {
    console.warn(`Kept (already in the list, now held back or missing): ${heldBack.map((w) => w.id).join(", ")}`);
  }

  // Romanization for every word (koroman plus the hand-checked fixes in romanize.ts).
  for (const w of words) w.romanization = romanizeWord(w.spelling);

  // Spoken rank across the whole list (1 = most spoken); words never heard get none.
  const counts = new Map(words.map((w) => [w.id, spokenCount(w)]));
  for (const w of words) delete w.spokenRank;
  [...words]
    .filter((w) => counts.get(w.id)! > 0)
    .sort((a, b) => counts.get(b.id)! - counts.get(a.id)!)
    .forEach((w, i) => (w.spokenRank = i + 1));

  // One word per line: small, readable diffs when words change.
  writeFileSync(SEED, "[\n" + words.map((w) => JSON.stringify(w)).join(",\n") + "\n]\n");

  const q = (v: unknown) =>
    v === undefined || v === null ? "NULL" : typeof v === "number" ? String(v) : `'${String(v).replace(/'/g, "''")}'`;
  const now = Date.now();
  const sql = words.map(
    (w) =>
      "INSERT INTO words (id, spelling, meaning, pos, category, level, romanization, pronounced, rules, letters, note, register, spoken_rank, origin, updated_at) VALUES (" +
      [
        w.id,
        w.spelling,
        w.meaning,
        w.pos,
        w.category,
        w.level,
        w.romanization,
        w.pronounced,
        JSON.stringify(w.rules ?? []),
        JSON.stringify(w.letters ?? []),
        w.note,
        w.register,
        w.spokenRank,
        w.origin,
        now,
      ]
        .map(q)
        .join(", ") +
      ") ON CONFLICT (id) DO UPDATE SET spelling = excluded.spelling, meaning = excluded.meaning, pos = excluded.pos, " +
      "category = excluded.category, level = excluded.level, romanization = excluded.romanization, pronounced = excluded.pronounced, " +
      "rules = excluded.rules, letters = excluded.letters, note = excluded.note, register = excluded.register, " +
      "spoken_rank = excluded.spoken_rank, origin = excluded.origin, updated_at = excluded.updated_at;",
  );
  writeFileSync(`${OUT}/words.sql`, sql.join("\n") + "\n");

  const ranked = words.filter((w) => w.spokenRank).length;
  console.log(
    `${words.length} words (${words.filter((w) => w.origin === "hand").length} hand-written, ` +
      `${words.filter((w) => w.origin === "nikl").length} generated; ${added} new this run); ${ranked} with a spoken rank`,
  );
  console.log(
    "Ids with a sense suffix:",
    words
      .filter((w) => w.origin === "nikl" && w.id !== w.spelling)
      .map((w) => w.id)
      .join(", "),
  );
}

if (!process.env.WORDLIST_NO_MAIN) main();
