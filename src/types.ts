export type Difficulty = "beginner" | "intermediate" | "advanced";
export type Length = "short" | "medium" | "long";

export interface GenerateRequest {
  difficulty: Difficulty;
  length: Length;
  topic?: string;
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
}

export interface GenerateResponse {
  paragraph: string;
  /** English translation of the paragraph ("" if the generator couldn't give one). */
  translation: string;
  /** The translation sentence by sentence (may be empty or missing). */
  sentences?: SentenceTranslation[];
  words: Word[];
}
