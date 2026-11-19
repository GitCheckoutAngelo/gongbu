/**
 * A small rule tag that opens a summary popover on hover, focus or tap, so the learner doesn't have to
 * leave the page to see what a rule means. Only one popover is open at a time.
 */
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ruleById } from "../../data/rules";
import { LETTER_NOTES, type LetterNoteId } from "../../data/vocabularyMeta";
import { lookupWord } from "../../data/words";
import { Link } from "../../router";
import { KoText } from "../KoText";
import { SpeakButton } from "../SpeakButton";

const OPEN_EVENT = "rule-tag:open";
const HOVER_OPEN_MS = 120;
const HOVER_CLOSE_MS = 180;
const GAP = 10; // room for the pointer
const MARGIN = 8;

interface Props {
  /** A rule id (rules.ts) or a letter note id (ui, ye). */
  id: string;
  label: string;
  /** Show the "Full rule →" link (off during a drill, where leaving the page would end the session). */
  showMore?: boolean;
  /** The word this tag belongs to: the popover shows its own change first. */
  word?: TaggedWord;
}

/** First sentence of a rule's explanation (the popover is a summary, the Rules page has the rest). */
const firstSentence = (text: string) => text.split(/(?<=[.!?])\s+/)[0];

/**
 * "낫다 → [낟따]" with the syllables that change highlighted. Spelling and pronunciation have the
 * same syllables (checked by the data tests); if not, nothing is highlighted.
 */
function Transformation({ spelling, pronounced }: { spelling: string; pronounced: string }) {
  const s = [...spelling];
  const p = [...pronounced];
  const same = s.length === p.length;
  const mark = (chars: string[], other: string[]) =>
    chars.map((ch, i) =>
      same && ch !== other[i] ? (
        <mark key={i} className="rp-changed">
          {ch}
        </mark>
      ) : (
        <span key={i}>{ch}</span>
      ),
    );
  return (
    <span className="rp-transform" lang="ko">
      <span className="rp-from">{mark(s, p)}</span>
      <span className="rp-arrow" aria-hidden="true">
        →
      </span>
      <span className="rp-to">[{mark(p, s)}]</span>
    </span>
  );
}

function RuleSummary({ id, word, showMore }: { id: string; word?: TaggedWord; showMore: boolean }) {
  const rule = ruleById(id);
  const note = rule ? undefined : LETTER_NOTES[id as LetterNoteId];
  if (!rule && !note) return null;

  // This word's own change first; another example only if it adds something.
  const own = word?.pronounced ? word.pronounced.split("/").find((f) => f !== word.spelling) : undefined;
  const other = rule?.examples
    .map((e) => lookupWord(e.word))
    .find((w) => w.pronounced && w.spelling !== word?.spelling);

  return (
    <>
      <div className="rp-head">
        <span className="rp-pill">{rule ? rule.title : `${note!.char} vowel`}</span>
        {rule && (
          <span className="rp-ko" lang="ko">
            {rule.koreanTitle}
          </span>
        )}
      </div>
      {word && own && (
        <div className="rp-this">
          <span className="rp-label">In this word</span>
          <Transformation spelling={word.spelling} pronounced={own} />
        </div>
      )}
      <p className="rp-text">
        <KoText text={rule ? firstSentence(rule.explanation) : `${note!.summary}.`} />
      </p>
      {(other || showMore) && (
        <div className="rp-foot">
          {other && (
            <span className="rp-also">
              <span className="rp-label">Also</span>
              <span lang="ko">
                {other.spelling} → [{other.pronounced}]
              </span>
              <SpeakButton text={other.spelling} />
            </span>
          )}
          {showMore && (
            <Link to={rule ? `/rules#${id}` : `/hangul#${id}`} className="rp-more">
              {rule ? "Full rule" : "Letter notes"} →
            </Link>
          )}
        </div>
      )}
    </>
  );
}

/** The bits of a word the popover needs. */
export interface TaggedWord {
  spelling: string;
  pronounced?: string;
}

export function RuleTag({ id, label, showMore = true, word }: Props) {
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number; arrow: number; above: boolean } | null>(null);
  const tagRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const timer = useRef<number>();
  const popId = useId();

  const show = useCallback(() => {
    window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: popId }));
    setOpen(true);
  }, [popId]);
  const hide = useCallback(() => {
    setOpen(false);
    setPinned(false);
    setPos(null);
  }, []);
  const later = (fn: () => void, ms: number) => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(fn, ms);
  };
  useEffect(() => () => window.clearTimeout(timer.current), []);

  // Opening another tag closes this one.
  useEffect(() => {
    const onOpen = (e: Event) => (e as CustomEvent).detail !== popId && hide();
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_EVENT, onOpen);
  }, [popId, hide]);

  // Position below the tag (or above if there's no room), kept inside the viewport, with the pointer
  // aimed at the tag's center.
  useLayoutEffect(() => {
    if (!open || !tagRef.current || !popRef.current) return;
    const t = tagRef.current.getBoundingClientRect();
    const p = popRef.current.getBoundingClientRect();
    const center = t.left + t.width / 2;
    const left = Math.min(Math.max(MARGIN, center - 28), window.innerWidth - p.width - MARGIN);
    const below = t.bottom + GAP;
    const above = below + p.height > window.innerHeight - MARGIN && t.top - GAP - p.height > MARGIN;
    const arrow = Math.min(Math.max(14, center - left), p.width - 14);
    setPos({ left, top: above ? t.top - GAP - p.height : below, arrow, above });
  }, [open]);

  // While open: close on Escape, outside click, or scroll (the tag moves).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        hide();
        tagRef.current?.focus();
      }
    };
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (!popRef.current?.contains(target) && !tagRef.current?.contains(target)) hide();
    };
    const onScroll = () => hide();
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
      window.removeEventListener("scroll", onScroll);
    };
  }, [open, hide]);

  const hoverIn = () => later(show, HOVER_OPEN_MS);
  const hoverOut = () => !pinned && later(hide, HOVER_CLOSE_MS);

  return (
    <>
      <button
        ref={tagRef}
        type="button"
        className={`word-tag tag-${id}${open ? " active" : ""}`}
        aria-expanded={open}
        aria-controls={open ? popId : undefined}
        onClick={(e) => {
          e.stopPropagation();
          if (open && pinned) hide();
          else {
            show();
            setPinned(true);
          }
        }}
        onMouseEnter={hoverIn}
        onMouseLeave={hoverOut}
        onFocus={show}
        onBlur={(e) => !popRef.current?.contains(e.relatedTarget as Node) && !pinned && hide()}
      >
        {label}
      </button>
      {open &&
        createPortal(
          <div
            ref={popRef}
            id={popId}
            role="dialog"
            aria-label="Rule summary"
            className={`rule-popover tag-${id}${pos?.above ? " above" : ""}`}
            style={
              pos
                ? ({ left: pos.left, top: pos.top, "--arrow-x": `${pos.arrow}px` } as React.CSSProperties)
                : { left: 0, top: 0, visibility: "hidden" }
            }
            onMouseEnter={() => window.clearTimeout(timer.current)}
            onMouseLeave={hoverOut}
            onClick={(e) => e.stopPropagation()}
          >
            <RuleSummary id={id} word={word} showMore={showMore} />
          </div>,
          document.body,
        )}
    </>
  );
}
