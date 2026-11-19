/**
 * Accuracy checks for the built-in Common Words. These are memorized, so the tests try hard to catch
 * a wrong or missing pronunciation:
 *
 * 1. A small detector finds the places where 표준 발음법 *must* change the sound (e.g. an obstruent final
 *    before ㄱㄷㅂㅅㅈ, a final before ㅇ, ㅢ after a consonant). Those words need a pronunciation and
 *    the matching rule links. A pronunciation where nothing *could* change is flagged too.
 * 2. Cross-check: each pronunciation, with tensification undone, must romanize like koroman romanizes
 *    the spelling with pronunciation rules (an independent implementation of the same rules).
 * 3. Structure: unique ids, unique meanings, same syllable count as the spelling, valid links,
 *    agreement with words.ts, and the generated romanization map is up to date.
 */
import { romanize } from "koroman";
import { describe, expect, it } from "vitest";
import { romanizeCommonWord } from "../../scripts/commonWordsRomanizer";
import { COMMON_WORDS, type CommonWord } from "./commonWords";
import { COMMON_WORD_ROMANIZATION } from "./commonWordsRomanization";
import { RULES } from "./rules";
import type { RuleId } from "./types";
import { CATEGORY_IDS, LETTER_NOTE_IDS, PART_OF_SPEECH_IDS, RULE_IDS_FOR_WORDS } from "./vocabularyMeta";
import { WORDS } from "./words";

// ---------- Hangul decomposition

const INITIALS = [..."ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ"];
const MEDIALS = [..."ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ"];
const FINALS = ["", ..."ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ"];

interface Syllable {
  ini: string;
  med: string;
  fin: string;
}

function decompose(ch: string): Syllable {
  const code = ch.charCodeAt(0) - 0xac00;
  if (code < 0 || code > 11171) throw new Error(`not a Hangul syllable: ${ch}`);
  return { ini: INITIALS[Math.floor(code / 588)], med: MEDIALS[Math.floor((code % 588) / 28)], fin: FINALS[code % 28] };
}

function compose({ ini, med, fin }: Syllable): string {
  return String.fromCharCode(0xac00 + INITIALS.indexOf(ini) * 588 + MEDIALS.indexOf(med) * 28 + FINALS.indexOf(fin));
}

// ---------- Rule detector

const DOUBLE = new Set([..."ㄳㄵㄶㄺㄻㄼㄽㄾㄿㅀㅄ"]);
const H_FINALS = new Set([..."ㅎㄶㅀ"]);
/** Finals that sound like [ㄱ], [ㄷ] or [ㅂ]. (ㄼ is usually [ㄹ], so it's handled as a double final.) */
const OBSTRUENT = new Set([..."ㄱㄲㅋㄳㄺㄷㅅㅆㅈㅊㅌㅂㅍㄿㅄ"]);
const LAX = new Set([..."ㄱㄷㅂㅅㅈ"]);
/** Word-final consonants that are written but not pronounced as written. */
const CHANGES_AT_END = new Set([..."ㄲㅋㅅㅆㅈㅊㅌㅍㅎ"]);

/** Ids (rules or letter notes) that a word's spelling makes certain, and whether a change is merely possible. */
function detect(spelling: string): { must: Set<string>; may: boolean } {
  const must = new Set<string>();
  let may = false;
  for (const token of spelling.split(" ")) {
    const s = [...token].map(decompose);
    s.forEach((cur, i) => {
      const next = s[i + 1];
      // Vowels (표준 발음법 제5항)
      if (cur.med === "ㅢ" && (cur.ini !== "ㅇ" || i > 0)) must.add("ui");
      if (cur.med === "ㅖ" && cur.ini !== "ㅇ" && cur.ini !== "ㄹ") must.add("ye");
      const fin = cur.fin;
      if (!fin) return;
      if (!next) {
        if (DOUBLE.has(fin)) must.add("double-finals");
        else if (CHANGES_AT_END.has(fin)) must.add("final-sounds");
        return;
      }
      const ini = next.ini;
      if (ini === "ㅇ") {
        if (fin === "ㅇ") return;
        if ((fin === "ㄷ" || fin === "ㅌ") && next.med === "ㅣ") must.add("palatalization");
        else must.add(H_FINALS.has(fin) ? "h-dropping" : "linking");
        return;
      }
      // ㄶ/ㅀ are explained by the ㅎ rules (aspiration, h-dropping), not the double-final rule.
      if (DOUBLE.has(fin) && !H_FINALS.has(fin)) must.add("double-finals");
      if (H_FINALS.has(fin)) {
        if ("ㄱㄷㅈ".includes(ini)) must.add("aspiration");
        else if (ini === "ㅅ") must.add("tensification");
        else may = true;
        return;
      }
      if (OBSTRUENT.has(fin) || fin === "ㄼ") {
        if (LAX.has(ini)) must.add("tensification");
        else if (ini === "ㄴ" || ini === "ㅁ" || ini === "ㄹ") must.add("nasalization");
        else if (ini === "ㅎ" && fin !== "ㄼ") must.add("aspiration");
        return;
      }
      if ((fin === "ㅁ" || fin === "ㅇ") && ini === "ㄹ") must.add("nasalization");
      else if ((fin === "ㄴ" && ini === "ㄹ") || (fin === "ㄹ" && ini === "ㄴ")) must.add("liquidization");
      // ㄴㅁㄹㅇ + ㄱㄷㅂㅅㅈ: tensification in verb stems, Sino-Korean ㄹ+ㄷㅅㅈ, and compounds.
      else if (LAX.has(ini)) may = true;
    });
  }
  return { must, may };
}

