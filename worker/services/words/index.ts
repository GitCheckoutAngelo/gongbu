/**
 * The shared word list (same for everyone). D1 in the Worker; an in-memory list in tests.
 * Rows are loaded from data/wordSeed.json by scripts/wordlist/buildSeed.ts.
 */
export interface SharedWord {
  id: string;
  spelling: string;
  meaning: string;
  pos: string;
  category: string;
  level: number;
  romanization: string;
  pronounced?: string;
  rules?: string[];
  letters?: string[];
  note?: string;
  register: string;
  spokenRank?: number;
}

export interface WordStore {
  /** Every word, and a version that changes whenever any word does. */
  list(): Promise<{ words: SharedWord[]; version: string }>;
}

interface WordRow {
  id: string;
  spelling: string;
  meaning: string;
  pos: string;
  category: string;
  level: number;
  romanization: string;
  pronounced: string | null;
  rules: string;
  letters: string;
  note: string | null;
  register: string;
  spoken_rank: number | null;
  updated_at: number;
}

const parseList = (json: string): string[] => {
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
};

export function rowToWord(r: WordRow): SharedWord {
  const rules = parseList(r.rules);
  const letters = parseList(r.letters);
  return {
    id: r.id,
    spelling: r.spelling,
    meaning: r.meaning,
    pos: r.pos,
    category: r.category,
    level: r.level,
    romanization: r.romanization,
    ...(r.pronounced && { pronounced: r.pronounced }),
    ...(rules.length && { rules }),
    ...(letters.length && { letters }),
    ...(r.note && { note: r.note }),
    register: r.register,
    ...(r.spoken_rank != null && { spokenRank: r.spoken_rank }),
  };
}

export class D1WordStore implements WordStore {
  constructor(private readonly db: D1Database) {}

  async list() {
    const { results } = await this.db.prepare("SELECT * FROM words ORDER BY rowid").all<WordRow>();
    const latest = results.reduce((m, r) => Math.max(m, r.updated_at), 0);
    return { words: results.map(rowToWord), version: `${results.length}-${latest}` };
  }
}

export class MemoryWordStore implements WordStore {
  constructor(
    private readonly words: SharedWord[] = [],
    private readonly version = "test",
  ) {}

  async list() {
    return { words: this.words, version: this.version };
  }
}
