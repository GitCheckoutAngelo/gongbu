/**
 * Progress (de)serialization: used by stores to read saved data and by Export/Import for backups.
 * Parsing validates everything, so a damaged or hand-edited file can't break the app.
 */
import type { CommonWord } from "../../data/commonWords";
import {
  CATEGORY_IDS,
  LETTER_NOTE_IDS,
  LEVELS,
  PART_OF_SPEECH_IDS,
  RULE_IDS_FOR_WORDS,
} from "../../data/vocabularyMeta";
import { isDate } from "../srs/dates";
import { DRILL_MODES, type CardState, type DrillMode } from "../srs/types";
import { DEFAULT_SETTINGS, emptyProgress, type Progress } from "./types";

// Keeps the project's old name on purpose, so existing backup files still import.
export const BACKUP_APP = "korean-reader/common-words";

export class BackupError extends Error {}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const num = (v: unknown, min: number, max: number): v is number =>
  typeof v === "number" && Number.isFinite(v) && v >= min && v <= max;
const MODES = DRILL_MODES.map((m) => m.id) as string[];

function parseCard(v: unknown): CardState | null {
  if (!isObj(v)) return null;
  const { ease, interval, reps, lapses, due, lastReviewed, streak, everWrong } = v;
  if (!num(ease, 1, 10) || !num(interval, 0, 100_000) || !num(reps, 0, 1e6) || !num(lapses, 0, 1e6)) return null;
  if (!isDate(due) || !isDate(lastReviewed) || !num(streak, 0, 1e6)) return null;
  return { ease, interval, reps, lapses, due, lastReviewed, streak, everWrong: everWrong === true };
}

function parseWord(v: unknown): CommonWord | null {
  if (!isObj(v)) return null;
  const s = (x: unknown, max: number) => (typeof x === "string" && x.trim() && x.length <= max ? x : null);
  const id = s(v.id, 60);
  const spelling = s(v.spelling, 20);
  const meaning = s(v.meaning, 120);
  if (!id || !spelling || !meaning || !/^[가-힣]+( [가-힣]+)*$/.test(spelling)) return null;
  if (!(CATEGORY_IDS as unknown[]).includes(v.category) || !(PART_OF_SPEECH_IDS as unknown[]).includes(v.pos)) return null;
  const level = (LEVELS as readonly unknown[]).includes(v.level) ? (v.level as CommonWord["level"]) : 2;
  const list = <T,>(x: unknown, allowed: readonly T[]) =>
    Array.isArray(x) ? x.filter((i): i is T => (allowed as readonly unknown[]).includes(i)) : [];
  const pronounced = s(v.pronounced, 60) ?? undefined;
  const rules = list(v.rules, RULE_IDS_FOR_WORDS);
  const letters = list(v.letters, LETTER_NOTE_IDS);
  return {
    id,
    spelling,
    meaning,
    pos: v.pos as CommonWord["pos"],
    category: v.category as CommonWord["category"],
    level,
    romanization: typeof v.romanization === "string" ? v.romanization.slice(0, 80) : "",
    ...(pronounced && { pronounced }),
    ...(rules.length && { rules }),
    ...(letters.length && { letters }),
    ...(s(v.note, 300) && { note: v.note as string }),
    source: "added",
  };
}

/** Parse saved or imported progress. Invalid cards/words are dropped; an unreadable file throws. */
export function parseProgress(data: unknown): Progress {
  const root = isObj(data) && isObj(data.progress) ? data.progress : data;
  if (!isObj(root) || root.version !== 1) throw new BackupError("This isn't a Common Words backup file.");
  const progress = emptyProgress();

  if (isObj(root.cards)) {
    for (const [key, value] of Object.entries(root.cards)) {
      const mode = key.split("|")[1];
      const card = parseCard(value);
      if (card && MODES.includes(mode)) progress.cards[key] = card;
    }
  }
  if (isObj(root.newToday) && isDate(root.newToday.date) && isObj(root.newToday.counts)) {
    progress.newToday.date = root.newToday.date;
    for (const [mode, count] of Object.entries(root.newToday.counts)) {
      if (MODES.includes(mode) && num(count, 0, 10_000)) progress.newToday.counts[mode as DrillMode] = count;
    }
  }
  if (isObj(root.settings)) {
    const { newPerDay, maxReviews } = root.settings;
    progress.settings = {
      newPerDay: num(newPerDay, 0, 100) ? Math.round(newPerDay) : DEFAULT_SETTINGS.newPerDay,
      maxReviews: num(maxReviews, 1, 9999) ? Math.round(maxReviews) : DEFAULT_SETTINGS.maxReviews,
    };
  }
  if (Array.isArray(root.addedWords)) {
    const seen = new Set<string>();
    for (const w of root.addedWords.map(parseWord)) {
      if (w && !seen.has(w.id)) {
        seen.add(w.id);
        progress.addedWords.push(w);
      }
    }
  }
  return progress;
}

/** A downloadable backup (JSON). */
export function serializeBackup(progress: Progress, now: Date = new Date()): string {
  return JSON.stringify({ app: BACKUP_APP, exportedAt: now.toISOString(), progress }, null, 2);
}

export function parseBackup(text: string): Progress {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new BackupError("That file isn't valid JSON.");
  }
  return parseProgress(data);
}
