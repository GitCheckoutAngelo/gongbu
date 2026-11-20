import { useEffect, useMemo, useRef, useState } from "react";
import {
  deleteSavedParagraph,
  generateParagraph,
  openSavedParagraph,
  saveParagraph,
} from "../api/client";
import { AnimatedHeight } from "../components/AnimatedHeight";
import { HighlightMenu } from "../components/HighlightMenu";
import { StableLabel } from "../components/StableLabel";
import {
  DIFFICULTIES,
  GenerateForm,
  LENGTHS,
} from "../components/GenerateForm";
import {
  GrammarForm,
  type PracticeSource,
} from "../components/grammar/GrammarForm";
import { loadConversations } from "../services/grammar/grammarList";
import { PatternCard } from "../components/grammar/PatternCard";
import { POLITENESS, type Politeness } from "../data/grammarMeta";
import {
  IconBookmark,
  IconChevronLeft,
  IconChevronRight,
  IconPencil,
  IconRepeat,
  IconStack,
  IconTag,
} from "../components/words/icons";
import { ParagraphView, type DialogueRange } from "../components/ParagraphView";
import { PlaybackControls } from "../components/PlaybackControls";
import { SavedParagraphsSheet } from "../components/SavedParagraphsSheet";
import { WritingAnimation } from "../components/WritingAnimation";
import { useTts } from "../tts/TtsContext";
import type { Difficulty, GenerateResponse, Length } from "../types";
import {
  loadReaderSnapshot,
  saveReaderSnapshot,
  type ReaderSettings,
} from "./readerSnapshot";

const PLAY_KEY = "reader-paragraph";

type Settings = ReaderSettings;

/** Free writing or grammar practice: a two-button switch at the top of the form. */
function ModeSwitch({
  mode,
  onChange,
}: {
  mode: "free" | "grammar";
  onChange: (m: "free" | "grammar") => void;
}) {
  return (
    // data-mode moves the sliding highlight (CSS) under the chosen option.
    <div
      className="mode-switch"
      data-mode={mode}
      role="radiogroup"
      aria-label="What to write"
    >
      {(
        [
          ["free", "Free writing", "Any paragraph at your level"],
          [
            "grammar",
            "Grammar practice",
            "A text built around one grammar pattern",
          ],
        ] as const
      ).map(([id, label, hint]) => (
        <button
          key={id}
          type="button"
          role="radio"
          aria-checked={mode === id}
          title={hint}
          onClick={() => onChange(id)}
        >
          <span className="mode-label">{label}</span>
        </button>
      ))}
    </div>
  );
}

/** The form, collapsed once a paragraph exists: what it was made with, and Change. */
function SummaryBar({
  settings,
  onChange,
}: {
  settings: Settings;
  onChange: () => void;
}) {
  const d = DIFFICULTIES.find((o) => o.value === settings.difficulty)!;
  const l = LENGTHS.find((o) => o.value === settings.length)!;
  const g = settings.grammar;
  const level = g && POLITENESS.find((p) => p.id === g.politeness);
  return (
    <section className="card reader-summary" aria-label="Paragraph settings">
      <button
        type="button"
        className="summary-settings"
        onClick={onChange}
        title="Change settings"
      >
        {g ? (
          <>
            <span className="summary-item summary-pattern">
              <span className="summary-pattern-title">{g.label}</span>
            </span>
            {g.source !== "library" && (
              <span className="summary-item summary-setting">
                <span className="summary-icon">
                  <IconPencil />
                </span>
                {g.setting || "Any setting"}
              </span>
            )}
            {level && (
              <span className="summary-item summary-level">{level.label}</span>
            )}
          </>
        ) : (
          <>
            <span className="summary-item">
              <span className="summary-icon">{d.icon}</span>
              {d.label}
            </span>
            <span className="summary-item">
              <span className="summary-icon">{l.icon}</span>
              {l.label}
            </span>
            {settings.topic && (
              <span className="summary-item summary-topic">
                <span className="summary-icon">
                  <IconTag />
                </span>
                <span lang="ko">{settings.topic}</span>
              </span>
            )}
          </>
        )}
        <span className="summary-edit">
          <IconPencil /> <span className="summary-edit-text">Change</span>
        </span>
      </button>
    </section>
  );
}

