import { useMemo, useState } from "react";
import type { CommonWord } from "../../data/commonWords";
import { CATEGORIES, LEVEL_BANDS, LEVELS, PARTS_OF_SPEECH, type CategoryId, type Level, type PartOfSpeech } from "../../data/vocabularyMeta";
import { daysBetween, localDate } from "../../services/srs/dates";
import { cardKey, isMistake } from "../../services/srs/session";
import { DRILL_MODES } from "../../services/srs/types";
import { SpeakButton } from "../SpeakButton";
import { IconClock, IconMistake, IconSparkle } from "./icons";
import { WordPronunciation, WordTags } from "./WordPronunciation";
import { useWords } from "./WordsContext";

/** "beginner" | "intermediate" | "advanced" for a TOPIK level. */
const bandOf = (level: number) =>
  LEVEL_BANDS.find((b) => (b.levels as readonly number[]).includes(level))?.id ?? "beginner";

const searchText = (w: CommonWord) =>
  [w.spelling, w.pronounced ?? "", w.romanization, w.romanization.replace(/[\s-]/g, ""), w.meaning].join(" ").toLowerCase();

export function WordBrowser() {
  const { words, progress } = useWords();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<CategoryId | "">("");
  const [level, setLevel] = useState<Level | "">("");
  const [pos, setPos] = useState<PartOfSpeech | "">("");
  const indexed = useMemo(() => words.map((w) => ({ w, text: searchText(w) })), [words]);
  const today = localDate();

  const q = query.trim().toLowerCase();
  const visible = indexed
    .filter(
      ({ w, text }) =>
        (!q || text.includes(q)) &&
        (!category || w.category === category) &&
        (!level || w.level === level) &&
        (!pos || w.pos === pos),
    )
    .map(({ w }) => w);

  const [openId, setOpenId] = useState<string | null>(null);

  /** One status per word, from its earliest drill: mistake, due, new, or days until due. */
  const status = (w: CommonWord): { kind: "new" | "due" | "later" | "mistake"; label: string } => {
    const states = DRILL_MODES.map((m) => progress.cards[cardKey(w.id, m.id)]).filter(Boolean);
    if (states.length === 0) return { kind: "new", label: "new" };
    if (states.some(isMistake)) return { kind: "mistake", label: "mistake" };
    const days = daysBetween(today, states.map((s) => s!.due).sort()[0]);
    return days <= 0 ? { kind: "due", label: "due" } : { kind: "later", label: `${days}d` };
  };

  return (
    <section className="card">
      <h2>
        Word list <span className="muted ko-sub">단어 목록</span>
      </h2>
      <label className="visually-hidden" htmlFor="word-search">
        Search words
      </label>
      <input
        id="word-search"
        type="search"
        className="search"
        placeholder="Search Hangul, romanization or English (e.g. 학교, hakgyo, school)"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="browser-filters">
        <select aria-label="Category" value={category} onChange={(e) => setCategory(e.target.value as CategoryId | "")}>
          <option value="">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
        <select
          aria-label="Level"
          value={level}
          onChange={(e) => setLevel(e.target.value ? (Number(e.target.value) as Level) : "")}
        >
          <option value="">All levels</option>
          {LEVELS.filter((l) => words.some((w) => w.level === l)).map((l) => (
            <option key={l} value={l}>
              {LEVEL_BANDS.find((b) => (b.levels as readonly number[]).includes(l))?.label} · {l}급
            </option>
          ))}
        </select>
        <select aria-label="Part of speech" value={pos} onChange={(e) => setPos(e.target.value as PartOfSpeech | "")}>
          <option value="">All parts of speech</option>
          {PARTS_OF_SPEECH.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </div>
      <p className="muted small" role="status">
        {visible.length} of {words.length} words
      </p>

      {visible.length === 0 ? (
        <p className="empty muted">No words match.</p>
      ) : (
        <ul className="word-list compact">
          {visible.map((w) => {
            const st = status(w);
            const open = openId === w.id;
            return (
              <li key={w.id} className={`word-item${open ? " open" : ""}`}>
                <div className="word-line">
                  <SpeakButton text={w.spelling} />
                  {/* Clicking anywhere on the row expands it; the word itself is the keyboard-accessible toggle.
                      (The tags are their own buttons, so the row can't be one big button.) */}
                  <div className="word-toggle" onClick={() => setOpenId(open ? null : w.id)}>
                    <span className="word-line-main">
                      <button
                        type="button"
                        className="word-line-korean"
                        lang="ko"
                        aria-expanded={open}
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenId(open ? null : w.id);
                        }}
                      >
                        {w.spelling}
                        {w.pronounced && (
                          <span className="word-line-pron">
                            [{w.pronounced.split("/").find((f) => f !== w.spelling) ?? w.pronounced}]
                          </span>
                        )}
                      </button>
                      <span className="word-rom">{w.romanization}</span>
                    </span>
                    <span className="word-line-right">
                      <span className="word-line-meaning">{w.meaning}</span>
                      <WordTags word={w} />
                    </span>
                    <span className="word-side">
                      <span
                        className={`level-badge band-${bandOf(w.level)}`}
                        title={`TOPIK ${w.level}급 (${bandOf(w.level)})`}
                      >
                        {w.level}급
                      </span>
                      <span className={`word-status-icon ${st.kind}`} title={st.label}>
                        {st.kind === "new" ? (
                          <IconSparkle />
                        ) : st.kind === "due" ? (
                          <IconClock />
                        ) : st.kind === "mistake" ? (
                          <IconMistake />
                        ) : (
                          st.label
                        )}
                        <span className="visually-hidden">{st.label}</span>
                      </span>
                    </span>
                  </div>
                </div>
                {open && (
                  <div className="word-details">
                    <WordPronunciation word={w} />
                    <span className="muted small">
                      {PARTS_OF_SPEECH.find((p) => p.id === w.pos)?.label} · TOPIK {w.level}급 ·{" "}
                      {CATEGORIES.find((c) => c.id === w.category)?.label}
                    </span>
                    {w.source === "added" && <span className="badge warn">added · unverified</span>}
                    {w.note && <span className="muted small word-note">{w.note}</span>}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
