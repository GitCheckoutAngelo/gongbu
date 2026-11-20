/**
 * The Reader's state, kept while you visit other tabs (in memory) and across a refresh of the same
 * browser tab (sessionStorage). Closing the tab starts fresh.
 */
import type { PracticeSource } from "../components/grammar/GrammarForm";
import type { Politeness } from "../data/grammarMeta";
import type { Difficulty, GenerateResponse, Length } from "../types";

export interface ReaderSnapshot {
  difficulty: Difficulty;
  length: Length;
  topic: string;
  result: GenerateResponse | null;
  /** Settings the paragraph on screen was made with. */
  used: ReaderSettings | null;
  showRomanized: boolean;
  showTranslation: boolean;
  /** Where Play/Resume continues from. */
  resumeWord: number;
  /** The saved copy of the paragraph on screen (from Save or the saved list), if any. */
  savedId?: string | null;
  /** Free writing, or practising a grammar pattern. */
  mode?: "free" | "grammar";
  grammar?: {
    patternId: string | null;
    /** "library" (ready-made) or "custom" (your own situation); older snapshots had a setting id here. */
    source?: PracticeSource;
    customSetting: string;
    politeness: Politeness;
  };
}

/** What a text was made with (Regenerate reuses it). */
export interface ReaderSettings {
  difficulty: Difficulty;
  length: Length;
  topic: string;
  /** Grammar practice: pattern id and its plain title, the situation and politeness, and (ready-made) which conversation. */
  grammar?: {
    pattern: string;
    label: string;
    setting: string;
    politeness: Politeness;
    source?: PracticeSource;
    /** Ready-made: the conversation on screen (Next shows the one after it). */
    conversationId?: string;
    /** Ready-made: its place among the pattern's conversations at this level (1-based), and how many there are. */
    conversationAt?: number;
    conversationCount?: number;
  };
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
