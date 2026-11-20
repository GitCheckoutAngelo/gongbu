/** UserDataStore in memory: for tests, and a stand-in when no database is configured. */
import type { SavedParagraph, SavedParagraphSummary, UserDataStore } from "./types";

export class MemoryUserDataStore implements UserDataStore {
  private progress = new Map<string, string>();
  private paragraphs = new Map<string, SavedParagraph & { owner: string }>();

  async getProgress(owner: string) {
    return this.progress.get(owner) ?? null;
  }

  async putProgress(owner: string, data: string) {
    this.progress.set(owner, data);
  }

  async listParagraphs(owner: string): Promise<SavedParagraphSummary[]> {
    return [...this.paragraphs.values()]
      .filter((p) => p.owner === owner)
      .sort((a, b) => b.createdAt - a.createdAt)
      .map(({ id, createdAt, difficulty, length, topic, preview }) => ({
        id,
        createdAt,
        difficulty,
        length,
        topic,
        preview,
      }));
  }

  async countParagraphs(owner: string) {
    return (await this.listParagraphs(owner)).length;
  }

  async getParagraph(owner: string, id: string) {
    const p = this.paragraphs.get(id);
    if (!p || p.owner !== owner) return null;
    const copy: SavedParagraph & { owner?: string } = { ...p };
    delete copy.owner;
    return copy;
  }

  async addParagraph(owner: string, p: SavedParagraph) {
    this.paragraphs.set(p.id, { ...p, owner });
  }

  async deleteParagraph(owner: string, id: string) {
    const p = this.paragraphs.get(id);
    if (!p || p.owner !== owner) return false;
    this.paragraphs.delete(id);
    return true;
  }
}
