import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { CommonWord } from "../../data/vocabularyMeta";
import { CATEGORIES, PARTS_OF_SPEECH, type CategoryId } from "../../data/vocabularyMeta";
import { localDate } from "../../services/srs/dates";
import { applyGrade, buildSession, cardKey, requeue, summarize, type SessionCard } from "../../services/srs/session";
import { DRILL_MODES, GRADES, type DrillMode, type Grade } from "../../services/srs/types";
import { navigate } from "../../router";
import { useTts } from "../../tts/TtsContext";
import { SpeakButton } from "../SpeakButton";
import {
  IconArrowRight,
  IconCheckCircle,
  IconClock,
  IconFace,
  IconMistake,
  IconPlay,
  IconPlus,
  IconRepeat,
  IconSparkle,
  IconSpeaker,
  IconStack,
  IconTag,
} from "./icons";
import { WordTags } from "./WordPronunciation";
import { useWords } from "./WordsContext";

const GRADE_LABELS: Record<Grade, string> = { again: "Again", hard: "Hard", good: "Good", easy: "Easy" };
const posLabel = (pos: CommonWord["pos"]) => PARTS_OF_SPEECH.find((p) => p.id === pos)?.label ?? pos;
const categoryLabel = (id: CategoryId) => CATEGORIES.find((c) => c.id === id)?.label ?? id;

function formatInterval(days: number): string {
  if (days <= 0) return "today";
  if (days < 30) return `${days}d`;
  if (days < 365) return `${Math.round(days / 30)}mo`;
  return `${(days / 365).toFixed(1)}y`;
}

/** A tiny flashcard pair, front → back, so each drill is recognizable without reading. */
function ModeGlyph({ mode, small }: { mode: DrillMode; small?: boolean }) {
  const ko = (
    <span className="glyph-card ko" lang="ko">
      가
    </span>
  );
  const en = <span className="glyph-card en">A</span>;
  const audio = (
    <span className="glyph-card audio">
      <IconSpeaker />
    </span>
  );
  const [front, back] = mode === "read" ? [ko, en] : mode === "recall" ? [en, ko] : [audio, en];
  return (
    <span className={`mode-glyph${small ? " small" : ""}`} aria-hidden="true">
      {front}
      <IconArrowRight />
      {back}
    </span>
  );
}

function Stat({ kind, icon, label, value }: { kind: string; icon: ReactNode; label: string; value: number }) {
  return (
    <div className={`stat stat-${kind}${value === 0 ? " zero" : ""}`}>
      <span className="stat-icon">{icon}</span>
      {/* keyed by value: a changed number re-mounts and plays a small tick animation */}
      <dd key={value} className="stat-value">
        {value}
      </dd>
      <dt>{label}</dt>
    </div>
  );
}

interface Running {
  mode: DrillMode;
  today: string;
  queue: SessionCard[];
  index: number;
  revealed: boolean;
  done: number;
}

