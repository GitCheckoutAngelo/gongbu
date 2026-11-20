/**
 * Learn → Grammar: how a Korean sentence is built (sentence basics), then every grammar pattern as a
 * reference, each with "How it works" and a Practise button that opens the Reader with it chosen.
 */
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  BasicsPlayground,
  MainPin,
} from "../components/grammar/BasicsPlayground";
import { GlossText, GlossTip } from "../components/grammar/GlossText";
import { PatternCard } from "../components/grammar/PatternCard";
import {
  IconChevronLeft,
  IconChevronRight,
  IconSpeaker,
  IconPlay,
} from "../components/words/icons";
import {
  GRAMMAR_GROUPS,
  type GrammarGroupId,
  type GrammarPattern,
} from "../data/grammarMeta";
import {
  ROLE_LABELS,
  SENTENCE_BASICS,
  type BasicsExample,
  type BasicsTopic,
} from "../data/sentenceBasics";
import { Link, navigate } from "../router";
import { loadGrammar } from "../services/grammar/grammarList";
import { useTts } from "../tts/TtsContext";

const LEVEL_CHOICES = [1, 2, 3, 4] as const;

/** Open the Reader's grammar practice with this pattern chosen. */
export const practiseHref = (patternId: string) =>
  `/reader#practise=${encodeURIComponent(patternId)}`;

/** Plays the example aloud: a round speaker button (a spinner while loading, a stop square while playing). */
function ListenButton({ text }: { text: string }) {
  const { speak, stop, playingKey, loadingKey } = useTts();
  const playing = playingKey === text;
  const loading = loadingKey === text;
  return (
    <button
      type="button"
      className={`listen-button${playing ? " playing" : ""}`}
      aria-label={
        loading
          ? "Loading audio (press to cancel)"
          : playing
            ? "Stop"
            : `Play ${text}`
      }
      title={playing ? "Stop" : "Listen"}
      aria-busy={loading || undefined}
      onClick={() => (playing || loading ? stop() : void speak(text))}
    >
      {loading ? (
        <span className="spinner" />
      ) : playing ? (
        <span className="listen-stop" />
      ) : (
        <IconSpeaker />
      )}
    </button>
  );
}

/** An example sentence split into its parts, each with what it is underneath. */
function Breakdown({
  example,
  pinLast,
}: {
  example: BasicsExample;
  /** Mark the last part as the main word (the steps about sentence types and word order). */
  pinLast?: boolean;
}) {
  const sentence = example.parts
    .map((p) => p.ko)
    .join(example.oneWord ? "" : " ");
  return (
    <div className="breakdown">
      {(example.heading || example.pattern) && (
        <div className="breakdown-head">
          {example.heading && (
            <span className="breakdown-heading">{example.heading}</span>
          )}
          {example.pattern && (
            <code className="breakdown-pattern" lang="ko">
              {example.pattern}
            </code>
          )}
        </div>
      )}
      <div
        className={`breakdown-parts${example.oneWord ? " one-word" : ""}`}
        lang="ko"
      >
        {example.parts.map((p, i) => (
          <span
            key={i}
            className={`breakdown-part has-tip role-${p.role}`}
            tabIndex={0}
          >
            <GlossTip ko={p.ko} />
            <span className="breakdown-ko">
              {pinLast && i === example.parts.length - 1 && <MainPin />}
              {p.particle && p.ko.endsWith(p.particle) ? (
                <>
                  {p.ko.slice(0, -p.particle.length)}
                  <span className="breakdown-particle">{p.particle}</span>
                </>
              ) : (
                p.ko
              )}
            </span>
            {p.particle && p.tag ? (
              // Noun + particle, each with its meaning: 주말 weekend + 에 at (a time).
              <span className="breakdown-gloss breakdown-split" lang="en">
                <span>
                  <span lang="ko">{p.ko.slice(0, -p.particle.length)}</span>{" "}
                  {p.gloss}
                </span>
                <span className="breakdown-tag">
                  + <span lang="ko">{p.particle}</span> {p.tag}
                </span>
              </span>
            ) : (
              <span className="breakdown-gloss" lang="en">
                {p.gloss}
                <span className="breakdown-role"> · {ROLE_LABELS[p.role]}</span>
              </span>
            )}
          </span>
        ))}
      </div>
      <div className="breakdown-meaning">
        <ListenButton text={sentence} />
        <span className="breakdown-lines">
          <span className="breakdown-rom">{example.rom}</span>
          <span className="breakdown-en">{example.en}</span>
        </span>
      </div>
    </div>
  );
}

