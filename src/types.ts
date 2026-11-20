import type { GrammarPattern, Politeness } from "./data/grammarMeta";

export type Difficulty = "beginner" | "intermediate" | "advanced";
export type Length = "short" | "medium" | "long";

/** Grammar practice settings for a generated text. */
export interface GrammarRequest {
  /** Pattern id. */
  pattern: string;
  /** A preset setting's id (its scene is used), or omitted. */
  settingId?: string;
  /** Your own setting in words (when there's no settingId; omitted with neither: a random preset). */
  setting?: string;
  politeness: Politeness;
}

export interface GenerateRequest {
  difficulty: Difficulty;
  length: Length;
  topic?: string;
  grammar?: GrammarRequest;
}

/** What a grammar-practice text practises (returned with it, and kept when it's saved). */
export interface PracticeInfo {
  pattern: GrammarPattern;
  /** The setting's name ("" when it was chosen at random). */
  setting: string;
  /** The scene, in English: who A and B are and what's happening. */
  scene?: string;
  /** Dialogue: who each speaker is, e.g. { A: "customer", B: "barista" }. */
  roles?: { A: string; B: string };
  politeness: Politeness;
  format: "dialogue" | "prose";
}

export interface Word {
  korean: string;
  romanized: string;
  /** Short English gloss of the word in context ("" if unknown). */
  english: string;
}

/** One sentence's translation and the words it covers: [start, end) indices into `words`. */
export interface SentenceTranslation {
  english: string;
  start: number;
  end: number;
  /** In a dialogue, who says this sentence. */
  speaker?: "A" | "B";
}

export interface GenerateResponse {
  paragraph: string;
  /** English translation of the paragraph ("" if the generator couldn't give one). */
  translation: string;
  /** The translation sentence by sentence (may be empty or missing). */
  sentences?: SentenceTranslation[];
  words: Word[];
  /** Grammar practice: indices of the words that use the pattern. */
  highlights?: number[];
  /** Grammar practice: the pattern, setting and politeness it was written for. */
  practice?: PracticeInfo;
}
