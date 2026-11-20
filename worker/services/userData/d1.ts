/** UserDataStore on Cloudflare D1 (binding "DB"; schema in migrations/). */
import type { SavedParagraph, SavedParagraphSummary, UserDataStore } from "./types";

interface ParagraphRow {
  id: string;
  created_at: number;
  difficulty: string;
  length: string;
  topic: string;
  preview: string;
  data?: string;
}

const summary = (r: ParagraphRow): SavedParagraphSummary => ({
  id: r.id,
  createdAt: r.created_at,
  difficulty: r.difficulty,
  length: r.length,
  topic: r.topic,
  preview: r.preview,
});

export class D1UserDataStore implements UserDataStore {
  constructor(private readonly db: D1Database) {}

  async getProgress(owner: string): Promise<string | null> {
    const row = await this.db
      .prepare("SELECT data FROM progress WHERE owner = ?")
      .bind(owner)
      .first<{ data: string }>();
    return row?.data ?? null;
  }

  async putProgress(owner: string, data: string, now: number): Promise<void> {
    await this.db
      .prepare(
        "INSERT INTO progress (owner, data, updated_at) VALUES (?1, ?2, ?3) " +
          "ON CONFLICT (owner) DO UPDATE SET data = ?2, updated_at = ?3",
      )
      .bind(owner, data, now)
      .run();
  }

  async listParagraphs(owner: string): Promise<SavedParagraphSummary[]> {
    const { results } = await this.db
      .prepare(
        "SELECT id, created_at, difficulty, length, topic, preview FROM saved_paragraphs " +
          "WHERE owner = ? ORDER BY created_at DESC",
      )
      .bind(owner)
      .all<ParagraphRow>();
    return results.map(summary);
  }

  async countParagraphs(owner: string): Promise<number> {
    const row = await this.db
      .prepare("SELECT COUNT(*) AS n FROM saved_paragraphs WHERE owner = ?")
      .bind(owner)
      .first<{ n: number }>();
    return row?.n ?? 0;
  }

  async getParagraph(owner: string, id: string): Promise<SavedParagraph | null> {
    const row = await this.db
      .prepare("SELECT * FROM saved_paragraphs WHERE owner = ? AND id = ?")
      .bind(owner, id)
      .first<ParagraphRow>();
    return row ? { ...summary(row), data: row.data ?? "" } : null;
  }

  async addParagraph(owner: string, p: SavedParagraph): Promise<void> {
    await this.db
      .prepare(
        "INSERT INTO saved_paragraphs (id, owner, created_at, difficulty, length, topic, preview, data) " +
          "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .bind(p.id, owner, p.createdAt, p.difficulty, p.length, p.topic, p.preview, p.data)
      .run();
  }

  async deleteParagraph(owner: string, id: string): Promise<boolean> {
    const res = await this.db.prepare("DELETE FROM saved_paragraphs WHERE owner = ? AND id = ?").bind(owner, id).run();
    return (res.meta.changes ?? 0) > 0;
  }
}
