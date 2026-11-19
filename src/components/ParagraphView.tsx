import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import type { Word } from "../types";
import { IconPlay, IconSpeaker } from "./words/icons";

interface Props {
  words: Word[];
  showRomanized: boolean;
  /** Index of the word currently being spoken (-1 for none). */
  activeIndex?: number;
  /** Index of the word playback will resume from while paused (-1 for none). */
  pausedIndex?: number;
  /** When both are set, clicking a word opens a popover with its meaning and these actions. */
  onPlayFrom?: (index: number) => void;
  onPlayWord?: (index: number) => void;
  /** Index of the word whose own audio is playing (Play word shows Stop), or -1. */
  playingWord?: number;
  /** Index of the word whose own audio is loading (pressed, not sounding yet), or -1. */
  loadingWord?: number;
  /** Stops the word's audio (Play word pressed again). */
  onStopWord?: () => void;
  /** Sentence index of each word (-1 if unknown), for sentence highlighting. */
  sentenceOf?: number[];
  /** Sentence to tint (hovered here or in the translation), or -1. */
  highlightSentence?: number;
  /** Pointer moved onto a word's sentence (-1 when it leaves the paragraph). */
  onHoverSentence?: (sentence: number) => void;
}

const POPOVER_GAP = 6;

export function ParagraphView({
  words,
  showRomanized,
  activeIndex = -1,
  pausedIndex = -1,
  onPlayFrom,
  onPlayWord,
  playingWord = -1,
  loadingWord = -1,
  onStopWord,
  sentenceOf,
  highlightSentence = -1,
  onHoverSentence,
}: Props) {
  const interactive = Boolean(onPlayFrom && onPlayWord);
  const [selected, setSelected] = useState(-1);
  const [position, setPosition] = useState<{ left: number; top: number; arrow: number; above: boolean } | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const wordRefs = useRef<(HTMLElement | null)[]>([]);

  const close = (refocus = false) => {
    if (refocus && selected >= 0) wordRefs.current[selected]?.focus();
    setSelected(-1);
    setPosition(null);
  };

  // A new paragraph closes any open popover.
  useEffect(() => close(), [words]);

  // Place the popover under the selected word (above it if there's no room below), kept inside the
  // paragraph's width, with its pointer aimed at the word.
  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    const word = wordRefs.current[selected];
    const pop = popoverRef.current;
    if (selected < 0 || !wrap || !word || !pop) return;
    const w = wrap.getBoundingClientRect();
    const r = word.getBoundingClientRect();
    const center = r.left - w.left + r.width / 2;
    const maxLeft = Math.max(0, w.width - pop.offsetWidth);
    const left = Math.min(Math.max(0, center - pop.offsetWidth / 2), maxLeft);
    const above =
      r.bottom + POPOVER_GAP + pop.offsetHeight > window.innerHeight - 8 && r.top - POPOVER_GAP - pop.offsetHeight > 8;
    const top = above ? r.top - w.top - POPOVER_GAP - pop.offsetHeight : r.bottom - w.top + POPOVER_GAP;
    const arrow = Math.min(Math.max(16, center - left), pop.offsetWidth - 16);
    setPosition({ left, top, arrow, above });
    pop.querySelector("button")?.focus({ preventScroll: true });
  }, [selected, showRomanized]);

  // Close on outside click, Escape, or resize (the word moves).
  useEffect(() => {
    if (selected < 0) return;
    const onPointer = (e: PointerEvent) => {
      const target = e.target as Node;
      if (!popoverRef.current?.contains(target) && !wordRefs.current[selected]?.contains(target)) close();
    };
    const onKey = (e: globalThis.KeyboardEvent) => e.key === "Escape" && close(true);
    const onResize = () => close();
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
    };
  }); // re-bound each render so handlers see the current selection

  const toggle = (i: number) => (i === selected ? close() : setSelected(i));
  const onWordKey = (e: KeyboardEvent, i: number) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      toggle(i);
    }
  };
  const act = (fn: ((i: number) => void) | undefined) => {
    const i = selected;
    close();
    fn?.(i);
  };

  const current = words[selected];

  return (
    <div className="paragraph-wrap" ref={wrapRef}>
      <p
        className={`korean-text${showRomanized ? "" : " hide-romanization"}`}
        lang="ko"
        onMouseLeave={() => onHoverSentence?.(-1)}
      >
        {words.map((word, i) => (
          <span
            key={i}
            className={
              highlightSentence >= 0 && sentenceOf?.[i] === highlightSentence ? "word-slot in-sentence" : "word-slot"
            }
            onMouseEnter={sentenceOf ? () => onHoverSentence?.(sentenceOf[i] ?? -1) : undefined}
          >
            <ruby
              ref={(el) => {
                wordRefs.current[i] = el;
              }}
              className={`word${i === activeIndex ? " speaking" : ""}${i === pausedIndex ? " paused" : ""}${interactive ? " clickable" : ""}${i === selected ? " selected" : ""}`}
              aria-current={i === activeIndex || undefined}
              {...(interactive && {
                role: "button",
                tabIndex: 0,
                title: word.english || undefined,
                "aria-haspopup": "dialog" as const,
                "aria-expanded": i === selected,
                onClick: () => toggle(i),
                onKeyDown: (e: KeyboardEvent) => onWordKey(e, i),
              })}
            >
              {word.korean}
              <rt lang="ko-Latn" aria-hidden={!showRomanized || undefined}>
                {word.romanized}
              </rt>
            </ruby>{" "}
          </span>
        ))}
      </p>

      {interactive && current && (
        <div
          key={selected}
          ref={popoverRef}
          className={`word-popover${position?.above ? " above" : ""}`}
          role="dialog"
          aria-label={`${current.korean}: ${current.english || "options"}`}
          style={
            position
              ? ({ left: position.left, top: position.top, "--arrow-x": `${position.arrow}px` } as React.CSSProperties)
              : { visibility: "hidden", left: 0, top: 0 }
          }
        >
          <div className="wp-head">
            <div className="wp-word">
              <span className="wp-korean" lang="ko">
                {current.korean}
              </span>
              {current.romanized && <span className="wp-rom">{current.romanized}</span>}
            </div>
            {/* Play word keeps the popup open (hear it again, read the meaning); press again to stop. */}
            <button
              type="button"
              className={`wp-speak${playingWord === selected ? " playing" : ""}${loadingWord === selected ? " loading" : ""}`}
              aria-busy={loadingWord === selected || undefined}
              aria-pressed={playingWord === selected}
              aria-label={playingWord === selected ? "Stop" : `Play ${current.korean}`}
              title={playingWord === selected ? "Stop" : "Play word"}
              onClick={() => (playingWord === selected ? onStopWord?.() : onPlayWord?.(selected))}
            >
              <span className="icon-slot" aria-hidden="true">
                {loadingWord === selected ? (
                  <span className="spinner" />
                ) : playingWord === selected ? (
                  <span className="stop-icon" />
                ) : (
                  <IconSpeaker />
                )}
              </span>
            </button>
          </div>
          <p className={`wp-meaning${current.english ? "" : " muted"}`} lang="en">
            {current.english || "No translation available."}
          </p>
          <button type="button" className="wp-play-from" onClick={() => act(onPlayFrom)}>
            <span className="icon-slot" aria-hidden="true">
              <IconPlay />
            </span>
            Play from here
          </button>
        </div>
      )}
    </div>
  );
}