export function StudyPanel() {
  const { words, progress } = useWords();
  const [mode, setMode] = useState<DrillMode>("read");
  const [category, setCategory] = useState<CategoryId | "">("");
  const [mistakesOnly, setMistakesOnly] = useState(false);
  const [running, setRunning] = useState<Running | null>(null);
  const [finished, setFinished] = useState<number | null>(null);

  const today = localDate();
  const summary = summarize(words, progress, mode, today, category || undefined);
  const count = mistakesOnly
    ? Math.min(summary.mistakes, progress.settings.maxReviews)
    : summary.due + summary.newAvailable;

  const extraBatch = Math.min(progress.settings.newPerDay || 10, summary.unseen);

  const start = (extra: { extraNew?: number; reviewedToday?: boolean } = {}) => {
    const queue = buildSession(words, progress, {
      mode,
      category: category || undefined,
      mistakesOnly: mistakesOnly && !extra.extraNew && !extra.reviewedToday,
      today,
      ...extra,
    });
    if (queue.length === 0) return;
    setFinished(null);
    setRunning({ mode, today, queue, index: 0, revealed: false, done: 0 });
  };

  // Arriving from Home's "Start" (/words#start): begin today's review right away.
  useEffect(() => {
    if (window.location.hash !== "#start") return;
    navigate("/words", { replace: true });
    start();
  }, []); // only on arrival

  if (running) {
    return (
      <SessionView
        running={running}
        onChange={setRunning}
        onEnd={(done) => {
          setRunning(null);
          setFinished(done);
        }}
      />
    );
  }

  return (
    <section className="card study-setup">
      <h2>
        Today <span className="muted ko-sub">오늘의 복습</span>
      </h2>
      {finished !== null && (
        <p className="session-done" role="status">
          Session finished: {finished} {finished === 1 ? "card" : "cards"} reviewed.
        </p>
      )}

      <div className="drill-picker" role="radiogroup" aria-label="Drill">
        {DRILL_MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            role="radio"
            aria-checked={m.id === mode}
            className={`drill-tile${m.id === mode ? " selected" : ""}`}
            onClick={() => setMode(m.id)}
            title={m.description}
          >
            <ModeGlyph mode={m.id} />
            <span className="drill-tile-label">{m.label}</span>
          </button>
        ))}
      </div>

      <div className="study-filters">
        <label className="select-with-icon">
          <IconTag />
          <span className="visually-hidden">Category</span>
          <select value={category} onChange={(e) => setCategory(e.target.value as CategoryId | "")}>
            <option value="">All categories</option>
            {CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className={`chip-toggle mistakes${mistakesOnly ? " on" : ""}`}
          aria-pressed={mistakesOnly}
          onClick={() => setMistakesOnly((v) => !v)}
        >
          <IconMistake /> Mistakes<span className="chip-long"> only</span>
        </button>
      </div>

      {/* Everything below belongs to the chosen drill/filters: keyed so it re-animates when they change. */}
      <div key={mode} className="mode-scope" aria-live="polite">
        <p className="mode-scope-label">
          <ModeGlyph mode={mode} small />
          <span>
            <strong>{DRILL_MODES.find((m) => m.id === mode)?.label}</strong>
            {" · "}
            {category ? categoryLabel(category) : "All categories"}
            {mistakesOnly && " · mistakes only"}
          </span>
        </p>
        <dl className="stats">
          <Stat kind="due" icon={<IconClock />} label="Due" value={summary.due} />
          <Stat kind="new" icon={<IconSparkle />} label="New" value={summary.newAvailable} />
          <Stat kind="mistakes" icon={<IconMistake />} label="Mistakes" value={summary.mistakes} />
          <Stat kind="started" icon={<IconStack />} label="Started" value={summary.learned} />
        </dl>

        {count > 0 ? (
          <button type="button" className="primary start-button" onClick={() => start()}>
            <IconPlay />
            Start
            <span key={count} className="start-count stat-value">
              {count}
            </span>
          </button>
        ) : (
          <div className="done-card" role="status">
            <span className="done-icon">
              <IconCheckCircle />
            </span>
            <div>
              <strong>{mistakesOnly ? "No mistakes to practise" : "All done for today"}</strong>
              <span className="muted small">
                {mistakesOnly ? "Nice work." : "Come back tomorrow, or keep going below."}
              </span>
            </div>
          </div>
        )}

        {!mistakesOnly && (extraBatch > 0 || summary.reviewedToday > 0) && (
          <div className="more-tiles">
            {extraBatch > 0 && (
              <button type="button" className="more-tile new" onClick={() => start({ extraNew: extraBatch })}>
                <span className="more-icon">
                  <IconPlus />
                </span>
                <span>
                  <strong>{extraBatch}</strong> new {extraBatch === 1 ? "word" : "words"}
                </span>
              </button>
            )}
            {summary.reviewedToday > 0 && (
              <button
                type="button"
                className="more-tile again"
                onClick={() => start({ reviewedToday: true })}
                title="Practice only: a right answer won't push the next review further out"
              >
                <span className="more-icon">
                  <IconRepeat />
                </span>
                <span>
                  Practise <strong>{summary.reviewedToday}</strong> again
                </span>
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function SessionView({
  running,
  onChange,
  onEnd,
}: {
  running: Running;
  onChange: (r: Running) => void;
  onEnd: (done: number) => void;
}) {
  const { progress, update, scheduler, homonyms } = useWords();
  const tts = useTts();
  const card = running.queue[running.index];
  const word = card?.word;

  // Listening drill: play the word when the card appears.
  useEffect(() => {
    if (word && running.mode === "listen") void tts.speak(word.spelling);
  }, [running.index, running.queue.length, word?.id]); // only when the card changes

  const previews = useMemo(() => {
    if (!word) return null;
    const prev = progress.cards[cardKey(word.id, running.mode)];
    return Object.fromEntries(
      GRADES.map((g) => {
        if (card.early && prev && g !== "again") return [g, "keeps date"];
        return [g, formatInterval(scheduler.review(prev, g, running.today).interval)];
      }),
    ) as Record<Grade, string>;
  }, [word, card, progress.cards, running.mode, running.today, scheduler]);

  if (!card || !word) return null;

  const grade = (g: Grade) => {
    tts.stop();
    update((p) => applyGrade(p, card, running.mode, g, running.today, scheduler));
    let queue = running.queue;
    if (g === "again") queue = requeue(queue, running.index, { word, isNew: false, early: false });
    const index = running.index + 1;
    if (index >= queue.length) onEnd(running.done + 1);
    else onChange({ ...running, queue, index, revealed: false, done: running.done + 1 });
  };

  const others = homonyms(word);
  const front =
    running.mode === "read" ? (
      <p className="drill-korean" lang="ko">
        {word.spelling}
      </p>
    ) : running.mode === "recall" ? (
      <>
        <p className="drill-english">{word.meaning}</p>
        <p className="muted small">
          {posLabel(word.pos)} · {categoryLabel(word.category)}
        </p>
      </>
    ) : (
      <div className="drill-listen">
        <SpeakButton text={word.spelling} label="Play the word again">
          {" "}
          Play again
        </SpeakButton>
      </div>
    );

  return (
    <section className="card drill" aria-live="polite">
      <div className="drill-head">
        <ModeGlyph mode={running.mode} small />
        <span className="muted small drill-count">
          {running.index + 1} / {running.queue.length}
        </span>
        {card.isNew && (
          <span className="badge badge-new">
            <IconSparkle /> new
          </span>
        )}
        {card.early && (
          <span className="badge">
            <IconRepeat /> practice
          </span>
        )}
        <button type="button" className="link-button drill-end" onClick={() => onEnd(running.done)}>
          End
        </button>
      </div>
      <div
        className="drill-progress"
        role="progressbar"
        aria-label="Session progress"
        aria-valuemin={0}
        aria-valuemax={running.queue.length}
        aria-valuenow={running.index}
      >
        <span style={{ width: `${(running.index / running.queue.length) * 100}%` }} />
      </div>

      <div className="drill-front">{front}</div>

      {!running.revealed ? (
        <button type="button" className="primary drill-reveal" onClick={() => onChange({ ...running, revealed: true })}>
          Show answer
        </button>
      ) : (
        <>
          <div className="drill-back">
            {running.mode !== "read" && (
              <p className="drill-korean" lang="ko">
                {word.spelling}
              </p>
            )}
            {running.mode !== "recall" && <p className="drill-english">{word.meaning}</p>}
            <p className="drill-details">
              <SpeakButton text={word.spelling} />
              <span className="word-rom">{word.romanization}</span>
              {word.pronounced && (
                <span className="word-pron-form" lang="ko">
                  [{word.pronounced.split("/").join(" / ")}]
                </span>
              )}
              {/* Popover tags, not links: following a link would end the session. */}
              <WordTags word={word} links={false} />
            </p>
            <p className="muted small">
              {posLabel(word.pos)} · {categoryLabel(word.category)} · TOPIK {word.level}급
              {word.source === "added" && <span className="badge warn">added by you · unverified</span>}
            </p>
            {word.note && <p className="small">{word.note}</p>}
            {others.length > 0 && running.mode !== "recall" && (
              <p className="small">
                Also means: {others.map((o) => o.meaning).join("; ")} <span className="muted">(separate card)</span>
              </p>
            )}
          </div>
          <div className="grade-buttons" role="group" aria-label="How well did you remember?">
            {GRADES.map((g) => (
              <button key={g} type="button" className={`grade grade-${g}`} onClick={() => grade(g)}>
                <span className="grade-face">
                  <IconFace grade={g} />
                </span>
                <span className="grade-label">{GRADE_LABELS[g]}</span>
                <span className="grade-interval">
                  <IconClock /> {previews?.[g]}
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
