/**
 * Provider-independent checks on suggested words. Anything malformed is dropped rather than shown,
 * because the learner will memorize what gets approved.
 */
import {
  LETTER_NOTE_IDS,
  LEVEL_BANDS,
  PART_OF_SPEECH_IDS,
  RULE_IDS_FOR_WORDS,
  type LetterNoteId,
  type Level,
  type LevelBand,
  type PartOfSpeech,
} from "../../../src/data/vocabularyMeta";
import type { RuleId } from "../../../src/data/types";
import type { SuggestedWord } from "./types";

/** Hangul syllables, optionally several words separated by single spaces. */
const HANGUL_WORDS = /^[가-힣]+(?: [가-힣]+)*$/;
const MAX_SPELLING = 20;
const MAX_MEANING = 80;
const MAX_NOTE = 200;

const tidy = (v: unknown) => (typeof v === "string" ? v.trim().replace(/\s+/g, " ") : "");

function pick<T extends string | number>(values: unknown, allowed: readonly T[]): T[] {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.filter((v): v is T => (allowed as readonly unknown[]).includes(v)))];
}

/** Validate one raw suggestion; returns null if it can't be used. The level is kept inside `band`. */
export function validateSuggestion(raw: unknown, band: LevelBand = "beginner"): SuggestedWord | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const spelling = tidy(r.spelling);
  const meaning = tidy(r.meaning);
  if (!HANGUL_WORDS.test(spelling) || spelling.length > MAX_SPELLING) return null;
  if (!meaning || meaning.length > MAX_MEANING) return null;
  if (!(PART_OF_SPEECH_IDS as unknown[]).includes(r.pos)) return null;
  const allowed = LEVEL_BANDS.find((b) => b.id === band)!.levels as readonly Level[];
  const asked = typeof r.level === "number" ? r.level : NaN;
  // Inside the band as given; outside it (or missing), the nearest level in the band.
  const level: Level = allowed.includes(asked as Level)
    ? (asked as Level)
    : asked < allowed[0]
      ? allowed[0]
      : allowed[allowed.length - 1];

  // Each "/"-separated pronunciation must be Hangul; drop it if it just repeats the spelling.
  const forms = tidy(r.pronounced)
    .split("/")
    .map((f) => f.trim())
    .filter(Boolean);
  if (forms.some((f) => !HANGUL_WORDS.test(f))) return null;
  const pronounced = forms.length && !(forms.length === 1 && forms[0] === spelling) ? forms.join("/") : undefined;

  const note = tidy(r.note).slice(0, MAX_NOTE) || undefined;
  return {
    spelling,
    meaning,
    pos: r.pos as PartOfSpeech,
    level,
    pronounced,
    // A rule link only makes sense when the pronunciation differs.
    rules: pronounced ? pick<RuleId>(r.rules, RULE_IDS_FOR_WORDS) : [],
    letters: pronounced ? pick<LetterNoteId>(r.letters, LETTER_NOTE_IDS) : [],
    note,
  };
}

/** Validate a list, dropping malformed entries, duplicates and anything in `exclude`. */
export function validateSuggestions(
  raw: unknown,
  exclude: string[],
  max: number,
  band: LevelBand = "beginner",
): SuggestedWord[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set(exclude);
  const out: SuggestedWord[] = [];
  for (const item of raw) {
    const word = validateSuggestion(item, band);
    if (!word || seen.has(word.spelling)) continue;
    seen.add(word.spelling);
    out.push(word);
    if (out.length >= max) break;
  }
  return out;
}
