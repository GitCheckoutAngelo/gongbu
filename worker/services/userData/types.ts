/**
 * Where per-learner data lives (Common Words progress, saved Reader paragraphs). The Worker uses
 * Cloudflare D1 (./d1.ts); tests use the in-memory store (./memory.ts). Every call is scoped to one
 * owner: the browser's sync key.
 */

export interface SavedParagraphSummary {
  id: string;
  createdAt: number;
  difficulty: string;
  length: string;
  topic: string;
  preview: string;
}

export interface SavedParagraph extends SavedParagraphSummary {
  /** The paragraph as shown in the Reader (JSON). */
  data: string;
}

export interface UserDataStore {
  getProgress(owner: string): Promise<string | null>;
  putProgress(owner: string, data: string, now: number): Promise<void>;
  listParagraphs(owner: string): Promise<SavedParagraphSummary[]>;
  countParagraphs(owner: string): Promise<number>;
  getParagraph(owner: string, id: string): Promise<SavedParagraph | null>;
  addParagraph(owner: string, paragraph: SavedParagraph): Promise<void>;
  /** Returns false if there was no such paragraph. */
  deleteParagraph(owner: string, id: string): Promise<boolean>;
}
