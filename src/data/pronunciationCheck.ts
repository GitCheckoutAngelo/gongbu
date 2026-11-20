/**
 * Pronunciation checks for vocabulary entries, shared by the Common Words tests and the word-list
 * scripts (and usable on the server for added words). A word's spelling often *forces* a sound change
 * under 표준 발음법; these checks catch a missing or wrong pronunciation:
 *
 * 1. A small detector finds where the spelling must change the sound (an obstruent final before
 *    ㄱㄷㅂㅅㅈ, a final before ㅇ, ㅢ after a consonant…). Those words need a pronunciation and the
 *    matching rule links. A pronunciation where nothing could change is flagged too.
 * 2. Cross-check: each pronunciation, with tensification undone, must romanize like koroman romanizes
 *    the spelling with pronunciation rules (an independent implementation of the same rules).
 */
import { romanize } from "koroman";

// ---------- Hangul decomposition

const INITIALS = [..."ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ"];
const MEDIALS = [..."ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ"];
const FINALS = ["", ..."ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ"];

interface Syllable {
  ini: string;
  med: string;
  fin: string;
}

export function decompose(ch: string): Syllable {
  const code = ch.charCodeAt(0) - 0xac00;
  if (code < 0 || code > 11171) throw new Error(`not a Hangul syllable: ${ch}`);
  return { ini: INITIALS[Math.floor(code / 588)], med: MEDIALS[Math.floor((code % 588) / 28)], fin: FINALS[code % 28] };
}

export function compose({ ini, med, fin }: Syllable): string {
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
export function detect(spelling: string): { must: Set<string>; may: boolean } {
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
export const EQUIVALENT: Partial<Record<string, string[]>> = { liquidization: ["nasalization"] };

/** Undo tensification in a pronounced form, where the spelling has the lax consonant. */
const TENSE_TO_LAX: Record<string, string> = { ㄲ: "ㄱ", ㄸ: "ㄷ", ㅃ: "ㅂ", ㅆ: "ㅅ", ㅉ: "ㅈ" };
export function untense(pronounced: string, spelling: string): string {
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

export const rom = (s: string, rules: boolean) =>
  romanize(s, { usePronunciationRules: rules, casingOption: "lowercase" });

/**
 * Words where koroman's pronunciation rules are known to be wrong (checked by hand against 표준 발음법).
 * The cross-check is skipped for these.
 */
export const KOROMAN_PRONUNCIATION_ERRORS: Record<string, string> = {
  월요일: "koroman inserts ㄴ (wollyoil); standard [워료일]",
  목요일: "koroman inserts ㄴ (mongnyoil); standard [모교일]",
  일요일: "koroman inserts ㄴ (illyoil); standard [이료일]",
  필요: "koroman inserts ㄴ (pillyo); standard [피료]",
  필요하다: "koroman inserts ㄴ (pillyohada); standard [피료하다]",
  따뜻하다: "koroman doesn't aspirate ㅅ+ㅎ (ttatteuthada); standard [따뜨타다]",
  깨끗하다: "koroman doesn't aspirate ㅅ+ㅎ (kkaekkeuthada); standard [깨끄타다]",
  없이: "koroman doesn't tense the linked ㅅ (eopsi); standard [업씨]",
  맛없다: "koroman links ㅅ into 없 (maseopda); standard [마덥따] (표준 발음법 제15항)",
};

/**
 * Words whose standard pronunciation tenses a consonant that the spelling gives no clue for (Sino-Korean
 * words such as 사건 [사껀]); the detector can't predict these. Checked against 표준국어대사전.
 */
export const UNPREDICTABLE_TENSIFICATION: Record<string, string> = {
  사건: "[사껀] (事件)",
};

/** The fields the checks look at. */
export interface PronouncedEntry {
  id: string;
  spelling: string;
  pronounced?: string;
  rules?: readonly string[];
  letters?: readonly string[];
}

/** Every pronunciation problem with one entry (empty if none). Same checks as the Common Words tests. */
export function pronunciationProblems(w: PronouncedEntry): string[] {
  const problems: string[] = [];
  const forms = w.pronounced ? w.pronounced.split("/") : [];
  const linked = new Set<string>([...(w.rules ?? []), ...(w.letters ?? [])]);
  if (linked.size && !w.pronounced) problems.push("links rules but has no pronunciation");
  if (w.pronounced && linked.size === 0) problems.push("has a pronunciation but no rule explains it");
  for (const f of forms) {
    const sameShape =
      [...f].length === [...w.spelling].length &&
      f
        .split(" ")
        .map((t) => t.length)
        .join() ===
        w.spelling
          .split(" ")
          .map((t) => t.length)
          .join();
    if (!sameShape) problems.push(`[${f}] doesn't have the spelling's syllables and spaces`);
  }
  const { must, may } = detect(w.spelling);
  if (must.size && !w.pronounced) problems.push(`missing pronunciation (${[...must].join(", ")})`);
  for (const id of must) {
    if (!linked.has(id) && !(EQUIVALENT[id] ?? []).some((e) => linked.has(e))) problems.push(`should link ${id}`);
  }
  if (w.pronounced && must.size === 0 && !may && !UNPREDICTABLE_TENSIFICATION[w.spelling]) {
    problems.push("pronunciation given where nothing can change");
  }
  if (w.pronounced && !w.letters?.length && !KOROMAN_PRONUNCIATION_ERRORS[w.spelling] && problems.length === 0) {
    const expected = rom(w.spelling, true);
    const got = forms.map((f) => rom(untense(f, w.spelling), true));
    if (!got.includes(expected)) problems.push(`[${w.pronounced}] → ${got.join("/")}, koroman: ${expected}`);
  }
  return problems;
}

/**
 * The main sense of an English meaning, for spotting synonyms that would make an English → Korean card
 * ambiguous: the first gloss, lower-case, without hints in brackets ("really; truly (emphatic)" → "really").
 */
export function mainSense(meaning: string): string {
  return meaning
    .toLowerCase()
    .replace(/\([^)]*\)/g, "")
    .split(/[;,]/)[0]
    .replace(/^to /, "")
    .trim();
}
