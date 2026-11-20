/**
 * The Common Words list, loaded from the API (GET /api/words, from the database). It's fetched once per
 * visit and shared by the pages that need it; the browser's HTTP cache (ETag) avoids re-downloading an
 * unchanged list.
 */
import { ApiError } from "../../api/client";
import { config } from "../../config";
import {
  CATEGORY_IDS,
  LETTER_NOTE_IDS,
  LEVELS,
  PART_OF_SPEECH_IDS,
  REGISTER_IDS,
  RULE_IDS_FOR_WORDS,
  type CommonWord,
} from "../../data/vocabularyMeta";

/** Fewer than this from the server means something is wrong. */
const MIN_WORDS = 100;

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const str = (v: unknown, max: number) => (typeof v === "string" && v.trim() && v.length <= max ? v : undefined);
const has = <T>(list: readonly T[], v: unknown): v is T => (list as readonly unknown[]).includes(v);
const pick = <T>(v: unknown, allowed: readonly T[]): T[] =>
  Array.isArray(v) ? v.filter((x): x is T => has(allowed, x)) : [];

/** One word from the server, checked; null if it can't be used. */
export function parseSharedWord(v: unknown): CommonWord | null {
  if (!isObj(v)) return null;
  const id = str(v.id, 60);
  const spelling = str(v.spelling, 30);
  const meaning = str(v.meaning, 160);
  const romanization = typeof v.romanization === "string" ? v.romanization.slice(0, 80) : "";
  if (!id || !spelling || !meaning || !/^[가-힣]+( [가-힣]+)*$/.test(spelling)) return null;
  if (!has(PART_OF_SPEECH_IDS, v.pos) || !has(CATEGORY_IDS, v.category) || !has(LEVELS, v.level)) return null;
  const rules = pick(v.rules, RULE_IDS_FOR_WORDS);
  const letters = pick(v.letters, LETTER_NOTE_IDS);
  const pronounced = str(v.pronounced, 60);
  const note = str(v.note, 300);
  return {
    id,
    spelling,
    meaning,
    pos: v.pos,
    category: v.category,
    level: v.level,
    romanization,
    ...(pronounced && { pronounced }),
    ...(rules.length && { rules }),
    ...(letters.length && { letters }),
    ...(note && { note }),
    ...(has(REGISTER_IDS, v.register) && { register: v.register }),
    ...(typeof v.spokenRank === "number" && v.spokenRank > 0 && { spokenRank: v.spokenRank }),
    source: "built-in",
  };
}

let pending: Promise<CommonWord[]> | null = null;

/** The word list. Rejects with an ApiError if it couldn't be loaded (the next call tries again). */
export function loadWords(): Promise<CommonWord[]> {
  pending ??= (async () => {
    let res: Response;
    try {
      res = await fetch(`${config.apiBaseUrl}/words`);
    } catch {
      throw new ApiError("Couldn't reach the server to load the words. Check your connection and try again.");
    }
    if (!res.ok) throw new ApiError(`Couldn't load the words (${res.status}). Please try again.`, res.status);
    const data = (await res.json()) as { words?: unknown };
    const words = Array.isArray(data.words) ? data.words.map(parseSharedWord).filter((w): w is CommonWord => !!w) : [];
    if (words.length < MIN_WORDS) throw new ApiError("The word list came back incomplete. Please try again.");
    return words;
  })().catch((err) => {
    pending = null;
    throw err;
  });
  return pending;
}
