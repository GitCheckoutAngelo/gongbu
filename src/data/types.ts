/** Shared types for the static Hangul / pronunciation-rule content. */
import type { WordKey } from "./words";

export type RuleId =
  | "block-structure"
  | "final-sounds"
  | "double-finals"
  | "linking"
  | "nasalization"
  | "liquidization"
  | "tensification"
  | "aspiration"
  | "palatalization"
  | "h-dropping";

export type JamoCategory = "basic-consonant" | "double-consonant" | "basic-vowel" | "compound-vowel";

interface JamoBase {
  /** URL-safe id used in links, e.g. /hangul#giyeok. */
  id: string;
  char: string;
  category: JamoCategory;
  /** Letter name in Hangul, e.g. 기역. */
  name: string;
  nameRomanization: string;
  /** Pronunciation of the name when it differs from its spelling, e.g. 시옷 → 시옫. */
  namePronounced?: string;
  /** Approximate description for English speakers. */
  sound: string;
  ipa: string;
  /** Example words (keys into WORDS). */
  examples: WordKey[];
  notes?: string[];
}

export interface Consonant extends JamoBase {
  kind: "consonant";
  romanization: { initial: string; final: string | null };
  /** Consonant + ㅏ, used for audio, e.g. 가. */
  withVowel: string;
  /** ㅏ + consonant as a final, used for audio, e.g. 악. Null if it's never a final. */
  asFinal: { syllable: string; pronounced: string } | null;
}

export interface Vowel extends JamoBase {
  kind: "vowel";
  romanization: string;
  /** ㅇ + vowel, used for audio, e.g. 아. (For vowels this is also the letter name.) */
  withIeung: string;
}

export type Jamo = Consonant | Vowel;

/** An example on a rule card. */
export interface RuleExample {
  word: WordKey;
  note?: string;
}

/**
 * Where the changing letter sits:
 * - "initial": first consonant of a syllable; changed by the PREVIOUS syllable's final.
 * - "final": final consonant (받침); changed by the NEXT syllable's first sound.
 * - "vowel": a vowel whose sound depends on its context.
 */
export type ChangePosition = "initial" | "final" | "vowel";

export interface SoundChangeTarget {
  /** What the letter sounds like in this context, e.g. "[ㄲ] tense k". */
  becomes: string;
  /** The jamo it turns into, when it turns into another letter (used for cross-links). */
  result?: string;
  example: WordKey;
  note?: string;
}

/** One context that changes how some letters sound, e.g. "after a k/t/p-sounding final, ㄱ→ㄲ, ㄷ→ㄸ…". */
export interface SoundChange {
  position: ChangePosition;
  /** The neighbor/context, shown in the table's first column. */
  when: string;
  /** Jamo in the neighboring position that trigger this change (used for cross-links). */
  neighbors?: string[];
  /** 1 = common (shown by default), 2 = less common, 3 = rare. */
  frequency: 1 | 2 | 3;
  /** Affected letter → what happens to it. */
  targets: Partial<Record<string, SoundChangeTarget>>;
}

export interface PronunciationRule {
  /** Also the URL hash: /rules#nasalization */
  id: RuleId;
  title: string;
  koreanTitle: string;
  /** Article(s) of 표준 발음법 (Standard Pronunciation), when applicable. */
  reference?: string;
  /** Plain-English explanation. */
  explanation: string;
  formulas: string[];
  examples: RuleExample[];
  notes?: string[];
  /** Structured data: which letters this rule changes, where, and what triggers it. */
  changes: SoundChange[];
}

/** Context-dependent sounds that aren't one of the rule cards (basic sounds, vowel variants). */
export interface BasicSoundChange extends SoundChange {
  /** Shown in the Rule column instead of a rule link, e.g. "표준 발음법 제5항". */
  reference?: string;
}

export interface SyllableBlockExample {
  syllable: string;
  initial: string;
  vowel: string;
  final?: string;
  /** Where the vowel sits relative to the initial consonant. */
  layout: "side" | "below" | "wrap";
  /** For "wrap" layouts: the lower and right parts of the vowel, e.g. ㅘ → ["ㅗ", "ㅏ"]. */
  vowelParts?: [string, string];
  romanization: string;
  pronounced?: string;
}
