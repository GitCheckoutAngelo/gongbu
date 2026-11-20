import type { FormEvent, ReactNode } from "react";
import type { Difficulty, Length } from "../types";
import { IconBars, IconLines, IconSparkle, IconTag } from "./words/icons";

interface Props {
  difficulty: Difficulty;
  length: Length;
  topic: string;
  loading: boolean;
  onDifficultyChange: (d: Difficulty) => void;
  onLengthChange: (l: Length) => void;
  onTopicChange: (t: string) => void;
  onGenerate: () => void;
  /** When set (a paragraph already exists), show "Keep current" next to Generate: close without regenerating. */
  onCancel?: () => void;
  /** Inside another card (the Reader's form card with the mode switch): no card of its own. */
  embedded?: boolean;
}

export interface Option<T> {
  value: T;
  label: string;
  hint: string;
  icon: ReactNode;
}

// Hints match the generator's guidance (worker/services/paragraph/providers/claude.ts).
export const DIFFICULTIES: Option<Difficulty>[] = [
  { value: "beginner", label: "Beginner", hint: "TOPIK 1–2", icon: <IconBars level={1} /> },
  { value: "intermediate", label: "Intermediate", hint: "TOPIK 3–4", icon: <IconBars level={2} /> },
  { value: "advanced", label: "Advanced", hint: "TOPIK 5–6", icon: <IconBars level={3} /> },
];

export const LENGTHS: Option<Length>[] = [
  { value: "short", label: "Short", hint: "2–3 sentences", icon: <IconLines count={2} /> },
  { value: "medium", label: "Medium", hint: "4–6 sentences", icon: <IconLines count={3} /> },
  { value: "long", label: "Long", hint: "8–12 sentences", icon: <IconLines count={5} /> },
];

/** A row of icon tiles that behaves like a radio group. */
export function TileGroup<T extends string>(props: {
  legend: string;
  options: Option<T>[];
  value: T;
  onChange: (v: T) => void;
  /** Options that can't be chosen right now (greyed out). */
  isDisabled?: (v: T) => boolean;
  /** A short line under the tiles (e.g. why some are unavailable). */
  note?: string;
}) {
  return (
    <fieldset className="field">
      <legend>{props.legend}</legend>
      <div className="option-tiles" role="radiogroup" aria-label={props.legend}>
        {props.options.map((opt) => {
          const selected = opt.value === props.value;
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={props.isDisabled?.(opt.value)}
              className={`option-tile${selected ? " selected" : ""}`}
              onClick={() => props.onChange(opt.value)}
            >
              <span className="option-icon">{opt.icon}</span>
              <span className="option-label">{opt.label}</span>
              <span className="option-hint">{opt.hint}</span>
            </button>
          );
        })}
      </div>
      {props.note && <p className="muted small tile-note">{props.note}</p>}
    </fieldset>
  );
}

export function GenerateForm(props: Props) {
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!props.loading) props.onGenerate();
  };

  return (
    <form className={props.embedded ? "generate-fields" : "card generate-form"} onSubmit={submit}>
      <TileGroup
        legend="Difficulty"
        options={DIFFICULTIES}
        value={props.difficulty}
        onChange={props.onDifficultyChange}
      />
      <TileGroup legend="Length" options={LENGTHS} value={props.length} onChange={props.onLengthChange} />
      <div className="field">
        <label htmlFor="topic">
          Topic <span className="muted">(optional)</span>
        </label>
        <div className="input-with-icon">
          <IconTag />
          <input
            id="topic"
            type="text"
            maxLength={200}
            placeholder="e.g. 커피, travel, my weekend"
            value={props.topic}
            onChange={(e) => props.onTopicChange(e.target.value)}
          />
        </div>
      </div>
      <div className="generate-actions">
        <button type="submit" className="primary generate-button" disabled={props.loading} aria-busy={props.loading}>
          {props.loading ? <span className="spinner" aria-hidden="true" /> : <IconSparkle />}
          {props.loading ? "Writing your paragraph…" : "Generate"}
        </button>
        {props.onCancel && (
          <button
            type="button"
            className="generate-cancel"
            onClick={props.onCancel}
            disabled={props.loading}
            title="Close the settings and keep the paragraph you have"
          >
            Keep current
          </button>
        )}
      </div>
    </form>
  );
}
