/**
 * Shared state for the Common Words pages: the word list (built-in + approved additions) and the
 * learner's progress, loaded from and saved to the configured ProgressStore.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { COMMON_WORDS, type CommonWord } from "../../data/commonWords";
import { getProgressStore } from "../../services/progress/registry";
import type { Progress } from "../../services/progress/types";
import { getScheduler } from "../../services/srs/registry";
import type { Scheduler } from "../../services/srs/types";

interface WordsContextValue {
  words: CommonWord[];
  progress: Progress;
  /** Replace progress (saved immediately). */
  update: (next: Progress | ((prev: Progress) => Progress)) => void;
  scheduler: Scheduler;
  storeLabel: string;
  /** False after a save failed (e.g. storage is blocked); progress then lasts only until reload. */
  saved: boolean;
  /** Other meanings of the same spelling (homonyms), for showing "also means". */
  homonyms: (word: CommonWord) => CommonWord[];
}

const WordsContext = createContext<WordsContextValue | null>(null);

export function WordsProvider({ children }: { children: ReactNode }) {
  const store = getProgressStore();
  const [progress, setProgress] = useState<Progress>(() => store.load());
  const [saved, setSaved] = useState(true);

  const update = useCallback((next: Progress | ((prev: Progress) => Progress)) => setProgress(next), []);

  // Save every change (not the initial load).
  const loaded = useRef(progress);
  useEffect(() => {
    if (progress !== loaded.current) setSaved(store.save(progress));
  }, [progress, store]);

  const words = useMemo(() => [...COMMON_WORDS, ...progress.addedWords], [progress.addedWords]);
  const bySpelling = useMemo(() => {
    const map = new Map<string, CommonWord[]>();
    for (const w of words) map.set(w.spelling, [...(map.get(w.spelling) ?? []), w]);
    return map;
  }, [words]);

  const value = useMemo<WordsContextValue>(
    () => ({
      words,
      progress,
      update,
      scheduler: getScheduler(),
      storeLabel: store.label,
      saved,
      homonyms: (word) => (bySpelling.get(word.spelling) ?? []).filter((w) => w.id !== word.id),
    }),
    [words, progress, update, store.label, saved, bySpelling],
  );

  return <WordsContext.Provider value={value}>{children}</WordsContext.Provider>;
}

export function useWords(): WordsContextValue {
  const ctx = useContext(WordsContext);
  if (!ctx) throw new Error("useWords must be used inside <WordsProvider>");
  return ctx;
}
