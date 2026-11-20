import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/** Matches the .rule-expand.closing animation in styles.css. */
const CLOSE_MS = 220;
import { KoText } from "../components/KoText";
import { SpeakButton } from "../components/SpeakButton";
import { RULES } from "../data/rules";
import { relatedJamoForRule } from "../data/soundChanges";
import type { PronunciationRule } from "../data/types";
import { lookupExample } from "../data/exampleWords";
import { Link, navigate } from "../router";

function searchText(rule: PronunciationRule): string {
  return [
    rule.title,
    rule.koreanTitle,
    rule.explanation,
    ...rule.formulas,
    ...(rule.notes ?? []),
    ...rule.examples.flatMap((e) => {
      const w = lookupExample(e.word);
      return [w.spelling, w.pronounced ?? "", w.romanization, w.meaning, e.note ?? ""];
    }),
    ...relatedJamoForRule(rule).flatMap((j) => [j.char, j.name]),
  ]
    .join(" ")
    .toLowerCase();
}

/**
 * A one-glance example for a tile. Sound-change rules show their first changing example (음악 → [으막]).
 * A rule whose formula isn't a sound change (no [brackets], e.g. ㄱ + ㅏ + ㅇ → 강) shows the formula.
 */
function tileExample(rule: PronunciationRule): { from: string; to: string } | null {
  const isSoundChange = rule.formulas.some((f) => f.includes("["));
  const construction = !isSoundChange && rule.formulas.find((f) => f.includes("→"));
  if (construction) {
    // Tight spacing so it fits a tile on one line: ㄱ+ㅏ+ㅇ → 강
    const [from, to] = construction.split("→").map((s) => s.trim().replace(/\s*\+\s*/g, "+"));
    return { from, to };
  }
  for (const { word } of rule.examples) {
    const w = lookupExample(word);
    if (w.pronounced) return { from: w.spelling, to: `[${w.pronounced.split("/")[0]}]` };
  }
  return null;
}

function RuleTile({
  rule,
  index,
  selected,
  onSelect,
}: {
  rule: PronunciationRule;
  index: number;
  selected: boolean;
  onSelect: () => void;
}) {
  const ex = tileExample(rule);
  return (
    <button
      type="button"
      id={`tile-${rule.id}`}
      className={`rule-tile${selected ? " selected" : ""}`}
      aria-haspopup="dialog"
      onClick={onSelect}
    >
      <span className="rule-number">{index + 1}</span>
      {ex && (
        <span className="rule-tile-example" lang="ko" aria-hidden="true">
          <span className="from">{ex.from}</span>
          <span className="arrow">→</span>
          <span className="to">{ex.to}</span>
        </span>
      )}
      <span className="rule-tile-title">{rule.title}</span>
      <span className="rule-tile-ko muted" lang="ko">
        {rule.koreanTitle}
      </span>
    </button>
  );
}

/**
 * The open rule, in the same sheet as the Hangul page's letter details: centered on wide screens, a
 * bottom sheet on phones. ← / → (buttons or arrow keys) step through the rules without closing.
 */
function RuleSheet({
  rule,
  index,
  prev,
  next,
  closing,
  onClose,
}: {
  rule: PronunciationRule;
  index: number;
  prev?: PronunciationRule;
  next?: PronunciationRule;
  closing: boolean;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (closing) return;
    closeRef.current?.focus({ preventScroll: true });
    sheetRef.current?.scrollTo({ top: 0 });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft" && prev) navigate(`/rules#${prev.id}`, { replace: true });
      else if (e.key === "ArrowRight" && next) navigate(`/rules#${next.id}`, { replace: true });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [rule.id, prev, next, closing, onClose]);

  useEffect(() => {
    document.body.classList.add("no-scroll");
    return () => document.body.classList.remove("no-scroll");
  }, []);

  return (
    <div className={`sheet-backdrop rule-sheet-backdrop${closing ? " closing" : ""}`} onClick={onClose}>
      <div
        ref={sheetRef}
        className="sheet rule-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rule-detail-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button ref={closeRef} type="button" className="sheet-close" aria-label="Close" onClick={onClose}>
          ×
        </button>
        {/* key: replay the content fade when stepping to another rule */}
        <div key={rule.id} className="rule-sheet-body">
          <RuleCard rule={rule} index={index} />
        </div>
        <nav className="rule-sheet-nav" aria-label="Other rules">
          <button
            type="button"
            className="rule-nav-prev"
            disabled={!prev}
            aria-label={prev ? `Previous rule: ${prev.title}` : "No previous rule"}
            onClick={() => prev && navigate(`/rules#${prev.id}`, { replace: true })}
          >
            <span className="rule-nav-arrow" aria-hidden="true">
              ←
            </span>{" "}
            <span className="rule-sheet-nav-label" aria-hidden="true">
              {prev?.title ?? "Previous"}
            </span>
          </button>
          <span className="rule-nav-count muted small" aria-hidden="true">
            {index + 1} / {RULES.length}
          </span>
          <button
            type="button"
            className="rule-nav-next"
            disabled={!next}
            aria-label={next ? `Next rule: ${next.title}` : "No next rule"}
            onClick={() => next && navigate(`/rules#${next.id}`, { replace: true })}
          >
            <span className="rule-sheet-nav-label" aria-hidden="true">
              {next?.title ?? "Next"}
            </span>{" "}
            <span className="rule-nav-arrow" aria-hidden="true">
              →
            </span>
          </button>
        </nav>
      </div>
    </div>
  );
}