/**
 * Top of the text (it stays put whatever the text's length). Ready-made conversations: a pager, the dots
 * between ‹ and ›. Texts Claude wrote: New paragraph (same settings).
 */
function TextNav({
  settings,
  onStep,
  onNew,
}: {
  settings: Settings;
  onStep: (step: 1 | -1) => void;
  onNew: () => void;
}) {
  const g = settings.grammar;
  if (g?.source === "library") {
    const count = g.conversationCount ?? 1;
    const only = count <= 1;
    const tip = only
      ? "This is the only conversation for this pattern at this level"
      : undefined;
    return (
      <div className="text-nav">
        <span className="text-nav-label muted small">Conversation</span>
        <div className="pager" role="group" aria-label="Conversations">
          <button
            type="button"
            className="pager-arrow"
            aria-label="Previous conversation"
            title={tip ?? "Previous conversation"}
            disabled={only}
            onClick={() => onStep(-1)}
          >
            <IconChevronLeft />
          </button>
          <ConversationDots at={g.conversationAt ?? 1} count={count} />
          <button
            type="button"
            className="pager-arrow"
            aria-label="Next conversation"
            title={tip ?? "Next conversation"}
            disabled={only}
            onClick={() => onStep(1)}
          >
            <IconChevronRight />
          </button>
        </div>
      </div>
    );
  }
  return (
    <div className="text-nav">
      <button
        type="button"
        className="text-nav-new"
        onClick={onNew}
        title="A different paragraph with the same settings"
      >
        <IconRepeat /> New paragraph
      </button>
    </div>
  );
}

/** Which ready-made conversation this is: a dot per conversation (a count once there are many). */
function ConversationDots({ at, count }: { at: number; count: number }) {
  return (
    <span
      className="summary-item conversation-dots"
      role="img"
      aria-label={`Conversation ${at} of ${count}`}
    >
      {count <= 6 ? (
        Array.from({ length: count }, (_, i) => (
          <span key={i} className={`dot${i + 1 === at ? " current" : ""}`} />
        ))
      ) : (
        <span className="conversation-count">
          {at}/{count}
        </span>
      )}
    </span>
  );
}

/**
 * The writing card's content. When regenerating, it glides from the old paragraph card's height
 * (measured when Regenerate was pressed) to its own fixed height.
 */
function RegeneratingBody({ fromHeight }: { fromHeight: number }) {
  const [height, setHeight] = useState(fromHeight || undefined);
  useEffect(() => {
    // Two frames: let the starting height paint before transitioning to the CSS one.
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => setHeight(undefined));
    });
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
  }, []);
  return (
    <div className="reader-regenerating-body" style={{ height }}>
      <WritingAnimation />
    </div>
  );
}

