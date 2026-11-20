/** Shapes of Claude's drafts (buildPatterns.ts writes them; buildSeed.ts reads them). */
import type { GrammarGroupId } from "../../src/data/grammarMeta";

export interface InventoryItem {
  form: string;
  level: number;
  group: GrammarGroupId;
  register: string;
  meaning: string;
}

export interface Card {
  form: string;
  attaches: string;
  examples: { ko: string; en: string; part: string }[];
  similar: string[];
  note: string;
}

/** Plain-language face of a pattern, for learners who don't know grammar terms. */
export interface Plain {
  /** A short plain title, e.g. "by, using, towards". */
  title: string;
  /** One plain sentence: what it does and how it's used, with no grammar terms. */
  explain: string;
  /** A tiny Korean example chunk and its English, e.g. 버스로 / "by bus". */
  sample: { ko: string; en: string };
}

/** A pattern's key: form and group (one ending can have two uses, e.g. -아서/어서 "and then" and "because"). */
export const patternKey = (p: { form: string; group: string }) => `${p.form}|${p.group}`;
