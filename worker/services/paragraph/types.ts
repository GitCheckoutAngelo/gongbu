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
}

export interface ParagraphGenerator {
  generate(difficulty: Difficulty, length: Length, topic: string | undefined): Promise<GeneratedParagraph>;
}

export const paragraphRegistry = new Registry<ParagraphGenerator>("paragraph generator");
