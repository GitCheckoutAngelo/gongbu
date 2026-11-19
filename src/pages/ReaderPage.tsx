import { useEffect, useMemo, useRef, useState } from "react";
import { generateParagraph } from "../api/client";
import { AnimatedHeight } from "../components/AnimatedHeight";
import { HighlightMenu } from "../components/HighlightMenu";
import { StableLabel } from "../components/StableLabel";
import { DIFFICULTIES, GenerateForm, LENGTHS } from "../components/GenerateForm";
import { IconPencil, IconRepeat, IconTag } from "../components/words/icons";
import { ParagraphView } from "../components/ParagraphView";
import { PlaybackControls } from "../components/PlaybackControls";
import { useTts } from "../tts/TtsContext";
import type { Difficulty, GenerateResponse, Length } from "../types";
import { loadReaderSnapshot, saveReaderSnapshot } from "./readerSnapshot";

const PLAY_KEY = "reader-paragraph";

interface Settings {
  difficulty: Difficulty;
  length: Length;
  topic: string;
}

/** The form, collapsed once a paragraph exists: what it was made with, plus Change and Regenerate. */
function SummaryBar({
  settings,
  generating,
  onChange,
  onRegenerate,
}: {
  settings: Settings;
  generating: boolean;
  onChange: () => void;
  onRegenerate: () => void;
}) {
  const d = DIFFICULTIES.find((o) => o.value === settings.difficulty)!;
  const l = LENGTHS.find((o) => o.value === settings.length)!;
  return (
    <section className="card reader-summary" aria-label="Paragraph settings">
      <button type="button" className="summary-settings" onClick={onChange} title="Change settings">
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
        <span className="summary-edit">
          <IconPencil /> <span className="summary-edit-text">Change</span>
        </span>
      </button>
      <button
        type="button"
        className="summary-new"
        onClick={onRegenerate}
        disabled={generating}
        aria-busy={generating}
        title="A different paragraph with the same settings"
      >
        <span className="icon-slot" aria-hidden="true">
          {generating ? <span className="spinner" /> : <IconRepeat />}
        </span>
        <StableLabel options={["Regenerate", "Writing…"]} current={generating ? "Writing…" : "Regenerate"} />
      </button>
    </section>
  );
}

