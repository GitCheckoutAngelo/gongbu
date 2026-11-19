/**
 * Small, dependency-free vocabulary metadata shared by the frontend and the Worker
 * (the word-suggestion endpoint validates against these lists).
 */
import type { RuleId } from "./types";

export const CATEGORIES = [
  { id: "people", label: "People & family", ko: "사람" },
  { id: "body-health", label: "Body & health", ko: "몸" },
  { id: "food", label: "Food & drink", ko: "음식" },
  { id: "home", label: "Home & things", ko: "집" },
  { id: "places", label: "Places & transport", ko: "장소" },
  { id: "time", label: "Time & calendar", ko: "시간" },
  { id: "numbers", label: "Numbers & counters", ko: "숫자" },
  { id: "nature", label: "Weather & nature", ko: "날씨" },
  { id: "school-work", label: "School & work", ko: "학교" },
  { id: "shopping", label: "Shopping & money", ko: "쇼핑" },
  { id: "hobbies", label: "Hobbies & leisure", ko: "취미" },
  { id: "actions", label: "Everyday verbs", ko: "동사" },
  { id: "descriptions", label: "Describing words", ko: "형용사" },
  { id: "adverbs", label: "Adverbs & connectors", ko: "부사" },
  { id: "questions", label: "Pronouns & question words", ko: "대명사" },
  { id: "expressions", label: "Greetings & expressions", ko: "표현" },
] as const;

export type CategoryId = (typeof CATEGORIES)[number]["id"];
export const CATEGORY_IDS = CATEGORIES.map((c) => c.id) as CategoryId[];

export const PARTS_OF_SPEECH = [
  { id: "noun", label: "noun" },
  { id: "verb", label: "verb" },
  { id: "adjective", label: "adjective (descriptive verb)" },
  { id: "adverb", label: "adverb" },
  { id: "conjunction", label: "conjunction (connecting adverb)" },
  { id: "pronoun", label: "pronoun" },
  { id: "determiner", label: "determiner" },
  { id: "numeral", label: "number" },
  { id: "counter", label: "counter" },
  { id: "interjection", label: "interjection" },
  { id: "expression", label: "expression" },
] as const;

export type PartOfSpeech = (typeof PARTS_OF_SPEECH)[number]["id"];
export const PART_OF_SPEECH_IDS = PARTS_OF_SPEECH.map((p) => p.id) as PartOfSpeech[];

/** TOPIK levels: TOPIK I is 1급–2급, TOPIK II is 3급–6급. */
export const LEVELS = [1, 2, 3, 4, 5, 6] as const;
export type Level = (typeof LEVELS)[number];

/** Level bands, matching the Reader's difficulty (Beginner / Intermediate / Advanced). */
export const LEVEL_BANDS = [
  { id: "beginner", label: "Beginner", levels: [1, 2] },
  { id: "intermediate", label: "Intermediate", levels: [3, 4] },
  { id: "advanced", label: "Advanced", levels: [5, 6] },
] as const satisfies readonly { id: string; label: string; levels: readonly Level[] }[];
export type LevelBand = (typeof LEVEL_BANDS)[number]["id"];
export const LEVEL_BAND_IDS = LEVEL_BANDS.map((b) => b.id) as LevelBand[];

/** Every rule card on the Rules page, with a one-line summary (used in the word-suggestion prompt). */
export const RULE_SUMMARIES: Record<RuleId, string> = {
  "block-structure": "syllable block structure",
  "final-sounds": "final consonants reduce to 7 sounds (옷 → [옫])",
  "double-finals": "double final consonants keep one sound (값 → [갑], 닭 → [닥])",
  linking: "a final consonant moves to a following vowel (음악 → [으막])",
  nasalization: "ㄱㄷㅂ before ㄴㅁ become ㅇㄴㅁ; ㄹ after ㅁㅇ becomes ㄴ (국물 → [궁물])",
  liquidization: "ㄴ next to ㄹ becomes ㄹ (연락 → [열락])",
  tensification: "consonants become tense (학교 → [학꾜], 먹다 → [먹따])",
  aspiration: "ㅎ next to ㄱㄷㅂㅈ makes ㅋㅌㅍㅊ (좋다 → [조타])",
  palatalization: "ㄷ/ㅌ before 이 become ㅈ/ㅊ (같이 → [가치])",
  "h-dropping": "ㅎ is silent before a vowel (좋아요 → [조아요])",
};
export const RULE_IDS_FOR_WORDS = Object.keys(RULE_SUMMARIES) as RuleId[];

/** Letters whose context-dependent sound isn't a rule card; their notes are on the Hangul page. */
export const LETTER_NOTES = {
  ui: { char: "ㅢ", summary: "ㅢ after a consonant is [ㅣ]; in later syllables [의] or [이]" },
  ye: { char: "ㅖ", summary: "ㅖ after a consonant (except ㄹ) may be [ㅔ]" },
} as const;
export type LetterNoteId = keyof typeof LETTER_NOTES;
export const LETTER_NOTE_IDS = Object.keys(LETTER_NOTES) as LetterNoteId[];
