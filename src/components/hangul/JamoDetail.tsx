import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { CATEGORY_TITLES } from "../../data/hangul";
import { alsoInvolvedRules, changeRowsFor, onlyBasic, type ChangeRow } from "../../data/soundChanges";
import type { Jamo } from "../../data/types";
import { lookupExample } from "../../data/exampleWords";
import { Link } from "../../router";
import { KoText } from "../KoText";
import { SpeakButton } from "../SpeakButton";
import { SoundChangeTable } from "./SoundChangeTable";

export type DetailTab = "examples" | "notes";

interface Props {
  jamo: Jamo;
  /** Selected tab; owned by the page so it stays the same when switching letters. */
  tab: DetailTab;
  onTabChange: (tab: DetailTab) => void;
  onClose: () => void;
}

/**
 * One position the letter can appear in: a play button for an example syllable, the romanization
 * there, and the generated table of how neighbors change it.
 */
function PositionCard(props: {
  title: ReactNode;
  subtitle?: string;
  syllable?: string;
  pronounced?: string;
  romanization?: string;
  formula?: string;
  children?: ReactNode;
  muted?: boolean;
}) {
  return (
    <section className={`position-card${props.muted ? " muted-card" : ""}`}>
      <h3 className="position-title">
        {props.title}
        {props.subtitle && <span className="position-subtitle"> · {props.subtitle}</span>}
      </h3>
      {props.syllable && (
        <div className="position-main">
          <SpeakButton text={props.syllable} label={`Play ${props.syllable}`} className="position-play">
            <span className="position-syllable" lang="ko">
              {props.syllable}
            </span>
          </SpeakButton>
          <div className="position-meta">
            <span className="position-rom">{props.romanization}</span>
            <span className="muted small" lang="ko">
              {props.formula}
              {props.pronounced && props.pronounced !== props.syllable && <> → [{props.pronounced}]</>}
            </span>
          </div>
        </div>
      )}
      {props.children}
    </section>
  );
}

/** The generated table, or a one-line summary when nothing changes the sound. */
function Changes({
  rows,
  position,
  unchanged,
}: {
  rows: ChangeRow[];
  position: ChangeRow["position"];
  unchanged: string;
}) {
  if (rows.length === 0) return <p className="position-text muted">{unchanged}</p>;
  if (onlyBasic(rows))
    return (
      <p className="position-text muted">
        Always <KoText text={rows[0].becomes} />, {unchanged.charAt(0).toLowerCase() + unchanged.slice(1)}
      </p>
    );
  return <SoundChangeTable rows={rows} position={position} />;
}

function ExamplesTab({ jamo }: { jamo: Jamo }) {
  return (
    <ul className="example-words">
      {jamo.examples.map((key) => {
        const w = lookupExample(key);
        return (
          <li key={key}>
            <SpeakButton text={w.spelling} />
            <span className="example-hangul" lang="ko">
              {w.spelling}
            </span>
            {w.pronounced && (
              <span className="muted" lang="ko">
                [{w.pronounced}]
              </span>
            )}
            <span className="example-rom">{w.romanization}</span>
            <span className="example-meaning">{w.meaning}</span>
          </li>
        );
      })}
    </ul>
  );
}

function NotesTab({ jamo }: { jamo: Jamo }) {
  return (
    <ul className="notes">
      {(jamo.notes ?? []).map((n) => (
        <li key={n}>
          <KoText text={n} />
        </li>
      ))}
    </ul>
  );
}

