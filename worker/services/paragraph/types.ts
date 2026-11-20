import type { GrammarPattern, Politeness } from "../../../src/data/grammarMeta";
import { Registry } from "../../registry";

export const DIFFICULTIES = ["beginner", "intermediate", "advanced"] as const;
export const LENGTHS = ["short", "medium", "long"] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];
export type Length = (typeof LENGTHS)[number];

/** One sentence's translation, and which words of the paragraph it covers ([start, end) word indices). */
export interface SentenceTranslation {
  english: string;
  start: number;
  end: number;
  /** In a dialogue, who says this sentence ("A" or "B"). */
  speaker?: "A" | "B";
}

/** Grammar practice: write the text around one pattern, in a setting, at a politeness level. */
export interface GrammarPractice {
  pattern: Pick<GrammarPattern, "form" | "meaning" | "attaches" | "variants">;
  /** e.g. "At a café", or the learner's own words; undefined = let the writer choose. */
  setting?: string;
  /** A concrete scene (who A and B are, what's happening), for preset settings. */
  scene?: string;
  politeness: Politeness;
  /** A two-person dialogue (spoken patterns) or prose (written ones). */
  format: "dialogue" | "prose";
}

export interface GeneratedParagraph {
  /** A single Korean paragraph (Korean text only). */
  paragraph: string;
  /** A natural English translation of the paragraph ("" if the provider couldn't give one). */
  translation: string;
  /** A short English gloss for each space-separated word of `paragraph`, in order ("" if unknown). */
  glosses: string[];
  /** The translation sentence by sentence, mapped to the paragraph's words (empty if unavailable). */
  sentences: SentenceTranslation[];
  /** Grammar practice: indices of the words that use the practised pattern. */
  highlights?: number[];
  /** Grammar practice: the scene in one English line, and (dialogues) who A and B are. */
  scene?: string;
  roles?: { A: string; B: string };
}

export interface ParagraphGenerator {
  generate(
    difficulty: Difficulty,
    length: Length,
    topic: string | undefined,
    practice?: GrammarPractice,
  ): Promise<GeneratedParagraph>;
}

export const paragraphRegistry = new Registry<ParagraphGenerator>("paragraph generator");
