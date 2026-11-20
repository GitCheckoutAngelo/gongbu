/**
 * Shared state for the Common Words pages: the word list (built-in + approved additions) and the
 * learner's progress, loaded from and saved to the configured ProgressStore.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { CommonWord } from "../../data/vocabularyMeta";
import { getProgressStore } from "../../services/progress/registry";
import type { Progress } from "../../services/progress/types";
import { getScheduler } from "../../services/srs/registry";
import type { Scheduler } from "../../services/srs/types";
import { loadWords } from "../../services/words/wordList";

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
  /** The word list has arrived from the server. */
  ready: boolean;
  /** Why the word list couldn't be loaded (null while loading or once loaded). */
  loadError: string | null;
  /** Try loading the word list again. */
  retry: () => void;
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

  // Newer progress from elsewhere (another device, via the cloud store): show it without re-saving.
  useEffect(
    () =>
      store.subscribe?.((next) => {
        loaded.current = next;
        setProgress(next);
      }),
    [store],
  );

  // The word list, from the server. Until it arrives (or if it fails), WordsReady shows that instead.
  const [shared, setShared] = useState<CommonWord[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    setLoadError(null);
    loadWords()
      .then((list) => live && setShared(list))
      .catch((err: Error) => live && setLoadError(err.message));
    return () => {
      live = false;
    };
  }, [attempt]);
  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  const words = useMemo(() => [...(shared ?? []), ...progress.addedWords], [shared, progress.addedWords]);
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
      ready: shared !== null,
      loadError,
      retry,
    }),
    [words, progress, update, store.label, saved, bySpelling, shared, loadError, retry],
  );

  return <WordsContext.Provider value={value}>{children}</WordsContext.Provider>;
}

/** Shows its children once the word list has loaded; until then a loading line, or the error and a retry. */
export function WordsReady({ children }: { children: ReactNode }) {
  const { ready, loadError, retry } = useWords();
  if (ready) return <>{children}</>;
  if (loadError) {
    return (
      <div className="error words-load-error" role="alert">
        <span>{loadError}</span>
        <button type="button" onClick={retry}>
          Try again
        </button>
      </div>
    );
  }
  return (
    <p className="muted words-loading" aria-busy="true">
      <span className="spinner" aria-hidden="true" /> Loading words…
    </p>
  );
}

export function useWords(): WordsContextValue {
  const ctx = useContext(WordsContext);
  if (!ctx) throw new Error("useWords must be used inside <WordsProvider>");
  return ctx;
}