export function JamoDetail({ jamo, tab, onTabChange, onClose }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const rows = useMemo(() => changeRowsFor(jamo.char), [jamo.char]);
  const alsoInvolved = useMemo(() => alsoInvolvedRules(jamo.char), [jamo.char]);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.classList.add("no-scroll");
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.classList.remove("no-scroll");
    };
  }, [jamo.id, onClose]);

  const isConsonant = jamo.kind === "consonant";
  const tabs: { id: DetailTab; label: string }[] = [
    { id: "examples", label: `Example words (${jamo.examples.length})` },
    ...(jamo.notes?.length ? [{ id: "notes" as const, label: `Notes (${jamo.notes.length})` }] : []),
  ];
  // If this letter lacks the chosen tab (e.g. no Notes), show Examples
  // without forgetting the user's choice for the next letter.
  const activeTab = tabs.some((t) => t.id === tab) ? tab : "examples";

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="jamo-detail-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button ref={closeRef} type="button" className="sheet-close" aria-label="Close" onClick={onClose}>
          ×
        </button>

        {/* Identity */}
        <div className="detail-head">
          <span className="detail-char" lang="ko" aria-hidden="true">
            {jamo.char}
          </span>
          <div className="detail-head-text">
            <div className="name-row">
              <h2 id="jamo-detail-title">
                <span lang="ko">{jamo.name}</span>{" "}
                <span className="muted detail-name-rom">
                  {jamo.nameRomanization}
                  {jamo.namePronounced && jamo.namePronounced !== jamo.name && <> · [{jamo.namePronounced}]</>}
                </span>
              </h2>
              {/* Vowel names are the same as their sound (아), which the card below already plays. */}
              {isConsonant && (
                <SpeakButton text={jamo.name} label={`Play the letter name ${jamo.name}`} className="name-speak" />
              )}
            </div>
            <span className="muted small">{CATEGORY_TITLES[jamo.category].singular}</span>
          </div>
        </div>

        {/* How to say it */}
        <div className="detail-sound">
          <p>
            <KoText text={jamo.sound} />
          </p>
          <p className="muted small">
            IPA: <KoText text={jamo.ipa} />
          </p>
        </div>

        {/* How its sound changes, per position in the syllable */}
        <h3 className="section-title">How its sound changes</h3>

        {jamo.kind === "consonant" ? (
          <div className="position-stack">
            <PositionCard
              title="Start of a syllable"
              subtitle="what comes before changes it"
              syllable={jamo.withVowel}
              romanization={jamo.romanization.initial || "silent"}
              formula={`${jamo.char} + ㅏ`}
            >
              <Changes rows={rows.initial} position="initial" unchanged="Whatever comes before it." />
            </PositionCard>
            {jamo.asFinal ? (
              <PositionCard
                title={
                  <>
                    End of a syllable <span lang="ko">받침</span>
                  </>
                }
                subtitle="what comes after changes it"
                syllable={jamo.asFinal.syllable}
                pronounced={jamo.asFinal.pronounced}
                romanization={jamo.romanization.final ?? ""}
                formula={`ㅏ + ${jamo.char}`}
              >
                <Changes rows={rows.final} position="final" unchanged="Whatever comes after it." />
              </PositionCard>
            ) : (
              <PositionCard
                title={
                  <>
                    End of a syllable <span lang="ko">받침</span>
                  </>
                }
                muted
              >
                <p className="position-text muted">Never used as a final consonant.</p>
              </PositionCard>
            )}
          </div>
        ) : (
          <PositionCard
            title="In a syllable"
            syllable={jamo.withIeung}
            romanization={jamo.romanization}
            formula={`ㅇ + ${jamo.char} (ㅇ is silent)`}
          >
            <Changes
              rows={rows.vowel}
              position="vowel"
              unchanged="Its sound doesn't change with the letters around it."
            />
          </PositionCard>
        )}

        {alsoInvolved.length > 0 && (
          <p className="also-involved small">
            <span className="muted">{jamo.char} also causes or results from changes in: </span>
            {alsoInvolved.map((rule, i) => (
              <span key={rule.id}>
                {i > 0 && ", "}
                <Link to={`/rules#${rule.id}`}>{rule.title}</Link>
              </span>
            ))}
          </p>
        )}

        {/* Secondary detail */}
        <div className="detail-tabs" role="tablist" aria-label="More">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`tab-${t.id}`}
              aria-selected={activeTab === t.id}
              aria-controls="detail-tabpanel"
              className={activeTab === t.id ? "selected" : undefined}
              onClick={() => onTabChange(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="detail-panel" role="tabpanel" id="detail-tabpanel" aria-labelledby={`tab-${activeTab}`}>
          {activeTab === "examples" && <ExamplesTab jamo={jamo} />}
          {activeTab === "notes" && <NotesTab jamo={jamo} />}
        </div>
      </div>
    </div>
  );
}
