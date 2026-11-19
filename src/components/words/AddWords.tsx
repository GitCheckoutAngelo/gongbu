import { useState } from "react";
import { suggestWords, type SuggestedWord } from "../../api/client";
import type { CommonWord } from "../../data/commonWords";
import { CATEGORIES, LEVEL_BANDS, PARTS_OF_SPEECH, type CategoryId, type LevelBand } from "../../data/vocabularyMeta";
import { IconBars } from "./icons";
import { SpeakButton } from "../SpeakButton";
import { WordPronunciation } from "./WordPronunciation";
import { useWords } from "./WordsContext";

interface Candidate {
  word: SuggestedWord;
  meaning: string;
  approved: boolean;
}

const COUNTS = [3, 5, 10];

function toCommonWord(c: Candidate, category: CategoryId): CommonWord {
  const { word } = c;
  return {
    id: `added:${word.spelling}`,
    spelling: word.spelling,
    meaning: c.meaning.trim() || word.meaning,
    pos: word.pos,
    category,
    level: word.level,
    romanization: word.romanization,
    ...(word.pronounced && { pronounced: word.pronounced }),
    ...(word.rules.length && { rules: word.rules }),
    ...(word.letters.length && { letters: word.letters }),
    ...(word.note && { note: word.note }),
    source: "added",
  };
}

/** Claude suggests words for a category; nothing is added until the learner approves it. */
export function AddWords() {
  const { words, update } = useWords();
  const [category, setCategory] = useState<CategoryId>(CATEGORIES[0].id);
  const [band, setBand] = useState<LevelBand>("beginner");
  const [count, setCount] = useState(5);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [suggestedFor, setSuggestedFor] = useState<CategoryId>(CATEGORIES[0].id);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState<string[] | null>(null);

  const suggest = async () => {
    setLoading(true);
    setError(null);
    setAdded(null);
    try {
      const exclude = [...new Set(words.map((w) => w.spelling))];
      const list = await suggestWords(category, band, count, exclude);
      setSuggestedFor(category);
      setCandidates(list.map((word) => ({ word, meaning: word.meaning, approved: false })));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't get suggestions.");
    } finally {
      setLoading(false);
    }
  };

  const approve = () => {
    const existing = new Set(words.map((w) => w.spelling));
    const fresh = candidates
      .filter((c) => c.approved && !existing.has(c.word.spelling))
      .map((c) => toCommonWord(c, suggestedFor));
    update((p) => ({ ...p, addedWords: [...p.addedWords, ...fresh] }));
    setAdded(fresh.map((w) => w.spelling));
    setCandidates([]);
  };

  const set = (i: number, patch: Partial<Candidate>) =>
    setCandidates((cs) => cs.map((c, j) => (j === i ? { ...c, ...patch } : c)));
  const approvedCount = candidates.filter((c) => c.approved).length;

  return (
    <section className="card add-words">
      <h2>
        Add words <span className="muted ko-sub">단어 추가</span>
      </h2>
      <p className="muted">
        Claude suggests new words for a category and level. Suggestions aren't hand-checked like the built-in list
        (TOPIK 1–2), so check each one (meaning and pronunciation) before you approve it.
      </p>
      <fieldset className="field">
        <legend>Level</legend>
        <div className="option-tiles" role="radiogroup" aria-label="Level">
          {LEVEL_BANDS.map((b, i) => {
            const selected = b.id === band;
            return (
              <button
                key={b.id}
                type="button"
                role="radio"
                aria-checked={selected}
                className={`option-tile${selected ? " selected" : ""}`}
                onClick={() => setBand(b.id)}
              >
                <span className="option-icon">
                  <IconBars level={(i + 1) as 1 | 2 | 3} />
                </span>
                <span className="option-label">{b.label}</span>
                <span className="option-hint">
                  TOPIK {b.levels[0]}–{b.levels[b.levels.length - 1]}
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>
      <div className="add-controls">
        <div className="field">
          <label htmlFor="add-category">Category</label>
          <select id="add-category" value={category} onChange={(e) => setCategory(e.target.value as CategoryId)}>
            {CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="add-count">How many</label>
          <select id="add-count" value={count} onChange={(e) => setCount(Number(e.target.value))}>
            {COUNTS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
        <button type="button" className="primary" disabled={loading} onClick={() => void suggest()}>
          {loading ? "Asking Claude…" : "Suggest words"}
        </button>
      </div>

      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
      {added && (
        <p role="status" className="session-done">
          {added.length ? `Added ${added.join(", ")}. They'll appear as new cards in Today.` : "Nothing was added."}
        </p>
      )}

      {candidates.length > 0 && (
        <>
          <ul className="word-list candidates">
            {candidates.map((c, i) => {
              const preview = toCommonWord(c, suggestedFor);
              return (
                <li key={c.word.spelling} className={`word-row candidate${c.approved ? " approved" : ""}`}>
                  <label className="check candidate-check">
                    <input
                      type="checkbox"
                      checked={c.approved}
                      onChange={(e) => set(i, { approved: e.target.checked })}
                      aria-label={`Approve ${c.word.spelling}`}
                    />
                  </label>
                  <div className="word-row-main">
                    <span className="word-row-korean" lang="ko">
                      {c.word.spelling}
                    </span>
                    <SpeakButton text={c.word.spelling} />
                    <span className="word-rom">{c.word.romanization}</span>
                    <WordPronunciation word={preview} />
                  </div>
                  <div className="word-row-meaning">
                    <input
                      type="text"
                      aria-label={`Meaning of ${c.word.spelling}`}
                      value={c.meaning}
                      maxLength={80}
                      onChange={(e) => set(i, { meaning: e.target.value })}
                    />
                    <span className="muted small">
                      {PARTS_OF_SPEECH.find((p) => p.id === c.word.pos)?.label} · TOPIK {c.word.level}급
                    </span>
                    {c.word.note && <span className="small word-note">Note from Claude: {c.word.note}</span>}
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="add-actions">
            <button type="button" className="primary" disabled={approvedCount === 0} onClick={approve}>
              Add {approvedCount} approved {approvedCount === 1 ? "word" : "words"}
            </button>
            <button type="button" onClick={() => setCandidates([])}>
              Discard
            </button>
          </div>
        </>
      )}
    </section>
  );
}