function BasicsCard({
  topic,
  children,
}: {
  topic: BasicsTopic;
  children?: ReactNode;
}) {
  return (
    <article className="card basics-card" id={topic.id}>
      <h3 className="basics-title">
        {topic.title}
        <span className="muted ko-sub" lang="ko">
          {topic.ko}
        </span>
      </h3>
      <p className="basics-explain">
        <GlossText text={topic.explain} />
      </p>
      <div className="basics-examples">
        {topic.examples.map((e, i) => (
          <Breakdown key={i} example={e} pinLast={topic.id === "order"} />
        ))}
      </div>
      {topic.tableIntro && (
        <p className="basics-table-intro small">
          <GlossText text={topic.tableIntro} />
        </p>
      )}
      {topic.table && (
        <dl className="basics-table">
          {topic.table.map((row) => (
            <div key={row.label} className="basics-row">
              <dt lang="ko">
                {/* An ending is shown as written: its 을 or 는 isn't the tag, so no word bubbles. */}
                {row.ending ? row.ko : <GlossText text={row.ko} />}
                {row.rom && <span className="basics-row-rom">{row.rom}</span>}
              </dt>
              <dd>
                <GlossText text={row.label} />
                {row.uses ? (
                  <ol className="basics-uses">
                    {row.uses.map((u) => (
                      <li key={u}>
                        <GlossText text={u} />
                      </li>
                    ))}
                  </ol>
                ) : (
                  row.example && (
                    <span className="muted basics-example">
                      <GlossText text={row.example} />
                    </span>
                  )
                )}
              </dd>
            </div>
          ))}
        </dl>
      )}
      {topic.note && (
        <p className="basics-note small muted">
          <GlossText text={topic.note} />
        </p>
      )}
      {children}
    </article>
  );
}

