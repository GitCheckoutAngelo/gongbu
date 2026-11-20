/**
 * Grammar practice: shared definitions for the frontend and the Worker (dependency-free).
 * The patterns themselves are in data/grammarPatterns.json (loaded into the database, served by /api/grammar).
 */

/** What a pattern does. Similar patterns share a group, so learners can compare them side by side. */
export const GRAMMAR_GROUPS = [
  { id: "basics", label: "Basic sentences" },
  { id: "particles", label: "Little words after nouns" },
  { id: "asking", label: "Asking, inviting & requesting" },
  { id: "plans", label: "Wanting, planning & trying" },
  { id: "ability", label: "Can, must & may" },
  { id: "linking", label: "And, then & while" },
  { id: "reason", label: "Giving reasons" },
  { id: "when", label: "If & when" },
  { id: "contrast", label: "But & even though" },
  { id: "comparing", label: "Comparing & describing" },
  { id: "reacting", label: "Guessing & reacting" },
  { id: "quoting", label: "Telling what someone said" },
] as const;
export type GrammarGroupId = (typeof GRAMMAR_GROUPS)[number]["id"];
export const GRAMMAR_GROUP_IDS = GRAMMAR_GROUPS.map((g) => g.id) as GrammarGroupId[];

/** Where a pattern is used: mostly conversation, mostly writing, or both. Decides dialogue vs prose. */
export const PATTERN_REGISTERS = [
  { id: "spoken", label: "spoken" },
  { id: "written", label: "written" },
  { id: "both", label: "spoken & written" },
] as const;
export type PatternRegister = (typeof PATTERN_REGISTERS)[number]["id"];
export const PATTERN_REGISTER_IDS = PATTERN_REGISTERS.map((r) => r.id) as PatternRegister[];

/** Who's speaking to whom: the same pattern takes a different ending (갈까? / 갈까요? / 가시겠습니까?). */
export const POLITENESS = [
  { id: "casual", label: "Casual", ko: "반말", short: "friends", hint: "With a close friend or someone younger" },
  {
    id: "polite",
    label: "Polite",
    ko: "해요",
    short: "everyday",
    hint: "Everyday polite: shop staff, colleagues, strangers",
  },
  {
    id: "formal",
    label: "Formal",
    ko: "합쇼",
    short: "boss, announcements",
    hint: "Formal: a boss, announcements, interviews",
  },
] as const;
export type Politeness = (typeof POLITENESS)[number]["id"];
export const POLITENESS_IDS = POLITENESS.map((p) => p.id) as Politeness[];

/** Groups for the setting menu. */
export const SETTING_GROUPS = [
  { id: "food", label: "Eating & drinking" },
  { id: "out", label: "Out & about" },
  { id: "errands", label: "Shopping & errands" },
  { id: "work", label: "Work & study" },
  { id: "home", label: "Home & friends" },
  { id: "leisure", label: "Health & leisure" },
] as const;

/**
 * Everyday settings: the places and moments the scenario library (data/scenarios.json) is organised by.
 */
export const PRACTICE_SETTINGS = [
  {
    id: "cafe",
    label: "At a café",
    group: "food",
  },
  {
    id: "restaurant",
    label: "At a restaurant",
    group: "food",
  },
  {
    id: "market",
    label: "At the market",
    group: "food",
  },
  {
    id: "walk",
    label: "Going for a walk",
    group: "out",
  },
  {
    id: "travel",
    label: "On a trip",
    group: "out",
  },
  {
    id: "transport",
    label: "On the bus or subway",
    group: "out",
  },
  {
    id: "directions",
    label: "Asking for directions",
    group: "out",
  },
  {
    id: "hotel",
    label: "At a hotel",
    group: "out",
  },
  {
    id: "shopping",
    label: "Shopping for clothes",
    group: "errands",
  },
  {
    id: "errands",
    label: "At the bank or post office",
    group: "errands",
  },
  {
    id: "work",
    label: "At work",
    group: "work",
  },
  {
    id: "class",
    label: "In class",
    group: "work",
  },
  {
    id: "family",
    label: "At home with family",
    group: "home",
  },
  {
    id: "texting",
    label: "Texting a friend",
    group: "home",
  },
  {
    id: "phone",
    label: "On the phone",
    group: "home",
  },
  {
    id: "party",
    label: "At a party",
    group: "home",
  },
  {
    id: "plans",
    label: "Making weekend plans",
    group: "home",
  },
  {
    id: "doctor",
    label: "At the doctor's",
    group: "leisure",
  },
  {
    id: "gym",
    label: "At the gym",
    group: "leisure",
  },
  {
    id: "weather",
    label: "Talking about the weather",
    group: "leisure",
  },
] as const;

/**
 * A realistic situation to practise in (data/scenarios.json): what happens, who A and B are, the speech levels
 * it naturally happens at, and the kinds of things said in it (grammar groups), used to match patterns.
 */
export interface Scenario {
  /** "setting/slug", e.g. "cafe/oat-milk". */
  id: string;
  setting: string;
  situation: string;
  roles: { A: string; B: string };
  politeness: Politeness[];
  functions: GrammarGroupId[];
}

/** A grammar pattern (from the database). */
export interface GrammarPattern {
  /** Stable id: the pattern as written, e.g. "-(으)ㄹ까요?". */
  id: string;
  /** How textbooks write it (shown small, for learners who want it), e.g. "N(으)로". */
  form: string;
  /** Plain title, e.g. "by, using, towards". */
  title: string;
  /** One plain sentence, no grammar terms: what it does, with a mini example. */
  explain: string;
  /** A tiny example chunk, e.g. { ko: "버스로", en: "by bus", rom: "beoseuro" } (rom: how it's read). */
  sample: { ko: string; en: string; rom?: string };
  /** Short English meaning, e.g. "shall we…? / shall I…?". */
  meaning: string;
  /** TOPIK level (1-4 for now). */
  level: number;
  group: GrammarGroupId;
  register: PatternRegister;
  /** How it attaches, in English (after a vowel / consonant, to verbs / adjectives / nouns). */
  attaches: string;
  /** Example sentences; `part` is the piece of `ko` that is the pattern (highlighted). */
  examples: { ko: string; en: string; part: string; rom?: string }[];
  /** Similar patterns to compare with (ids). */
  similar: string[];
  note?: string;
  /** Speech levels it's naturally used at (e.g. -아/어 주시겠어요? only polite and formal). Absent = all. */
  speechLevels?: Politeness[];
  /** Near-variants merged into this item (e.g. N부터 N까지 under N에서 N까지), shown on its card. */
  variants?: { form: string; title: string }[];
  /** Ids the variants used to have, so an earlier choice of one still finds this item. */
  aliases?: string[];
  /** (Build only) the variants' draft keys, so their ids stay stable across rebuilds. */
  aliasKeys?: string[];
}