/** Rule ids that explain the same sound change (ㄴ+ㄹ can be [ㄹㄹ] or [ㄴㄴ]). */
const EQUIVALENT: Partial<Record<string, string[]>> = { liquidization: ["nasalization"] };

/** Undo tensification in a pronounced form, where the spelling has the lax consonant. */
const TENSE_TO_LAX: Record<string, string> = { ㄲ: "ㄱ", ㄸ: "ㄷ", ㅃ: "ㅂ", ㅆ: "ㅅ", ㅉ: "ㅈ" };
function untense(pronounced: string, spelling: string): string {
  const p = [...pronounced];
  const s = [...spelling];
  return p
    .map((ch, i) => {
      if (ch === " ") return ch;
      const ps = decompose(ch);
      const ss = decompose(s[i]);
      return TENSE_TO_LAX[ps.ini] === ss.ini ? compose({ ...ps, ini: ss.ini }) : ch;
    })
    .join("");
}

const rom = (s: string, rules: boolean) => romanize(s, { usePronunciationRules: rules, casingOption: "lowercase" });

/**
 * Words where koroman's pronunciation rules are known to be wrong (checked by hand against 표준 발음법).
 * The cross-check is skipped for these.
 */
const KOROMAN_PRONUNCIATION_ERRORS: Record<string, string> = {
  월요일: "koroman inserts ㄴ (wollyoil); standard [워료일]",
  목요일: "koroman inserts ㄴ (mongnyoil); standard [모교일]",
  일요일: "koroman inserts ㄴ (illyoil); standard [이료일]",
  필요하다: "koroman inserts ㄴ (pillyohada); standard [피료하다]",
  따뜻하다: "koroman doesn't aspirate ㅅ+ㅎ (ttatteuthada); standard [따뜨타다]",
  깨끗하다: "koroman doesn't aspirate ㅅ+ㅎ (kkaekkeuthada); standard [깨끄타다]",
  맛없다: "koroman links ㅅ into 없 (maseopda); standard [마덥따] (표준 발음법 제15항)",
};

const forms = (w: CommonWord) => (w.pronounced ? w.pronounced.split("/") : []);