function RuleCard({ rule, index }: { rule: PronunciationRule; index: number }) {
  const related = relatedJamoForRule(rule);
  return (
    <article className="rule-card">
      <header className="rule-head">
        <h2 id="rule-detail-title">
          <span className="rule-number">{index + 1}</span> {rule.title}{" "}
          <span className="muted ko-sub" lang="ko">
            {rule.koreanTitle}
          </span>
        </h2>
      </header>
      <p>
        <KoText text={rule.explanation} />
      </p>

      <div className="formulas" lang="ko">
        {rule.formulas.map((f) => (
          <code key={f}>{f}</code>
        ))}
      </div>

      <table className="rule-examples">
        <thead>
          <tr>
            <th scope="col">Spelling</th>
            <th scope="col">Pronounced</th>
            <th scope="col">Romanization</th>
            <th scope="col">
              <span className="visually-hidden">Listen</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rule.examples.map(({ word, note }) => {
            const ex = lookupExample(word);
            return (
              <tr key={ex.spelling}>
                <td>
                  <span className="ex-spelling" lang="ko">
                    {ex.spelling}
                  </span>
                  <span className="ex-meaning">{ex.meaning}</span>
                </td>
                <td className="ex-pronounced" lang="ko">
                  [{ex.pronounced ?? ex.spelling}]
                  {note && (
                    <span className="ex-note">
                      <KoText text={note} />
                    </span>
                  )}
                </td>
                <td className="ex-rom">{ex.romanization}</td>
                <td>
                  <SpeakButton text={ex.spelling} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {rule.notes && rule.notes.length > 0 && (
        <ul className="notes">
          {rule.notes.map((n) => (
            <li key={n}>
              <KoText text={n} />
            </li>
          ))}
        </ul>
      )}

      <footer className="rule-foot">
        {related.length > 0 && (
          <div className="related-jamo">
            <span className="muted small">Related letters:</span>
            {related.map((j) => (
              <Link key={j.id} to={`/hangul#${j.id}`} className="jamo-link" lang="ko" title={j.name}>
                {j.char}
              </Link>
            ))}
          </div>
        )}
        {rule.reference && <span className="muted small">{rule.reference}</span>}
      </footer>
    </article>
  );
}

/**
 * Rules as a grid of tiles; the selected one opens in a sheet. The selection lives in the URL hash
 * (/rules#nasalization), so other pages can link to a rule and Back closes it.
 */
export function RulesPage({ hash }: { hash: string }) {
  const [query, setQuery] = useState("");
  const indexed = useMemo(() => RULES.map((rule, index) => ({ rule, index, text: searchText(rule) })), []);
  const selected = RULES.find((r) => r.id === hash);

  const q = query.trim().toLowerCase();
  const visible = q ? indexed.filter((r) => r.text.includes(q) || r.rule.id === selected?.id) : indexed;

  // The last rule shown stays mounted after closing, so the sheet animates out instead of vanishing.
  // It's updated during render (not in an effect): an effect would run a frame late, unmounting and
  // remounting the sheet, which shows as a flicker.
  const [shownRuleId, setShownRuleId] = useState<string | null>(selected?.id ?? null);
  if (selected && selected.id !== shownRuleId) setShownRuleId(selected.id);
  const closing = !selected && shownRuleId !== null;
  useEffect(() => {
    if (!closing) return;
    const t = setTimeout(() => setShownRuleId(null), CLOSE_MS);
    return () => clearTimeout(t);
  }, [closing]);

  const close = useCallback(() => {
    const id = selected?.id;
    navigate("/rules");
    // Return focus to the tile the rule was opened from.
    if (id) requestAnimationFrame(() => document.getElementById(`tile-${id}`)?.focus({ preventScroll: true }));
  }, [selected?.id]);

  // The sheet shows the open rule, or (briefly, while animating shut) the one just closed.
  const shownIndex = RULES.findIndex((r) => r.id === (selected?.id ?? shownRuleId));

  return (
    <>
      <section className="card">
        <h2>
          Pronunciation rules <span className="muted ko-sub">표준 발음법</span>
        </h2>
        <p className="muted">
          How Korean is actually pronounced when letters meet, in a sensible learning order. Tap a rule to open it.
          Pronunciations follow the Standard Korean Pronunciation rules.
        </p>
        <label className="visually-hidden" htmlFor="rule-search">
          Search rules
        </label>
        <input
          id="rule-search"
          type="search"
          className="search"
          placeholder="Search rules, words, letters… (e.g. 국물, ㄹ, nasal)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </section>

      {visible.length === 0 && <p className="empty muted">No rules match “{query}”.</p>}

      <div className="rule-grid">
        {visible.map(({ rule, index }) => (
          <RuleTile
            key={rule.id}
            rule={rule}
            index={index}
            selected={selected?.id === rule.id}
            onSelect={() => navigate(`/rules#${rule.id}`)}
          />
        ))}
      </div>

      {shownIndex >= 0 && (
        <RuleSheet
          rule={RULES[shownIndex]}
          index={shownIndex}
          prev={RULES[shownIndex - 1]}
          next={RULES[shownIndex + 1]}
          closing={closing}
          onClose={close}
        />
      )}
    </>
  );
}
