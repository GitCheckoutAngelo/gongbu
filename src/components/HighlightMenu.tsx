/**
 * Reader: what to highlight while reading aloud. Two independent checkboxes (current sentence,
 * current word) in a small panel under a "Highlight" chip. Word highlighting isn't available with
 * Chirp 3 HD voices, which don't give reliable word timing.
 */
import { useEffect, useId, useRef, useState } from "react";
import { useTts } from "../tts/TtsContext";

export function HighlightMenu() {
  const { followSentence, setFollowSentence, followWords, setFollowWords, wordsFollowed, sentenceOnlyVoice } = useTts();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const anyOn = followSentence || wordsFollowed;

  // Close on Escape or a click outside.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    const onDown = (e: PointerEvent) => !wrapRef.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open]);

  return (
    <div className="highlight-menu" ref={wrapRef}>
      <button
        ref={buttonRef}
        type="button"
        className="toggle-chip"
        aria-pressed={anyOn}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label="Highlight while reading aloud"
        title="What to highlight while reading aloud"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="chip-glyph" aria-hidden="true">
          <HighlightGlyph />
        </span>
        <span className="chip-label">Highlight</span>
      </button>
      {open && (
        <div id={panelId} className="highlight-panel" role="group" aria-label="Highlight while reading aloud">
          <span className="settings-heading">While reading aloud, highlight</span>
          <label className="check">
            <input type="checkbox" checked={followSentence} onChange={(e) => setFollowSentence(e.target.checked)} />
            Current sentence
          </label>
          <label className={`check${sentenceOnlyVoice ? " unavailable" : ""}`}>
            <input
              type="checkbox"
              checked={wordsFollowed}
              disabled={sentenceOnlyVoice}
              onChange={(e) => setFollowWords(e.target.checked)}
            />
            Current word
          </label>
          <p className="muted small">
            {sentenceOnlyVoice
              ? "Chirp 3 HD voices don't provide reliable word timing, so word highlighting isn't available with them."
              : followWords
                ? "Word timing is estimated, so the word highlight can be slightly early or late."
                : "The sentence highlight follows the audio's pauses, so it's reliable for every voice."}
          </p>
        </div>
      )}
    </div>
  );
}

/** Lines of text with a highlighted band. */
function HighlightGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="3" y="9" width="18" height="6" rx="1.5" fill="currentColor" opacity="0.35" stroke="none" />
      <path d="M5 6h14M5 12h14M5 18h9" />
    </svg>
  );
}
