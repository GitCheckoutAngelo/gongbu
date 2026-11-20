/**
 * Choose a grammar pattern to practise: a sheet (centered on wide screens, a bottom sheet on phones)
 * with search, level and meaning-group filters, listing patterns under their group.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { GRAMMAR_GROUPS, type GrammarGroupId, type GrammarPattern } from "../../data/grammarMeta";
import { PatternExample } from "./PatternCard";

/** Matches the .sheet-backdrop.closing animation in styles.css. */
const CLOSE_MS = 200;
const LEVEL_CHOICES = [1, 2, 3, 4] as const;

export function PatternPicker({
  patterns,
  selectedId,
  onPick,
  onClose,
}: {
  patterns: GrammarPattern[];
  selectedId: string | null;
  onPick: (pattern: GrammarPattern) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  // Opens on the easiest patterns (1급, basic sentences); either filter can be cleared.
  const [level, setLevel] = useState<number | null>(1);
  const [group, setGroup] = useState<GrammarGroupId | "">("basics");
  const [closing, setClosing] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const close = () => {
    if (closing) return;
    setClosing(true);
    setTimeout(onClose, CLOSE_MS);
  };

  useEffect(() => {
    searchRef.current?.focus({ preventScroll: true });
    document.body.classList.add("no-scroll");
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.classList.remove("no-scroll");
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  const q = query.trim().toLowerCase();
  const visible = useMemo(
    () =>
      patterns.filter(
        (p) =>
          (!level || p.level === level) &&
          (!group || p.group === group) &&
          (!q ||
            `${p.form} ${p.title} ${p.meaning} ${p.sample.ko} ${p.sample.en} ${(p.variants ?? [])
              .map((v) => `${v.form} ${v.title}`)
              .join(" ")}`
              .toLowerCase()
              .includes(q)),
      ),
    [patterns, level, group, q],
  );
  const byGroup = GRAMMAR_GROUPS.map((g) => ({ ...g, items: visible.filter((p) => p.group === g.id) })).filter(
    (g) => g.items.length,
  );

  // Rendered at the end of <body>, outside the form it's opened from (Enter in its search mustn't submit it).
  return createPortal(
    <div className={`sheet-backdrop${closing ? " closing" : ""}`} onClick={close}>
      <div
        className="sheet pattern-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pattern-sheet-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className="sheet-close" aria-label="Close" onClick={close}>
          ×
        </button>
        <h2 id="pattern-sheet-title" className="saved-title">
          Choose a grammar pattern
        </h2>
        <input
          ref={searchRef}
          type="search"
          className="search"
          placeholder="Search in English or Korean, e.g. because, want to, 싶다"
          aria-label="Search patterns"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="pattern-filters">
          <div className="level-chips" role="group" aria-label="Level">
            <button type="button" aria-pressed={level === null} onClick={() => setLevel(null)}>
              All
            </button>
            {LEVEL_CHOICES.map((l) => (
              <button key={l} type="button" aria-pressed={level === l} onClick={() => setLevel(level === l ? null : l)}>
                {l}급
              </button>
            ))}
          </div>
          <select aria-label="Meaning" value={group} onChange={(e) => setGroup(e.target.value as GrammarGroupId | "")}>
            <option value="">Any meaning</option>
            {GRAMMAR_GROUPS.map((g) => (
              <option key={g.id} value={g.id}>
                {g.label}
              </option>
            ))}
          </select>
        </div>
        <p className="muted small" role="status">
          {visible.length} pattern{visible.length === 1 ? "" : "s"}
        </p>
        {byGroup.length === 0 ? (
          <p className="empty muted">No patterns match.</p>
        ) : (
          byGroup.map((g) => (
            <section key={g.id} className="pattern-group">
              <h3 className="pattern-group-title">{g.label}</h3>
              <ul className="pattern-list">
                {g.items.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      className={`pattern-row${p.id === selectedId ? " current" : ""}`}
                      aria-current={p.id === selectedId || undefined}
                      onClick={() => {
                        onPick(p);
                        close();
                      }}
                    >
                      {/* What it means first (with the textbook form), then an example, marked "e.g.". */}
                      <span className="pattern-row-text">
                        <span className="pattern-meaning-line">
                          <span className="pattern-title">{p.title}</span>
                          <span className="pattern-notation" lang="ko">
                            {p.form}
                          </span>
                        </span>
                        <PatternExample sample={p.sample} inButton />
                      </span>
                      <span className="pattern-tags">
                        {p.register !== "both" && <span className={`register-badge ${p.register}`}>{p.register}</span>}
                        <span className={`level-badge band-${p.level <= 2 ? "beginner" : "intermediate"}`}>
                          {p.level}급
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
      </div>
    </div>,
    document.body,
  );
}