function PatternReference() {
  const [patterns, setPatterns] = useState<GrammarPattern[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [level, setLevel] = useState<number | null>(null);
  const [group, setGroup] = useState<GrammarGroupId | "">("");

  useEffect(() => {
    let live = true;
    loadGrammar()
      .then((list) => live && setPatterns(list))
      .catch((err: Error) => live && setError(err.message));
    return () => {
      live = false;
    };
  }, []);

  const q = query.trim().toLowerCase();
  const visible = useMemo(
    () =>
      (patterns ?? []).filter(
        (p) =>
          (!level || p.level === level) &&
          (!group || p.group === group) &&
          (!q ||
            `${p.form} ${p.title} ${p.meaning} ${p.explain} ${p.sample.ko} ${p.sample.en} ${(
              p.variants ?? []
            )
              .map((v) => `${v.form} ${v.title}`)
              .join(" ")}`
              .toLowerCase()
              .includes(q)),
      ),
    [patterns, level, group, q],
  );
  const byGroup = GRAMMAR_GROUPS.map((g) => ({
    ...g,
    items: visible.filter((p) => p.group === g.id),
  })).filter((g) => g.items.length);

  return (
    <section
      className="grammar-reference"
      aria-labelledby="grammar-patterns-title"
    >
      <div className="card">
        <h2 id="grammar-patterns-title">
          Grammar patterns <span className="muted ko-sub">문형</span>
        </h2>
        <p className="muted">
          The endings and particles that add meaning: wanting, reasons, plans,
          contrast… Open one to see how it works, or practise it with real
          conversations in the Reader.
        </p>
        <input
          type="search"
          className="search"
          placeholder="Search in English or Korean, e.g. because, want to, 싶다"
          aria-label="Search patterns"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="pattern-filters">
          <div className="level-chips" role="group" aria-label="Level">
            <button
              type="button"
              aria-pressed={level === null}
              onClick={() => setLevel(null)}
            >
              All
            </button>
            {LEVEL_CHOICES.map((l) => (
              <button
                key={l}
                type="button"
                aria-pressed={level === l}
                onClick={() => setLevel(level === l ? null : l)}
              >
                {l}급
              </button>
            ))}
          </div>
          <select
            aria-label="Meaning"
            value={group}
            onChange={(e) => setGroup(e.target.value as GrammarGroupId | "")}
          >
            <option value="">Any meaning</option>
            {GRAMMAR_GROUPS.map((g) => (
              <option key={g.id} value={g.id}>
                {g.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : !patterns ? (
        <p className="muted small words-loading">
          <span className="spinner" aria-hidden="true" /> Loading patterns…
        </p>
      ) : byGroup.length === 0 ? (
        <p className="empty muted">No patterns match.</p>
      ) : (
        byGroup.map((g) => (
          <div key={g.id} className="grammar-group">
            <h3 className="pattern-group-title">
              {g.label}{" "}
              <span className="grammar-group-count">{g.items.length}</span>
            </h3>
            <div className="grammar-group-list">
              {g.items.map((p) => (
                <PatternCard
                  key={p.id}
                  pattern={p}
                  action={
                    <button
                      type="button"
                      className="pattern-practise"
                      onClick={() => navigate(practiseHref(p.id))}
                      title="Practise this pattern in the Reader"
                    >
                      <IconPlay />{" "}
                      <span className="pattern-practise-label">Practise</span>
                    </button>
                  }
                />
              ))}
            </div>
          </div>
        ))
      )}
    </section>
  );
}

/** /grammar: sentence basics; /grammar/patterns: the pattern reference (tabs in the Layout switch them). */
/** The topic open from the URL (/grammar#particles), else the first. */
const topicFromHash = () =>
  Math.max(
    0,
    SENTENCE_BASICS.findIndex((t) => `#${t.id}` === window.location.hash),
  );

/** Sentence basics as steps: one topic at a time, with the steps across the top and Back / Next below. */
function BasicsSteps() {
  const [step, setStep] = useState(topicFromHash);
  const [from, setFrom] = useState<"left" | "right" | null>(null);
  // Smooth switching: remember the card's height before the step changes, then grow or shrink
  // from it to the new card's height, so the page below glides instead of jumping.
  const pane = useRef<HTMLDivElement>(null);
  const heightBefore = useRef<number | null>(null);
  useLayoutEffect(() => {
    const el = pane.current;
    const was = heightBefore.current;
    heightBefore.current = null;
    if (!el || was === null) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const now = el.offsetHeight;
    if (Math.abs(now - was) < 2) return;
    el.style.overflow = "clip";
    const anim = el.animate([{ height: `${was}px` }, { height: `${now}px` }], {
      duration: 320,
      easing: "cubic-bezier(0.2, 0.8, 0.2, 1)",
    });
    anim.onfinish = anim.oncancel = () => {
      el.style.overflow = "";
    };
  }, [step]);
  const go = (to: number) => {
    if (to === step) return;
    heightBefore.current = pane.current?.offsetHeight ?? null;
    setFrom(to > step ? "right" : "left");
    setStep(to);
    window.history.replaceState(null, "", `/grammar#${SENTENCE_BASICS[to].id}`);
    // From Back / Next at the bottom: bring the steps (top of the new topic) back into view.
    const steps = document.querySelector(".basics-steps");
    if (steps && steps.getBoundingClientRect().top < 0)
      steps.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const topic = SENTENCE_BASICS[step];
  const prev = SENTENCE_BASICS[step - 1];
  const next = SENTENCE_BASICS[step + 1];
  return (
    <>
      <p className="basics-intro muted">
        How a Korean sentence is put together, in {SENTENCE_BASICS.length} short
        steps. Tap the speaker to hear an example, and hover or tap any Korean
        word to see how it&rsquo;s read and what it means.
      </p>
      <nav className="basics-steps" aria-label="Sentence basics">
        {SENTENCE_BASICS.map((t, i) => (
          <button
            key={t.id}
            type="button"
            className={`basics-step${i < step ? " done" : ""}`}
            aria-current={i === step ? "step" : undefined}
            onClick={() => go(i)}
          >
            <span className="basics-number">{i + 1}</span>
            <span className="basics-step-label">{t.short}</span>
          </button>
        ))}
      </nav>
      <div ref={pane}>
        <div
          key={topic.id}
          className={from ? `mode-pane from-${from}` : undefined}
        >
          <BasicsCard topic={topic}>
            <BasicsPlayground
              topicId={topic.id}
              listen={(text) => <ListenButton text={text} />}
            />
            <div className="basics-pager">
              {prev ? (
                <button
                  type="button"
                  className="basics-back"
                  onClick={() => go(step - 1)}
                >
                  <IconChevronLeft /> Back
                </button>
              ) : (
                <span />
              )}
              {next ? (
                <button
                  type="button"
                  className="primary basics-forward"
                  onClick={() => go(step + 1)}
                >
                  Next: {next.short} <IconChevronRight />
                </button>
              ) : (
                <Link
                  to="/grammar/patterns"
                  className="button primary basics-forward"
                >
                  Next: grammar patterns <IconChevronRight />
                </Link>
              )}
            </div>
          </BasicsCard>
        </div>
      </div>
    </>
  );
}

/** /grammar: sentence basics; /grammar/patterns: the pattern reference (tabs in the Layout switch them). */
export function GrammarPage({ view }: { view: "basics" | "patterns" }) {
  return view === "patterns" ? <PatternReference /> : <BasicsSteps />;
}
