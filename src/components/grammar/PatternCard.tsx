/**
 * A grammar pattern's card. Above a text it's one line (meaning and form); "How it works" opens the
 * example, a plain explanation, how it attaches, two examples (the pattern part highlighted), variants and a
 * note. In the form ("compact") it's the meaning and an example, with Change.
 */
import { useState, type ReactNode } from "react";
import { GRAMMAR_GROUPS, type GrammarPattern } from "../../data/grammarMeta";
import { AnimatedHeight } from "../AnimatedHeight";
import { IconChevronDown } from "../words/icons";

/** The sentence with the pattern's part highlighted. */
function Example({ ko, part }: { ko: string; part: string }): ReactNode {
  const at = part ? ko.indexOf(part) : -1;
  if (at < 0) return ko;
  return (
    <>
      {ko.slice(0, at)}
      <mark className="pattern-part">{part}</mark>
      {ko.slice(at + part.length)}
    </>
  );
}

/** Korean with how it's read in a tooltip (hover, or tap/focus on touch screens). */
export function Romanized({
  ko,
  rom,
  children,
  inButton = false,
}: {
  ko: string;
  rom?: string;
  children?: ReactNode;
  /** Inside a button (the picker's rows): hover only, since a button can't hold another focusable. */
  inButton?: boolean;
}) {
  if (!rom) return <span lang="ko">{children ?? ko}</span>;
  return (
    <span
      className="romanized"
      lang="ko"
      data-rom={rom}
      {...(!inButton && { tabIndex: 0, "aria-label": `${ko} (${rom})` })}
    >
      {children ?? ko}
    </span>
  );
}

/** The explanation, with the pattern's form (named in it, e.g. "Put -아요/어요 at the end…") as a chip. */
function Explain({ text, form }: { text: string; form: string }): ReactNode {
  const at = text.indexOf(form);
  if (at < 0) return text;
  return (
    <>
      {text.slice(0, at)}
      <span className="pattern-form-inline" lang="ko">
        {form}
      </span>
      {text.slice(at + form.length)}
    </>
  );
}

/** "How it attaches" split into its sentences, one rule each. */
function rules(attaches: string): string[] {
  return attaches
    .split(/(?<=[.;])\s+(?=[A-Z가-힣"(-])/)
    .map((r) => r.trim())
    .filter(Boolean);
}

/** The pattern's example, marked "e.g." so it isn't read as its meaning. */
export function PatternExample({
  sample,
  inButton = false,
}: {
  sample: { ko: string; en: string; rom?: string };
  inButton?: boolean;
}) {
  return (
    <span className="pattern-example">
      <span className="pattern-example-label">e.g.</span>
      <span className="pattern-sample-ko">
        <Romanized ko={sample.ko} rom={sample.rom} inButton={inButton} />
      </span>
      <span className="pattern-sample-en">{sample.en}</span>
    </span>
  );
}

export function PatternCard({
  pattern,
  action,
  defaultOpen = false,
  compact = false,
}: {
  pattern: GrammarPattern;
  /** e.g. a "Change" button on the right of the header. */
  action?: ReactNode;
  defaultOpen?: boolean;
  /** Just the example and title (in the form; the full card is shown above the text). */
  compact?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  if (compact) {
    return (
      <div className="pattern-card compact">
        <div className="pattern-card-head">
          <span className="pattern-card-title">
            <span className="pattern-meaning-line">
              <span className="pattern-title">{pattern.title}</span>
              <span className="pattern-notation" lang="ko">
                {pattern.form}
              </span>
            </span>
            <PatternExample sample={pattern.sample} />
          </span>
          {action}
        </div>
      </div>
    );
  }
  // Above the text: one line (meaning, form, "How it works"); everything else opens from it.
  const group = GRAMMAR_GROUPS.find((g) => g.id === pattern.group)?.label;
  return (
    <div className={`pattern-card slim${open ? " open" : ""}`}>
      <div className="pattern-card-head">
        <span className="pattern-meaning-line">
          <span className="pattern-title">{pattern.title}</span>
          <span className="pattern-notation" lang="ko">
            {pattern.form}
          </span>
        </span>
        <button type="button" className="pattern-card-toggle" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          How it works <IconChevronDown />
        </button>
        {action}
      </div>
      <AnimatedHeight>
        {open && (
          <div className="pattern-card-body">
            <section className="pattern-section">
              <h4 className="pattern-section-label">What it does</h4>
              <p className="pattern-explain">
                <Explain text={pattern.explain} form={pattern.form} />
              </p>
            </section>
            <section className="pattern-section">
              <h4 className="pattern-section-label">How to form it</h4>
              {/* One rule per line: "stem + -아요 if …", "하다 becomes 해요 …" read better apart. */}
              <ul className="pattern-rules">
                {rules(pattern.attaches).map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </section>
            <section className="pattern-section">
              <h4 className="pattern-section-label">Examples</h4>
              <ul className="pattern-examples">
                {pattern.examples.map((e) => (
                  <li key={e.ko}>
                    <span>
                      <Romanized ko={e.ko} rom={e.rom}>
                        <Example ko={e.ko} part={e.part} />
                      </Romanized>
                    </span>
                    <span className="muted small">{e.en}</span>
                  </li>
                ))}
              </ul>
            </section>
            {(pattern.note || pattern.variants?.length) && (
              <section className="pattern-section">
                <h4 className="pattern-section-label">Good to know</h4>
                {pattern.note && <p className="pattern-note small">{pattern.note}</p>}
                {pattern.variants?.length ? (
                  <p className="pattern-variants small">
                    Similar forms:{" "}
                    {pattern.variants.map((v, i) => (
                      <span key={v.form}>
                        {i > 0 && " · "}
                        <span lang="ko">{v.form}</span> <span className="muted">({v.title})</span>
                      </span>
                    ))}
                  </p>
                ) : null}
              </section>
            )}
            <p className="pattern-card-meta muted small">
              {pattern.level}급{group && ` · ${group}`}
              {pattern.register !== "both" && ` · mostly ${pattern.register}`}
            </p>
          </div>
        )}
      </AnimatedHeight>
    </div>
  );
}