describe("Common Words data", () => {
  it("has about 500 words", () => {
    expect(COMMON_WORDS.length).toBeGreaterThanOrEqual(450);
    expect(COMMON_WORDS.length).toBeLessThanOrEqual(650);
  });

  it("has unique ids, and homonyms have explicit ids", () => {
    const ids = COMMON_WORDS.map((w) => w.id);
    expect(new Set(ids).size).toBe(ids.length);
    const bySpelling = new Map<string, CommonWord[]>();
    for (const w of COMMON_WORDS) bySpelling.set(w.spelling, [...(bySpelling.get(w.spelling) ?? []), w]);
    for (const [spelling, list] of bySpelling) {
      if (list.length > 1) for (const w of list) expect(w.id, spelling).not.toBe(spelling);
    }
  });

  it("has unique meanings, so English → Korean cards have one answer", () => {
    const seen = new Map<string, string>();
    for (const w of COMMON_WORDS) {
      const key = w.meaning.toLowerCase();
      expect(seen.get(key), `"${w.meaning}" is used by ${seen.get(key)} and ${w.id}`).toBeUndefined();
      seen.set(key, w.id);
    }
  });

  it("uses valid categories, parts of speech, levels, rule and letter ids", () => {
    const ruleIds = new Set<string>(RULES.map((r) => r.id));
    for (const w of COMMON_WORDS) {
      expect(CATEGORY_IDS, w.id).toContain(w.category);
      expect(PART_OF_SPEECH_IDS, w.id).toContain(w.pos);
      expect([1, 2], w.id).toContain(w.level);
      for (const r of w.rules ?? []) expect(ruleIds.has(r), `${w.id}: ${r}`).toBe(true);
      for (const l of w.letters ?? []) expect(LETTER_NOTE_IDS, w.id).toContain(l);
      expect(w.spelling, w.id).toMatch(/^[가-힣]+( [가-힣]+)*$/);
    }
  });

  it("only links rules when the pronunciation differs, and explains every pronunciation", () => {
    for (const w of COMMON_WORDS) {
      if (w.rules?.length || w.letters?.length) expect(w.pronounced, w.id).toBeDefined();
      if (w.pronounced) expect((w.rules?.length ?? 0) + (w.letters?.length ?? 0), w.id).toBeGreaterThan(0);
    }
  });

  it("writes each pronunciation with the same syllables and spaces as the spelling", () => {
    for (const w of COMMON_WORDS) {
      for (const f of forms(w)) {
        expect([...f].length, `${w.id}: ${f}`).toBe([...w.spelling].length);
        expect(f.split(" ").map((t) => t.length), `${w.id}: ${f}`).toEqual(w.spelling.split(" ").map((t) => t.length));
      }
      if (w.pronounced) expect(forms(w), w.id).not.toEqual([w.spelling]);
    }
  });

  it("gives a pronunciation, with the right rules, wherever the spelling forces a change", () => {
    const problems: string[] = [];
    for (const w of COMMON_WORDS) {
      const { must } = detect(w.spelling);
      if (must.size && !w.pronounced) problems.push(`${w.id}: missing pronunciation (${[...must].join(", ")})`);
      const linked = new Set<string>([...(w.rules ?? []), ...(w.letters ?? [])]);
      for (const id of must) {
        if (!linked.has(id) && !(EQUIVALENT[id] ?? []).some((e) => linked.has(e))) {
          problems.push(`${w.id}: should link ${id}`);
        }
      }
    }
    expect(problems).toEqual([]);
  });

  it("doesn't give a pronunciation where nothing in the spelling could change", () => {
    const problems = COMMON_WORDS.filter((w) => {
      const { must, may } = detect(w.spelling);
      return w.pronounced && must.size === 0 && !may;
    }).map((w) => w.id);
    expect(problems).toEqual([]);
  });

  it("agrees with koroman's pronunciation rules (tensification aside)", () => {
    const problems: string[] = [];
    for (const w of COMMON_WORDS) {
      if (!w.pronounced || w.letters?.length || KOROMAN_PRONUNCIATION_ERRORS[w.spelling]) continue;
      const expected = rom(w.spelling, true);
      // Re-applying koroman's rules to the pronounced form only normalizes final sounds (옫 → ot).
      const got = forms(w).map((f) => rom(untense(f, w.spelling), true));
      if (!got.includes(expected)) problems.push(`${w.id}: [${w.pronounced}] → ${got.join("/")}, koroman: ${expected}`);
    }
    expect(problems).toEqual([]);
  });

  it("matches words.ts wherever a word appears in both", () => {
    const problems: string[] = [];
    for (const w of COMMON_WORDS) {
      const other = (WORDS as Record<string, { pronounced?: string; romanization: string }>)[w.spelling];
      if (!other) continue;
      if ((other.pronounced ?? "") !== (w.pronounced ?? "")) {
        problems.push(`${w.id}: pronounced [${w.pronounced ?? ""}] vs words.ts [${other.pronounced ?? ""}]`);
      }
      if (other.romanization.toLowerCase() !== w.romanization.toLowerCase()) {
        problems.push(`${w.id}: ${w.romanization} vs words.ts ${other.romanization}`);
      }
    }
    expect(problems).toEqual([]);
  });

  it("has an up-to-date generated romanization for every word (run `npm run words:romanize`)", () => {
    for (const w of COMMON_WORDS) expect(COMMON_WORD_ROMANIZATION[w.spelling], w.id).toBe(romanizeCommonWord(w.spelling));
  });

  it("shares its rule ids with the Rules page", () => {
    expect([...RULE_IDS_FOR_WORDS].sort()).toEqual(RULES.map((r) => r.id as RuleId).sort());
  });
});

describe("pronunciation detector", () => {
  it.each([
    ["학교", ["tensification"]],
    ["음악", ["linking"]],
    ["좋다", ["aspiration"]],
    ["많이", ["h-dropping"]],
    ["같이", ["palatalization"]],
    ["많다", ["aspiration"]],
    ["국물", ["nasalization"]],
    ["연락", ["liquidization"]],
    ["값", ["double-finals"]],
    ["옷", ["final-sounds"]],
    ["희망", ["ui"]],
    ["시계", ["ye"]],
    ["사람", []],
  ])("%s → %j", (word, ids) => {
    expect([...detect(word).must].sort()).toEqual([...ids].sort());
  });

  it("marks possible-but-unpredictable tensification", () => {
    expect(detect("신다")).toEqual({ must: new Set(), may: true });
  });

  it("undoes tensification only where the spelling is lax", () => {
    expect(untense("학꾜", "학교")).toBe("학교");
    expect(untense("색깔", "색깔")).toBe("색깔");
  });
});