export function ReaderPage() {
  const tts = useTts();
  // Restored from the last visit (switching tabs or refreshing keeps your place).
  const [saved] = useState(loadReaderSnapshot);
  const [difficulty, setDifficulty] = useState<Difficulty>(saved?.difficulty ?? "beginner");
  const [length, setLength] = useState<Length>(saved?.length ?? "short");
  const [topic, setTopic] = useState(saved?.topic ?? "");
  const [result, setResult] = useState<GenerateResponse | null>(saved?.result ?? null);
  /** True after generating here: the new paragraph glows; a restored one doesn't. */
  const [justGenerated, setJustGenerated] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [showRomanized, setShowRomanized] = useState(saved?.showRomanized ?? false);
  const [showTranslation, setShowTranslation] = useState(saved?.showTranslation ?? false);
  const [spokenWord, setSpokenWord] = useState(-1);
  /** Where Play continues from after a pause (0 = beginning). */
  const [resumeWord, setResumeWord] = useState(saved?.resumeWord ?? 0);
  const playing = tts.playingKey === PLAY_KEY;
  /** Play pressed but no sound yet (fetching the audio and measuring its pauses). */
  const [audioStarted, setAudioStarted] = useState(false);
  const loadingAudio = playing && !audioStarted;
  /** Settings of the paragraph on screen (the summary bar shows these; "Regenerate" reuses them). */
  const [used, setUsed] = useState<Settings | null>(saved?.used ?? null);

  // Keep the state for the next visit.
  useEffect(() => {
    saveReaderSnapshot({ difficulty, length, topic, result, used, showRomanized, showTranslation, resumeWord });
  }, [difficulty, length, topic, result, used, showRomanized, showTranslation, resumeWord]);
  /** The form is open again on top of an existing paragraph. */
  const [editing, setEditing] = useState(false);
  const readerRef = useRef<HTMLElement>(null);
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
  const readingSentence = position >= 0 ? (readingSentenceOf[position] ?? -1) : -1;

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
    if (el.getBoundingClientRect().top < 0) el.scrollIntoView({ behavior: "smooth", block: "start" });
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
    const outcome = await tts.speak(result.paragraph, PLAY_KEY, {
      onStart: () => setAudioStarted(true),
      words: result.words.map((w) => w.korean),
      onWord: setSpokenWord,
      onProgress: setResumeWord,
      startWord,
    });
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
  };

  const generate = async (settings: Settings = { difficulty, length, topic }) => {
    tts.stop();
    tts.clearError();
    setResumeWord(0);
    setGenerating(true);
    setGenerateError(null);
    try {
      setResult(
        await generateParagraph({
          difficulty: settings.difficulty,
          length: settings.length,
          topic: settings.topic.trim() || undefined,
        }),
      );
      setUsed({ ...settings, topic: settings.topic.trim() });
      setEditing(false);
      setJustGenerated(true);
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : "Couldn't generate a paragraph.");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <>
      {/* The tall form and the slim summary bar swap with a height animation, so the page glides. */}
      <AnimatedHeight>
        {result && used && !editing ? (
          <SummaryBar
            settings={used}
            generating={generating}
            onChange={() => setEditing(true)}
            onRegenerate={() => void generate(used)}
          />
        ) : (
          <GenerateForm
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
      </AnimatedHeight>

      {generateError && (
        <div className="error" role="alert">
          {generateError}
        </div>
      )}

      {result && (
        <section
          ref={readerRef}
          key={result.paragraph}
          className={`card reader${justGenerated ? " reader-enter reader-new" : ""}`}
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
                title={showRomanized ? "Hide romanization" : "Show romanization"}
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
                  title={showTranslation ? "Hide translation" : "Show translation"}
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
          <ParagraphView
            words={result.words}
            // Sentence highlighting only makes sense while the translation is showing.
            sentenceOf={showTranslation ? sentenceOf : undefined}
            highlightSentence={showTranslation ? highlightSentence : -1}
            onHoverSentence={setHoverSentence}
            showRomanized={showRomanized}
            activeIndex={playing && tts.wordsFollowed ? spokenWord : -1}
            readingSentenceOf={readingSentenceOf}
            readingSentence={tts.followSentence ? readingSentence : -1}
            pausedIndex={paused && wordLevel ? resumeWord : -1}
            pausedSentence={paused && !wordLevel ? (readingSentenceOf[resumeWord] ?? -1) : -1}
            onPlayFrom={(i) => void play(i)}
            onPlayWord={(i) => void tts.speak(result.words[i].korean, `${PLAY_KEY}-word-${i}`)}
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
          <AnimatedHeight>
            {showTranslation && result.translation && (
              <p className="translation reader-enter" lang="en" onMouseLeave={() => setHoverSentence(-1)}>
                {result.sentences?.length
                  ? result.sentences.map((s, n) => (
                      <span
                        key={n}
                        className={`tr-sentence${n === highlightSentence ? " hl" : ""}${n === playingSentence && tts.followSentence ? " playing" : ""}`}
                        onMouseEnter={() => setHoverSentence(n)}
                        // Touch screens have no hover: tap a sentence to pin its highlight (tap again to clear).
                        onClick={() => setPinnedSentence((p) => (p === n ? -1 : n))}
                      >
                        {s.english}{" "}
                      </span>
                    ))
                  : result.translation}
              </p>
            )}
          </AnimatedHeight>
          <p className="muted small reader-hint">
            <span className="hint-dot" aria-hidden="true" /> Tap any word for its meaning and audio.
          </p>
        </section>
      )}

      {!result && !generating && !generateError && (
        <div className="reader-empty">
          <span className="reader-empty-art" lang="ko" aria-hidden="true">
            가
          </span>
          <p>
            <strong>Your paragraph will appear here</strong>
            <span className="muted">Pick a level and length, then press Generate.</span>
          </p>
        </div>
      )}
    </>
  );
}
