/**
 * Grammar patterns for practice (same for everyone). D1 in the Worker; an in-memory list in tests.
 * Rows are loaded from data/grammarPatterns.json by scripts/grammar/buildSeed.ts.
 */
import type { GrammarPattern } from "../../../src/data/grammarMeta";

export interface GrammarStore {
  /** Every pattern, and a version that changes whenever any pattern does. */
  list(): Promise<{ patterns: GrammarPattern[]; version: string }>;
  get(id: string): Promise<GrammarPattern | null>;
  /** The ready-made conversations for a pattern (each the Reader's paragraph shape, as JSON objects). */
  conversations(patternId: string): Promise<unknown[]>;
}

interface Row {
  id: string;
  form: string;
  title: string;
  explain: string;
  sample: string;
  meaning: string;
  level: number;
  group_id: string;
  register: string;
  attaches: string;
  examples: string;
  similar: string;
  note: string | null;
  variants: string;
  aliases: string;
  speech_levels: string;
  updated_at: number;
}

const json = <T>(text: string, fallback: T): T => {
  try {
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
};

const toPattern = (r: Row): GrammarPattern => ({
  id: r.id,
  form: r.form,
  title: r.title,
  explain: r.explain,
  sample: json(r.sample, { ko: "", en: "" }),
  meaning: r.meaning,
  level: r.level,
  group: r.group_id as GrammarPattern["group"],
  register: r.register as GrammarPattern["register"],
  attaches: r.attaches,
  examples: json(r.examples, []),
  similar: json(r.similar, []),
  ...(r.note && { note: r.note }),
  ...(json<unknown[]>(r.variants, []).length && { variants: json(r.variants, []) }),
  ...(json<unknown[]>(r.aliases, []).length && { aliases: json(r.aliases, []) }),
  ...(json<unknown[]>(r.speech_levels, []).length < 3 && { speechLevels: json(r.speech_levels, []) }),
});

export class D1GrammarStore implements GrammarStore {
  constructor(private readonly db: D1Database) {}

  async list() {
    const { results } = await this.db.prepare("SELECT * FROM grammar_patterns ORDER BY sort").all<Row>();
    const latest = results.reduce((m, r) => Math.max(m, r.updated_at), 0);
    return { patterns: results.map(toPattern), version: `${results.length}-${latest}` };
  }

  /** By id, or by the old id of a variant merged into it. */
  async get(id: string) {
    const row =
      (await this.db.prepare("SELECT * FROM grammar_patterns WHERE id = ?").bind(id).first<Row>()) ??
      (await this.db
        .prepare("SELECT * FROM grammar_patterns WHERE instr(aliases, ?) > 0")
        .bind(JSON.stringify(id))
        .first<Row>());
    return row ? toPattern(row) : null;
  }

  async conversations(patternId: string) {
    const { results } = await this.db
      .prepare("SELECT data FROM grammar_conversations WHERE pattern_id = ? ORDER BY sort")
      .bind(patternId)
      .all<{ data: string }>();
    return results.flatMap((r) => {
      try {
        return [JSON.parse(r.data) as unknown];
      } catch {
        return [];
      }
    });
  }
}

export class MemoryGrammarStore implements GrammarStore {
  constructor(
    private readonly patterns: GrammarPattern[] = [],
    private readonly version = "test",
    private readonly library: { patternId: string }[] = [],
  ) {}

  async conversations(patternId: string) {
    return this.library.filter((c) => c.patternId === patternId);
  }

  async list() {
    return { patterns: this.patterns, version: this.version };
  }

  async get(id: string) {
    return this.patterns.find((p) => p.id === id || p.aliases?.includes(id)) ?? null;
  }
}
