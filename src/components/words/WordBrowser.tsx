import { useMemo, useRef, useState } from "react";
import type { CommonWord } from "../../data/vocabularyMeta";
import {
  CATEGORIES,
  LEVEL_BANDS,
  LEVELS,
  PARTS_OF_SPEECH,
  REGISTERS,
  type CategoryId,
  type Level,
  type PartOfSpeech,
} from "../../data/vocabularyMeta";
import { daysBetween, localDate } from "../../services/srs/dates";
import { cardKey, introductionOrder, isMistake } from "../../services/srs/session";
import { DRILL_MODES } from "../../services/srs/types";
import { SpeakButton } from "../SpeakButton";
import {
  IconBars,
  IconChevronLeft,
  IconChevronRight,
  IconClock,
  IconMistake,
  IconSortDirection,
  IconSparkle,
  IconTag,
} from "./icons";
import { WordPronunciation, WordTags } from "./WordPronunciation";
import { useWords } from "./WordsContext";

/** "beginner" | "intermediate" | "advanced" for a TOPIK level. */
const bandOf = (level: number) =>
  LEVEL_BANDS.find((b) => (b.levels as readonly number[]).includes(level))?.id ?? "beginner";

const koreanOrder = new Intl.Collator("ko");
const SORTS = {
  // The order Today introduces new words: by level, and most-spoken first within a level.
  learning: {
    label: "Level",
    ascending: "Easiest first (most spoken first within a level)",
    descending: "Hardest first",
    compare: introductionOrder,
  },
  spoken: {
    label: "Most spoken",
    ascending: "Most spoken first",
    descending: "Least spoken first",
    compare: (a: CommonWord, b: CommonWord) => (a.spokenRank ?? Infinity) - (b.spokenRank ?? Infinity) || 0,
  },
  korean: {
    label: "가나다",
    ascending: "ㄱ → ㅎ",
    descending: "ㅎ → ㄱ",
    compare: (a: CommonWord, b: CommonWord) => koreanOrder.compare(a.spelling, b.spelling),
  },
} as const;
type SortId = keyof typeof SORTS;

/** Words per page: about one screen. */
const PAGE_SIZE = 20;

/** Page numbers to show: the first, the last, and two either side of the current one ("…" for gaps). */
function pageItems(current: number, count: number): (number | "gap")[] {
  const items: (number | "gap")[] = [];
  for (let p = 0; p < count; p++) {
    if (p === 0 || p === count - 1 || Math.abs(p - current) <= 2) items.push(p);
    else if (items[items.length - 1] !== "gap") items.push("gap");
  }
  return items;
}

/** Just previous / next (beside the count at the top of the list), so changing page doesn't need a scroll. */
function MiniPager({ page, count, onPage }: { page: number; count: number; onPage: (page: number) => void }) {
  if (count <= 1) return null;
  return (
    <span className="mini-pager">
      <button type="button" disabled={page === 0} onClick={() => onPage(page - 1)} aria-label="Previous page">
        <IconChevronLeft />
      </button>
      <button type="button" disabled={page === count - 1} onClick={() => onPage(page + 1)} aria-label="Next page">
        <IconChevronRight />
      </button>
    </span>
  );
}

function Pager({ page, count, onPage }: { page: number; count: number; onPage: (page: number) => void }) {
  if (count <= 1) return null;
  return (
    <nav className="pager" aria-label="Word list pages">
      <button type="button" disabled={page === 0} onClick={() => onPage(page - 1)} aria-label="Previous page">
        <IconChevronLeft /> <span className="pager-label">Previous</span>
      </button>
      <span className="pager-numbers">
        {pageItems(page, count).map((p, i) =>
          p === "gap" ? (
            <span key={`gap-${i}`} className="pager-gap" aria-hidden="true">
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              className="pager-number"
              aria-current={p === page ? "page" : undefined}
              aria-label={`Page ${p + 1}`}
              onClick={() => onPage(p)}
            >
              {p + 1}
            </button>
          ),
        )}
      </span>
      <span className="pager-compact muted small" aria-hidden="true">
        Page {page + 1} of {count}
      </span>
      <button type="button" disabled={page === count - 1} onClick={() => onPage(page + 1)} aria-label="Next page">
        <span className="pager-label">Next</span> <IconChevronRight />
      </button>
    </nav>
  );
}

const searchText = (w: CommonWord) =>
  [w.spelling, w.pronounced ?? "", w.romanization, w.romanization.replace(/[\s-]/g, ""), w.meaning]
    .join(" ")
    .toLowerCase();