export function ReaderPage() {
  const tts = useTts();
  // Restored from the last visit (switching tabs or refreshing keeps your place).
  const [saved] = useState(loadReaderSnapshot);
  // Opened from Learn → Grammar's "Practise" (/reader#practise=<pattern id>): grammar mode with that pattern.
  const [practise] = useState(() => {
    const m = /^#practise=(.+)$/.exec(window.location.hash);
    if (!m) return null;
    try {
      return decodeURIComponent(m[1]);
    } catch {
      return null;
    }
  });
  const [difficulty, setDifficulty] = useState<Difficulty>(
    saved?.difficulty ?? "beginner",
  );
  const [length, setLength] = useState<Length>(saved?.length ?? "short");
  const [topic, setTopic] = useState(saved?.topic ?? "");
  const [result, setResult] = useState<GenerateResponse | null>(
    saved?.result ?? null,
  );
  /** True after generating here: the new paragraph glows; a restored one doesn't. */
  const [justGenerated, setJustGenerated] = useState(false);
  /** Next (ready-made): the card stays; only the conversation inside it slides in. */
  const [stepped, setStepped] = useState(false);
  /** …and it came from the left (‹ previous). */
  const [stepBack, setStepBack] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [showRomanized, setShowRomanized] = useState(
    saved?.showRomanized ?? false,
  );
  const [showTranslation, setShowTranslation] = useState(
    saved?.showTranslation ?? false,
  );
  const [spokenWord, setSpokenWord] = useState(-1);
  /** Where Play continues from after a pause (0 = beginning). */
  const [resumeWord, setResumeWord] = useState(saved?.resumeWord ?? 0);
  const playing = tts.playingKey === PLAY_KEY;
  /** Play pressed but no sound yet (fetching the audio and measuring its pauses). */
  const [audioStarted, setAudioStarted] = useState(false);
  const loadingAudio = playing && !audioStarted;
  /** Settings of the paragraph on screen (the summary bar shows these; "Regenerate" reuses them). */
  const [used, setUsed] = useState<Settings | null>(saved?.used ?? null);
  /** The saved copy of the paragraph on screen (Save pressed, or opened from the saved list). */
  const [savedId, setSavedId] = useState<string | null>(saved?.savedId ?? null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showSaved, setShowSaved] = useState(false);
  // Grammar practice choices (kept for the next visit).
  const [mode, setMode] = useState<"free" | "grammar">(
    practise ? "grammar" : (saved?.mode ?? "free"),
  );
  const [patternId, setPatternId] = useState<string | null>(
    practise ?? saved?.grammar?.patternId ?? null,
  );
  const [patternLabel, setPatternLabel] = useState("");
  const [source, setSource] = useState<PracticeSource>(
    !practise && saved?.grammar?.source === "custom" ? "custom" : "library",
  );
  const [customSetting, setCustomSetting] = useState(
    saved?.grammar?.customSetting ?? "",
  );
  const [politeness, setPoliteness] = useState<Politeness>(
    saved?.grammar?.politeness ?? "polite",
  );

  // Keep the state for the next visit.
  useEffect(() => {
    saveReaderSnapshot({
      difficulty,
      length,
      topic,
      result,
      used,
      showRomanized,
      showTranslation,
      resumeWord,
      savedId,
      mode,
      grammar: { patternId, source, customSetting, politeness },
    });
  }, [
    difficulty,
    length,
    topic,
    result,
    used,
    showRomanized,
    showTranslation,
    resumeWord,
    savedId,
    mode,
    patternId,
    source,
    customSetting,
    politeness,
  ]);
  /** The form is open again on top of an existing paragraph. */
  const [editing, setEditing] = useState(false);
  /** The form is open in the other mode from the text on screen: the text dims. */
  const otherMode =
    !!used && editing && mode !== (used.grammar ? "grammar" : "free");
  useEffect(() => {
    if (otherMode) tts.stop();
  }, [otherMode]);
  // Back to the text (Keep current): the form's mode returns to the text's, so Change opens it there.
  useEffect(() => {
    if (!editing && used) setMode(used.grammar ? "grammar" : "free");
  }, [editing]);
  const readerRef = useRef<HTMLElement>(null);
  /** The paragraph card's inner height when Regenerate was pressed (the writing card glides from it). */
  const cardHeightRef = useRef(0);
  // Sentence highlighting between the Korean and the translation.
  const [hoverSentence, setHoverSentence] = useState(-1);
  const [pinnedSentence, setPinnedSentence] = useState(-1);
  const sentenceOf = useMemo(() => {
    const of = (result?.words ?? []).map(() => -1);
    (result?.sentences ?? []).forEach((s, n) => {
      for (let i = s.start; i < s.end && i < of.length; i++) of[i] = n;
    });
    return of;
  }, [result]);
  const highlightSentence = hoverSentence >= 0 ? hoverSentence : pinnedSentence;
  // Grammar practice: the words that use the pattern, and (dialogues) each speaker's turn as a word range.
  const highlights = useMemo(() => new Set(result?.highlights ?? []), [result]);
  const turns = useMemo((): DialogueRange[] => {
    const sentences = result?.sentences ?? [];
    if (!result || !sentences.some((x) => x.speaker)) return [];
    const out: DialogueRange[] = [];
    for (const x of sentences) {
      const speaker = x.speaker ?? out[out.length - 1]?.speaker ?? "A";
      const last = out[out.length - 1];
      if (last && last.speaker === speaker) last.end = x.end;
      else out.push({ start: last ? last.end : 0, end: x.end, speaker });
    }
    out[out.length - 1].end = result.words.length; // every word belongs to a turn
    return out;
  }, [result]);
  useEffect(() => {
    if (!showTranslation) {
      setHoverSentence(-1);
      setPinnedSentence(-1);
    }
  }, [showTranslation]);
  /** While the paragraph plays, the sentence being read (its translation follows along). */
  // Where playback is: the spoken word if the voice reports words, otherwise the last reported position
  // (the Browser voice may only report sentence starts).
  const position = playing ? (spokenWord >= 0 ? spokenWord : resumeWord) : -1;
  const playingSentence = position >= 0 ? (sentenceOf[position] ?? -1) : -1;
  // Sentences by punctuation: the same boundaries the audio timing is anchored to, so this is reliable.
  const readingSentenceOf = useMemo(() => {
    let n = 0;
    return (result?.words ?? []).map((w) => {
      const index = n;
      if (/[.!?。…]["'”’)]*$/.test(w.korean)) n++;
      return index;
    });
  }, [result]);
  const readingSentence =
    position >= 0 ? (readingSentenceOf[position] ?? -1) : -1;

  // Pause/resume follow the same precision as the highlight: word-level only when words are followed
  // (and the voice has usable word timing); otherwise by sentence, whose start is always exact.
  const wordLevel = tts.wordsFollowed;
  /** Where Play/Resume continues from: the paused word, or the start of its sentence. */
  const resumeFrom = () => {
    if (wordLevel || resumeWord <= 0) return resumeWord;
    const sentence = readingSentenceOf[resumeWord];
    const start = readingSentenceOf.indexOf(sentence);
    return start >= 0 ? start : resumeWord;
  };
  const paused = !playing && resumeWord > 0;
  useEffect(() => {
    setHoverSentence(-1);
    setPinnedSentence(-1);
  }, [result]);

  // A new paragraph: bring its top into view if it's off-screen (the card also glows briefly, in CSS).
  useEffect(() => {
    const el = readerRef.current;
    if (!el || !result || !justGenerated) return; // not for a paragraph restored from the last visit
    if (el.getBoundingClientRect().top < 0)
      el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [result]);

  // Speed changed while the paragraph was playing, and the voice couldn't change speed live (so
  // playback stopped): carry on from the current position at the new speed.
  const wasPlaying = useRef(false);
  useEffect(() => {
    if (wasPlaying.current && !playing) void play(resumeFrom());
  }, [tts.rate]); // only when the speed changes
  useEffect(() => {
    wasPlaying.current = playing;
  }, [playing]);

  // Clear the live highlight whenever playback of this paragraph pauses or ends.
  useEffect(() => {
    if (!playing) setSpokenWord(-1);
  }, [playing]);

  /** Play the paragraph from `startWord` (a clicked word, or the paused position). */
  const play = async (startWord = 0) => {
    if (!result) return;
    setSpokenWord(startWord > 0 ? startWord : -1);
    setResumeWord(startWord);
    setAudioStarted(false);
    const words = result.words.map((w) => w.korean);
    const callbacks = {
      onStart: () => setAudioStarted(true),
      onWord: setSpokenWord,
      onProgress: setResumeWord,
      startWord,
    };
    // A dialogue plays turn by turn, A in the chosen voice and B in a second one.
    const outcome = turns.length
      ? await tts.speakTurns(
          turns.map((t) => ({
            words: words.slice(t.start, t.end),
            speaker:
              t.speaker === "B" ? ("partner" as const) : ("primary" as const),
            start: t.start,
          })),
          PLAY_KEY,
          callbacks,
        )
      : await tts.speak(result.paragraph, PLAY_KEY, { ...callbacks, words });
    // Played to the end: the next Play starts over. Paused/stopped: keep the position.
    if (outcome === "ended") setResumeWord(0);
  };

  /** Remove the paragraph and go back to the empty form (settings are kept). */
  const clear = () => {
    tts.stop();
    setResult(null);
    setUsed(null);
    setEditing(false);
    setResumeWord(0);
    setJustGenerated(false);
    setGenerateError(null);
    setSavedId(null);
    setSaveError(null);
  };

  /** Save the paragraph on screen, or (if it's saved) remove the saved copy. */
  const toggleSave = async () => {
    if (!result || saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      if (savedId) {
        await deleteSavedParagraph(savedId);
        setSavedId(null);
      } else {
        const settings = used ?? { difficulty, length, topic: topic.trim() };
        setSavedId((await saveParagraph(settings, result)).id);
      }
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : "Couldn't save the paragraph.",
      );
    } finally {
      setSaving(false);
    }
  };

  /** Show a saved paragraph in the Reader (from the saved list). Throws if it couldn't be loaded. */
  const openSaved = async (id: string) => {
    const {
      saved: summary,
      settings,
      paragraph,
    } = await openSavedParagraph(id);
    tts.stop();
    setResult(paragraph);
    const practice = paragraph.practice;
    setUsed(
      practice
        ? {
            ...settings,
            grammar: {
              pattern: practice.pattern.id,
              label: practice.pattern.title || practice.pattern.form,
              setting: practice.setting,
              politeness: practice.politeness,
            },
          }
        : settings,
    );
    setSavedId(summary.id);
    setResumeWord(0);
    setEditing(false);
    setJustGenerated(true);
    setGenerateError(null);
    setSaveError(null);
  };

  /**
   * Ready-made: the pattern's next conversation at this speech level (after the one on screen), or at any
   * level if it has none at this one. Instant: no writing animation.
   */
  const openConversation = async (settings: Settings, step: 1 | -1 = 1) => {
    const g = settings.grammar!;
    tts.stop();
    tts.clearError();
    setGenerateError(null);
    setResumeWord(0);
    try {
      const all = await loadConversations(g.pattern);
      if (!all.length)
        throw new Error(
          "This pattern has no ready-made conversations yet. Try your own situation.",
        );
      const atLevel = all.filter(
        (c) => c.practice?.politeness === g.politeness,
      );
      const list = atLevel.length ? atLevel : all;
      const at = list.findIndex(
        (c) => (c as { id?: string }).id === g.conversationId,
      );
      const index =
        (Math.max(at, step === 1 ? -1 : 0) + step + list.length) % list.length;
      setStepBack(step === -1);
      // Same pattern already on screen: swap the conversation inside the card instead of a new card.
      setStepped(
        !!result?.practice &&
          used?.grammar?.source === "library" &&
          used.grammar.pattern === g.pattern,
      );
      const next = list[index] as GenerateResponse & { id?: string };
      setResult(next);
      setUsed({
        ...settings,
        grammar: {
          ...g,
          conversationId: next.id,
          conversationAt: index + 1,
          conversationCount: list.length,
        },
      });
      setSavedId(null);
      setSaveError(null);
      setEditing(false);
      setJustGenerated(true);
    } catch (err) {
      setGenerateError(
        err instanceof Error ? err.message : "Couldn't open a conversation.",
      );
    }
  };

  // Practise from Learn → Grammar: straight to the pattern's first ready-made conversation (no settings
  // form; Change opens it). The URL goes back to plain /reader so a refresh doesn't open it again.
  useEffect(() => {
    if (!practise) return;
    window.history.replaceState(null, "", "/reader");
    window.scrollTo(0, 0);
    void generate({
      difficulty,
      length,
      topic: "",
      grammar: {
        pattern: practise,
        label: practise,
        setting: "",
        source: "library",
        politeness,
      },
    });
  }, []);

  const generate = async (
    settings: Settings = { difficulty, length, topic },
  ) => {
    if (settings.grammar?.source === "library")
      return openConversation(settings);
    setStepped(false);
    tts.stop();
    tts.clearError();
    setResumeWord(0);
    const card = readerRef.current;
    if (card) {
      const style = getComputedStyle(card);
      cardHeightRef.current =
        card.clientHeight -
        parseFloat(style.paddingTop) -
        parseFloat(style.paddingBottom);
    } else {
      cardHeightRef.current = 0;
    }
    setGenerating(true);
    setGenerateError(null);
    try {
      setResult(
        await generateParagraph({
          difficulty: settings.difficulty,
          length: settings.length,
          topic: settings.topic.trim() || undefined,
          ...(settings.grammar && {
            grammar: {
              pattern: settings.grammar.pattern,
              setting: settings.grammar.setting || undefined,
              politeness: settings.grammar.politeness,
            },
          }),
        }),
      );
      setUsed({ ...settings, topic: settings.topic.trim() });
      setSavedId(null);
      setSaveError(null);
      setEditing(false);
      setJustGenerated(true);
    } catch (err) {
      setGenerateError(
        err instanceof Error ? err.message : "Couldn't generate a paragraph.",
      );
    } finally {
      setGenerating(false);
    }
  };

  /** One translated sentence: hover (or tap) it to highlight its Korean sentence. */
  const translatedSentence = (english: string, n: number) => (
    <span
      key={n}
      className={`tr-sentence${n === highlightSentence ? " hl" : ""}${n === playingSentence && tts.followSentence ? " playing" : ""}`}
      onMouseEnter={() => setHoverSentence(n)}
      // Touch screens have no hover: tap a sentence to pin its highlight (tap again to clear).
      onClick={() => setPinnedSentence((p) => (p === n ? -1 : n))}
    >
      {english}{" "}
    </span>
  );

  return (
    <>
      {/* The tall form and the slim summary bar swap with a height animation, so the page glides. */}
      <AnimatedHeight>
        {result && used && !editing ? (
          <SummaryBar
            // A grammar text's own pattern title (texts saved before plain titles existed show it too).
            settings={
              used.grammar && result?.practice
                ? {
                    ...used,
                    grammar: {
                      ...used.grammar,
                      label:
                        result.practice.pattern.title || used.grammar.label,
                      politeness: result.practice.politeness,
                    },
                  }
                : used
            }
            onChange={() => setEditing(true)}
          />
        ) : (
          // One card for both modes: the switch stays put, and only the fields below it change (sliding in
          // from the side you switched towards) while the card's height glides to fit.
          <div className="card generate-form reader-form">
            <ModeSwitch mode={mode} onChange={setMode} />
            <AnimatedHeight>
              <div
                key={mode}
                className={`mode-pane from-${mode === "grammar" ? "right" : "left"}`}
              >
                {mode === "grammar" ? (
                  <GrammarForm
                    embedded
                    patternId={patternId}
                    onPattern={(p) => {
                      setPatternId(p.id);
                      setPatternLabel(p.title);
                    }}
                    source={source}
                    onSource={setSource}
                    customSetting={customSetting}
                    onCustomSetting={setCustomSetting}
                    politeness={politeness}
                    onPoliteness={setPoliteness}
                    length={length}
                    onLength={setLength}
                    loading={generating}
                    onGenerate={() =>
                      patternId &&
                      void generate({
                        difficulty,
                        length,
                        topic: "",
                        grammar: {
                          pattern: patternId,
                          label: patternLabel || patternId,
                          setting:
                            source === "custom" ? customSetting.trim() : "",
                          source,
                          politeness,
                        },
                      })
                    }
                    onCancel={
                      result && used ? () => setEditing(false) : undefined
                    }
                  />
                ) : (
                  <GenerateForm
                    embedded
                    difficulty={difficulty}
                    length={length}
                    topic={topic}
                    loading={generating}
                    onDifficultyChange={setDifficulty}
                    onLengthChange={setLength}
                    onTopicChange={setTopic}
                    onGenerate={() => void generate()}
                    onCancel={
                      result && used
                        ? () => {
                            // Back to the settings of the paragraph on screen.
                            setDifficulty(used.difficulty);
                            setLength(used.length);
                            setTopic(used.topic);
                            setEditing(false);
                          }
                        : undefined
                    }
                  />
                )}
              </div>
            </AnimatedHeight>
          </div>
        )}
      </AnimatedHeight>

      {generateError && (
        <div className="error" role="alert">
          {generateError}
        </div>
      )}

      {/* While a paragraph is being written, the card holds only the writing animation. */}
      {generating && (
        <section className="card reader-writing-card" aria-busy="true">
          <RegeneratingBody fromHeight={cardHeightRef.current} />
        </section>
      )}

      {result && !generating && (
        // Switching the form to the other mode (free writing ↔ grammar) dims the text from the mode you
        // left (it can't be used); switching back brings it back.
        <div
          className={`reader-slot${otherMode ? " dimmed" : ""}`}
          aria-hidden={otherMode || undefined}
        >
          <section
            ref={readerRef}
            key={
              stepped ? `library:${used?.grammar?.pattern}` : result.paragraph
            }
            className={`card reader${justGenerated && !stepped ? " reader-enter reader-new" : ""}`}
            aria-live="polite"
          >
            <div className={`toolbar${loadingAudio ? " loading" : ""}`}>
              {/* On/off chips: the pressed state shows whether each layer is visible. */}
              <div className="toggles">
                <button
                  type="button"
                  className="toggle-chip"
                  aria-pressed={showRomanized}
                  onClick={() => setShowRomanized((v) => !v)}
                  title={
                    showRomanized ? "Hide romanization" : "Show romanization"
                  }
                  aria-label="Romanization"
                >
                  <span className="chip-glyph" aria-hidden="true">
                    Aa
                  </span>
                  <span className="chip-label">Romanization</span>
                </button>
                {result.translation && (
                  <button
                    type="button"
                    className="toggle-chip"
                    aria-pressed={showTranslation}
                    onClick={() => setShowTranslation((v) => !v)}
                    title={
                      showTranslation ? "Hide translation" : "Show translation"
                    }
                    aria-label="Translation"
                  >
                    <span className="chip-glyph" aria-hidden="true">
                      EN
                    </span>
                    <span className="chip-label">Translation</span>
                  </button>
                )}
                <HighlightMenu />
              </div>
              <PlaybackControls
                playing={playing}
                loading={loadingAudio}
                resumable={resumeWord > 0}
                rate={tts.rate}
                onPlay={() => void play(resumeFrom())}
                onStop={tts.stop}
                onRateChange={tts.setRate}
              />
              <button
                type="button"
                className="reader-clear"
                onClick={clear}
                aria-label="Clear this paragraph"
                title="Clear this paragraph"
              >
                ×
              </button>
            </div>
            <div className="reader-body">
              {used && (
                <TextNav
                  settings={used}
                  onStep={(step) => void openConversation(used, step)}
                  onNew={() => void generate(used)}
                />
              )}
              {result.practice && (
                <PatternCard pattern={result.practice.pattern} />
              )}
              <div
                key={result.paragraph}
                className={
                  stepped
                    ? `conversation-swap${stepBack ? " from-left" : ""}`
                    : undefined
                }
              >
                {result.practice?.scene && (
                  // Who's talking and what's happening, so the dialogue makes sense at a glance.
                  <p className="practice-scene">
                    <span>{result.practice.scene}</span>
                    {result.practice.roles?.A && turns.length > 0 && (
                      <span className="practice-roles">
                        <span className="role">
                          <span className="speaker-badge">A</span>{" "}
                          {result.practice.roles.A}
                        </span>
                        {result.practice.roles.B && (
                          <span className="role turn-B">
                            <span className="speaker-badge">B</span>{" "}
                            {result.practice.roles.B}
                          </span>
                        )}
                      </span>
                    )}
                  </p>
                )}
                <ParagraphView
                  words={result.words}
                  highlights={highlights}
                  turns={turns}
                  // Sentence highlighting only makes sense while the translation is showing.
                  sentenceOf={showTranslation ? sentenceOf : undefined}
                  highlightSentence={showTranslation ? highlightSentence : -1}
                  onHoverSentence={setHoverSentence}
                  showRomanized={showRomanized}
                  activeIndex={playing && tts.wordsFollowed ? spokenWord : -1}
                  readingSentenceOf={readingSentenceOf}
                  readingSentence={tts.followSentence ? readingSentence : -1}
                  pausedIndex={paused && wordLevel ? resumeWord : -1}
                  pausedSentence={
                    paused && !wordLevel
                      ? (readingSentenceOf[resumeWord] ?? -1)
                      : -1
                  }
                  onPlayFrom={(i) => void play(i)}
                  onPlayWord={(i) =>
                    void tts.speak(
                      result.words[i].korean,
                      `${PLAY_KEY}-word-${i}`,
                    )
                  }
                  playingWord={
                    tts.playingKey?.startsWith(`${PLAY_KEY}-word-`)
                      ? Number(tts.playingKey.slice(`${PLAY_KEY}-word-`.length))
                      : -1
                  }
                  loadingWord={
                    tts.loadingKey?.startsWith(`${PLAY_KEY}-word-`)
                      ? Number(tts.loadingKey.slice(`${PLAY_KEY}-word-`.length))
                      : -1
                  }
                  onStopWord={tts.stop}
                />
              </div>
              <AnimatedHeight>
                {showTranslation && result.translation && turns.length > 0 && (
                  // A dialogue's translation, turn by turn like the Korean.
                  <div
                    className="translation dialogue reader-enter"
                    lang="en"
                    onMouseLeave={() => setHoverSentence(-1)}
                  >
                    {turns.map((t) => (
                      <div key={t.start} className={`turn turn-${t.speaker}`}>
                        <span className="speaker-badge" aria-hidden="true">
                          {t.speaker}
                        </span>
                        <p className="turn-words">
                          {(result.sentences ?? []).map((s, n) =>
                            s.start >= t.start && s.start < t.end
                              ? translatedSentence(s.english, n)
                              : null,
                          )}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
                {showTranslation &&
                  result.translation &&
                  turns.length === 0 && (
                    <p
                      className="translation reader-enter"
                      lang="en"
                      onMouseLeave={() => setHoverSentence(-1)}
                    >
                      {result.sentences?.length
                        ? result.sentences.map((s, n) =>
                            translatedSentence(s.english, n),
                          )
                        : result.translation}
                    </p>
                  )}
              </AnimatedHeight>
              <div className="reader-footer">
                <p className="muted small reader-hint">
                  <span className="hint-dot" aria-hidden="true" /> Tap any word
                  for its meaning and audio.
                </p>
                <div className="reader-footer-actions">
                  {used?.grammar?.source !== "library" && (
                    <button
                      type="button"
                      className="footer-chip"
                      onClick={() => setShowSaved(true)}
                      title="Your saved paragraphs"
                    >
                      <IconStack /> All saved
                    </button>
                  )}
                  {used?.grammar?.source !== "library" && (
                    <button
                      type="button"
                      className="footer-chip"
                      aria-pressed={!!savedId}
                      aria-busy={saving || undefined}
                      disabled={saving}
                      onClick={() => void toggleSave()}
                      title={
                        savedId
                          ? "Saved. Press to remove it from your saved paragraphs"
                          : "Keep this paragraph"
                      }
                    >
                      <IconBookmark filled={!!savedId} />
                      <StableLabel
                        options={["Save", "Saved"]}
                        current={savedId ? "Saved" : "Save"}
                      />
                    </button>
                  )}
                </div>
              </div>
              {saveError && (
                <p className="error small" role="alert">
                  {saveError}
                </p>
              )}
            </div>
          </section>
        </div>
      )}

      {!result && !generating && !generateError && (
        <div className="reader-empty">
          <span className="reader-empty-art" lang="ko" aria-hidden="true">
            가
          </span>
          <p>
            <strong>
              {mode === "grammar"
                ? "Your conversation will appear here"
                : "Your paragraph will appear here"}
            </strong>
            <span className="muted">
              {mode === "grammar"
                ? "Choose a pattern, then press Practise."
                : "Pick a level and length, then press Generate."}
            </span>
          </p>
          {mode === "free" && (
            <button
              type="button"
              className="footer-chip"
              onClick={() => setShowSaved(true)}
            >
              <IconStack /> Open a saved paragraph
            </button>
          )}
        </div>
      )}

      {showSaved && (
        <SavedParagraphsSheet
          currentId={result ? savedId : null}
          onOpen={openSaved}
          onDeleted={(id) => id === savedId && setSavedId(null)}
          onClose={() => setShowSaved(false)}
        />
      )}
    </>
  );
}
