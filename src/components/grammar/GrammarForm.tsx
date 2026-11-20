/**
 * Reader, Grammar mode: choose a pattern and who's speaking to whom (politeness), then either open one of
 * its ready-made conversations (instant, checked) or describe your own situation for Claude to write.
 */
import { useEffect, useState, type FormEvent } from "react";
import {
  POLITENESS,
  type GrammarPattern,
  type Politeness,
} from "../../data/grammarMeta";
import { loadGrammar } from "../../services/grammar/grammarList";
import type { Length } from "../../types";
import { LENGTHS, TileGroup, type Option } from "../GenerateForm";
import { IconSparkle } from "../words/icons";
import { PatternCard } from "./PatternCard";
import { PatternPicker } from "./PatternPicker";

/** Where the text comes from: the ready-made library, or your own situation (written by Claude). */
export type PracticeSource = "library" | "custom";

const POLITENESS_OPTIONS: Option<Politeness>[] = POLITENESS.map((p) => ({
  value: p.id,
  label: p.label,
  hint: p.short,
  icon: (
    <span className="politeness-glyph" lang="ko">
      {p.ko}
    </span>
  ),
}));

/** Same tiles as "Speaking to" (a Korean word on top), so the form reads as one set of choices. */
const SOURCE_OPTIONS: Option<PracticeSource>[] = [
  {
    value: "library",
    label: "Everyday conversations",
    hint: "ready-made and checked",
    icon: (
      <span className="politeness-glyph" lang="ko">
        일상
      </span>
    ),
  },
  {
    value: "custom",
    label: "Your own situation",
    hint: "describe it, Claude writes it",
    icon: (
      <span className="politeness-glyph" lang="ko">
        직접
      </span>
    ),
  },
];

interface Props {
  patternId: string | null;
  onPattern: (pattern: GrammarPattern) => void;
  source: PracticeSource;
  onSource: (source: PracticeSource) => void;
  customSetting: string;
  onCustomSetting: (text: string) => void;
  politeness: Politeness;
  onPoliteness: (p: Politeness) => void;
  length: Length;
  onLength: (l: Length) => void;
  loading: boolean;
  onGenerate: () => void;
  onCancel?: () => void;
  /** Inside another card (the Reader's form card with the mode switch): no card of its own. */
  embedded?: boolean;
}

export function GrammarForm(props: Props) {
  const [patterns, setPatterns] = useState<GrammarPattern[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);

  useEffect(() => {
    let live = true;
    loadGrammar()
      .then((list) => live && setPatterns(list))
      .catch((err: Error) => live && setLoadError(err.message));
    return () => {
      live = false;
    };
  }, []);

  const pattern =
    patterns?.find(
      (p) =>
        p.id === props.patternId || p.aliases?.includes(props.patternId ?? ""),
    ) ?? null;
  // Speech levels this pattern is used at; a choice it can't use moves to one it can.
  const allowed = pattern?.speechLevels ?? POLITENESS.map((p) => p.id);
  const { politeness, onPoliteness } = props;
  useEffect(() => {
    if (pattern && !allowed.includes(politeness))
      onPoliteness(allowed.includes("polite") ? "polite" : allowed[0]);
  }, [pattern, politeness]);
  const levelNote =
    pattern && allowed.length < POLITENESS.length
      ? `This pattern is only used in ${allowed
          .map((l) => POLITENESS.find((p) => p.id === l)!.label.toLowerCase())
          .join(" and ")} speech.`
      : undefined;
  const custom = props.source === "custom";
  const canGenerate = !!pattern && !(custom && !props.customSetting.trim());

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!props.loading && canGenerate) props.onGenerate();
  };

  return (
    <form
      className={`${props.embedded ? "generate-fields" : "card generate-form"} grammar-form`}
      onSubmit={submit}
    >
      <div className="field">
        <span className="field-label">Grammar pattern</span>
        {loadError ? (
          <p className="error small" role="alert">
            {loadError}
          </p>
        ) : !patterns ? (
          <p className="muted small words-loading">
            <span className="spinner" aria-hidden="true" /> Loading patterns…
          </p>
        ) : pattern ? (
          <PatternCard
            compact
            pattern={pattern}
            action={
              <button
                type="button"
                className="pattern-change"
                onClick={() => setPicking(true)}
              >
                Change
              </button>
            }
          />
        ) : (
          <button
            type="button"
            className="pattern-choose"
            onClick={() => setPicking(true)}
          >
            <span className="pattern-choose-glyph" lang="ko" aria-hidden="true">
              -고
            </span>
            <span>
              <strong>Choose a pattern</strong>
              <span className="muted small">
                {" "}
                {patterns.length} patterns, TOPIK 1–4
              </span>
            </span>
          </button>
        )}
      </div>

      <TileGroup
        legend="Speaking to"
        options={POLITENESS_OPTIONS}
        value={props.politeness}
        onChange={props.onPoliteness}
        isDisabled={(l) => !allowed.includes(l)}
        note={levelNote}
      />

      <div className="situation-field">
        <TileGroup
          legend="Situation"
          options={SOURCE_OPTIONS}
          value={props.source}
          onChange={props.onSource}
        />
        {custom && (
          <input
            type="text"
            className="setting-custom"
            maxLength={120}
            placeholder="e.g. returning a jacket that doesn't fit"
            aria-label="Your own situation"
            value={props.customSetting}
            onChange={(e) => props.onCustomSetting(e.target.value)}
            autoFocus
          />
        )}
      </div>

      {/* Ready-made conversations have their own length; only your own situation takes one. */}
      {custom && (
        <TileGroup
          legend="Length"
          options={LENGTHS}
          value={props.length}
          onChange={props.onLength}
        />
      )}

      <div className="generate-actions">
        <button
          type="submit"
          className="primary generate-button"
          disabled={props.loading || !canGenerate}
          aria-busy={props.loading}
          title={pattern ? undefined : "Choose a pattern first"}
        >
          {props.loading ? (
            <span className="spinner" aria-hidden="true" />
          ) : (
            <IconSparkle />
          )}
          {props.loading ? (custom ? "Writing…" : "Opening…") : "Practise"}
        </button>
        {props.onCancel && (
          <button
            type="button"
            className="generate-cancel"
            onClick={props.onCancel}
            disabled={props.loading}
          >
            Keep current
          </button>
        )}
      </div>

      {picking && patterns && (
        <PatternPicker
          patterns={patterns}
          selectedId={props.patternId}
          onPick={props.onPattern}
          onClose={() => setPicking(false)}
        />
      )}
    </form>
  );
}
