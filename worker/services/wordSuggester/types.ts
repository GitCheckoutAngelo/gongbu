import type { CategoryId, LetterNoteId, Level, LevelBand, PartOfSpeech } from "../../../src/data/vocabularyMeta";
import type { RuleId } from "../../../src/data/types";
import { Registry } from "../../registry";

export interface SuggestRequest {
  category: CategoryId;
  /** Beginner (TOPIK 1-2), intermediate (3-4) or advanced (5-6). */
  band: LevelBand;
  /** How many words to suggest (1-10). */
  count: number;
  /** Spellings already in the learner's list; never suggested again. */
  exclude: string[];
}

/** A suggested word, already validated. Romanization is added by the API layer. */
export interface SuggestedWord {
  spelling: string;
  meaning: string;
  pos: PartOfSpeech;
  level: Level;
  /** Standard pronunciation in Hangul, only when it differs from the spelling ("/" separates allowed forms). */
  pronounced?: string;
  rules: RuleId[];
  letters: LetterNoteId[];
  /** Anything the learner should double-check. */
  note?: string;
}

export interface WordSuggester {
  suggest(request: SuggestRequest): Promise<SuggestedWord[]>;
}

export const wordSuggesterRegistry = new Registry<WordSuggester>("word suggester");