export function WordBrowser() {
  const { words, progress } = useWords();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<CategoryId | "">("");
  const [level, setLevel] = useState<Level | "">("");
  const [pos, setPos] = useState<PartOfSpeech | "">("");
  const [sort, setSort] = useState<SortId>("learning");
  const [descending, setDescending] = useState(false);
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
    .map(({ w }) => w)
    .sort(SORTS[sort].compare);
  if (descending) {
    visible.reverse();
    // Words with no spoken rank stay last either way (they're unknown, not least spoken).
    if (sort === "spoken")
      visible.sort((a, b) => Number(a.spokenRank === undefined) - Number(b.spokenRank === undefined));
  }

  const [openId, setOpenId] = useState<string | null>(null);

  // Pages: a new search or filter starts again at page 1 (the page is remembered per filter combination).
  const filterKey = [q, category, level, pos, sort, descending].join("|");
  const [paging, setPaging] = useState({ key: filterKey, page: 0 });
  const pageCount = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const page = paging.key === filterKey ? Math.min(paging.page, pageCount - 1) : 0;
  const shown = visible.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const listTop = useRef<HTMLDivElement>(null);
  const goToPage = (next: number) => {
    setPaging({ key: filterKey, page: next });
    setOpenId(null);
    // Back to the top of the list (only if it has scrolled out of view).
    const el = listTop.current;
    if (el && el.getBoundingClientRect().top < 0) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

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
        {/* Each menu shows just its name until something is picked; the icon says what it is. */}
        <label className={`filter-select${category ? " active" : ""}`}>
          <span className="filter-icon" aria-hidden="true">
            <IconTag />
          </span>
          <select aria-label="Topic" value={category} onChange={(e) => setCategory(e.target.value as CategoryId | "")}>
            <option value="">Topic</option>
            {CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <label className={`filter-select${level ? " active" : ""}`}>
          <span className="filter-icon" aria-hidden="true">
            <IconBars level={2} />
          </span>
          <select
            aria-label="Level"
            value={level}
            onChange={(e) => setLevel(e.target.value ? (Number(e.target.value) as Level) : "")}
          >
            <option value="">Level</option>
            {LEVELS.filter((l) => words.some((w) => w.level === l)).map((l) => (
              <option key={l} value={l}>
                {l}급 · {LEVEL_BANDS.find((b) => (b.levels as readonly number[]).includes(l))?.label}
              </option>
            ))}
          </select>
        </label>
        <label className={`filter-select${pos ? " active" : ""}`}>
          <span className="filter-icon text" aria-hidden="true">
            Aa
          </span>
          <select aria-label="Word type" value={pos} onChange={(e) => setPos(e.target.value as PartOfSpeech | "")}>
            <option value="">Type</option>
            {PARTS_OF_SPEECH.map((p) => (
              <option key={p.id} value={p.id}>
                {p.id}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div ref={listTop} className="browser-count-row">
        <p className="muted small browser-count" role="status">
          {visible.length === 0
            ? `0 of ${words.length} words`
            : `${page * PAGE_SIZE + 1}–${page * PAGE_SIZE + shown.length} of ${visible.length}` +
              (visible.length < words.length ? ` (filtered from ${words.length})` : " words")}
        </p>
        {(category || level || pos) && (
          <button
            type="button"
            className="link-button clear-filters"
            onClick={() => {
              setCategory("");
              setLevel("");
              setPos("");
            }}
          >
            Clear
          </button>
        )}
        {/* Not a <label>: it holds a button as well as the menu. */}
        <div className="sort-control">
          <span className="sort-label muted small" aria-hidden="true">
            Sort by
          </span>
          <div className="filter-select sort-select">
            <button
              type="button"
              className="sort-direction"
              onClick={() => setDescending((d) => !d)}
              aria-label={`Order: ${descending ? SORTS[sort].descending : SORTS[sort].ascending}. Press to reverse`}
              title={`${descending ? SORTS[sort].descending : SORTS[sort].ascending} (press to reverse)`}
            >
              <IconSortDirection descending={descending} />
            </button>
            <select aria-label="Sort by" value={sort} onChange={(e) => setSort(e.target.value as SortId)}>
              {(Object.keys(SORTS) as SortId[]).map((id) => (
                <option key={id} value={id}>
                  {SORTS[id].label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <MiniPager page={page} count={pageCount} onPage={goToPage} />
      </div>

      {visible.length === 0 ? (
        <p className="empty muted">No words match.</p>
      ) : (
        <ul className="word-list compact">
          {shown.map((w) => {
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
                      {/* Only the unusual registers are marked; neutral words need no badge. */}
                      {w.register && w.register !== "neutral" && (
                        <span
                          className={`register-badge ${w.register}`}
                          title={REGISTERS.find((r) => r.id === w.register)?.hint}
                        >
                          {w.register}
                        </span>
                      )}
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
                      {w.register && ` · ${REGISTERS.find((r) => r.id === w.register)?.hint}`}
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
      <Pager page={page} count={pageCount} onPage={goToPage} />
    </section>
  );
}
