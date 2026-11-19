/**
 * The Reader's state, kept while you visit other tabs (in memory) and across a refresh of the same
 * browser tab (sessionStorage). Closing the tab starts fresh.
 */
import type { Difficulty, GenerateResponse, Length } from "../types";

export interface ReaderSnapshot {
  difficulty: Difficulty;
  length: Length;
  topic: string;
  result: GenerateResponse | null;
  /** Settings the paragraph on screen was made with. */
  used: { difficulty: Difficulty; length: Length; topic: string } | null;
  showRomanized: boolean;
  showTranslation: boolean;
  /** Where Play/Resume continues from. */
  resumeWord: number;
}

const KEY = "korean-reader.reader";
let memory: ReaderSnapshot | null = null;

export function loadReaderSnapshot(): ReaderSnapshot | null {
  if (memory) return memory;
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Partial<ReaderSnapshot>;
    // Light validation: anything malformed just starts fresh.
    if (!s || typeof s !== "object" || typeof s.topic !== "string") return null;
    if (s.result && (!Array.isArray(s.result.words) || typeof s.result.paragraph !== "string")) return null;
    memory = s as ReaderSnapshot;
    return memory;
  } catch {
    return null;
  }
}

export function saveReaderSnapshot(snapshot: ReaderSnapshot): void {
  memory = snapshot;
  try {
    sessionStorage.setItem(KEY, JSON.stringify(snapshot));
  } catch {
    // storage unavailable or full: the in-memory copy still covers tab switches
  }
}
