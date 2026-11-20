/**
 * Checks the generated words (out/enriched.json, with corrections.json applied) with the same pronunciation
 * checks as the word list, and looks for meanings that clash with each other or with words already in the
 * list (an English → Korean card needs one answer). Writes out/review.tsv: every word, with any problems.
 *
 *   npx vite-node --config vitest.config.ts scripts/wordlist/check.ts
 */
import { readFileSync, writeFileSync } from "node:fs";
import { mainSense, pronunciationProblems } from "../../src/data/pronunciationCheck";
import { correctedWords } from "./corrections";

const OUT = "scripts/wordlist/out";

/** Words already in data/wordSeed.json. */
interface ListWord {
  id: string;
  spelling: string;
  meaning: string;
  pos: string;
  sourceKey?: string;
}

function check() {
  const enriched = correctedWords();
  // Words already in the list, other than these generated ones (whose earlier versions are in it too).
  const keys = new Set(enriched.map((w) => w.key));
  const list = (JSON.parse(readFileSync("data/wordSeed.json", "utf8")) as ListWord[]).filter(
    (w) => !w.sourceKey || !keys.has(w.sourceKey),
  );

  const meaningOwner = new Map<string, string>(
    list.map((w) => [w.meaning.toLowerCase(), `${w.spelling} (in the list)`]),
  );
  const rows: string[] = [
    "spelling\tpos\tlevel\tregister\tcategory\tmeaning\tpronounced\trules\tnote\tspoken rank\tproblems",
  ];
  const flagged: string[] = [];
  for (const w of enriched) {
    const problems = pronunciationProblems({ ...w, id: w.key });
    const clash = meaningOwner.get(w.meaning.toLowerCase());
    if (clash) problems.push(`same meaning as ${clash}`);
    meaningOwner.set(w.meaning.toLowerCase(), w.spelling);
    // Same main sense and part of speech, with no hint to tell them apart: ambiguous English → Korean card.
    const sense = mainSense(w.meaning);
    const sameSense = [...list, ...enriched].filter(
      (o) => o.spelling !== w.spelling && o.pos === w.pos && mainSense(o.meaning) === sense,
    );
    if (sameSense.length && !w.meaning.includes("(")) {
      problems.push(`same main sense "${sense}" as ${sameSense.map((o) => o.spelling).join(", ")}: add a hint`);
    }
    if (problems.length) flagged.push(`  ${w.spelling}: ${problems.join("; ")}`);
    rows.push(
      [
        w.spelling,
        w.pos,
        w.level,
        w.register,
        w.category,
        w.meaning,
        w.pronounced ?? "",
        w.rules.join("+"),
        w.note ?? "",
        w.source.spokenRank ?? "",
        problems.join("; "),
      ].join("\t"),
    );
  }
  writeFileSync(`${OUT}/review.tsv`, "﻿" + rows.join("\n") + "\n");
  console.log(`${enriched.length} words checked, ${flagged.length} with problems -> ${OUT}/review.tsv`);
  if (flagged.length) console.log(flagged.join("\n"));
}

check();
