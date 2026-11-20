/**
 * The grammar patterns for practice, loaded from the API (GET /api/grammar, from the database) once per
 * visit and shared; the browser's HTTP cache (ETag) avoids re-downloading an unchanged list.
 */
import { ApiError } from "../../api/client";
import { config } from "../../config";
import type { GrammarPattern } from "../../data/grammarMeta";
import type { GenerateResponse } from "../../types";

let pending: Promise<GrammarPattern[]> | null = null;

export function loadGrammar(): Promise<GrammarPattern[]> {
  pending ??= (async () => {
    let res: Response;
    try {
      res = await fetch(`${config.apiBaseUrl}/grammar`);
    } catch {
      throw new ApiError("Couldn't reach the server to load the grammar patterns. Check your connection.");
    }
    if (!res.ok)
      throw new ApiError(`Couldn't load the grammar patterns (${res.status}). Please try again.`, res.status);
    const data = (await res.json()) as { patterns?: GrammarPattern[] };
    if (!Array.isArray(data.patterns) || data.patterns.length === 0) {
      throw new ApiError("The grammar list came back empty. Please try again.");
    }
    return data.patterns;
  })().catch((err) => {
    pending = null;
    throw err;
  });
  return pending;
}

const conversationsByPattern = new Map<string, Promise<GenerateResponse[]>>();

/** A pattern's ready-made conversations (fetched once per visit). Rejects with an ApiError on failure. */
export function loadConversations(patternId: string): Promise<GenerateResponse[]> {
  let pending = conversationsByPattern.get(patternId);
  if (!pending) {
    pending = (async () => {
      let res: Response;
      try {
        res = await fetch(`${config.apiBaseUrl}/grammar/conversations?pattern=${encodeURIComponent(patternId)}`);
      } catch {
        throw new ApiError("Couldn't reach the server to load the conversations. Check your connection.");
      }
      if (!res.ok) throw new ApiError(`Couldn't load the conversations (${res.status}). Please try again.`, res.status);
      const data = (await res.json()) as { conversations?: GenerateResponse[] };
      return Array.isArray(data.conversations) ? data.conversations : [];
    })().catch((err) => {
      conversationsByPattern.delete(patternId);
      throw err;
    });
    conversationsByPattern.set(patternId, pending);
  }
  return pending;
}
