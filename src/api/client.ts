import { config } from "../config";
import type { Progress } from "../services/progress/types";
import { getSyncKey } from "../services/sync/syncKey";
import type { Difficulty, GenerateRequest, GenerateResponse, Length } from "../types";
import type { RuleId } from "../data/types";
import type { CategoryId, LetterNoteId, Level, LevelBand, PartOfSpeech } from "../data/vocabularyMeta";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request(path: string, body: unknown): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(`${config.apiBaseUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ApiError("Couldn't reach the server. Is the backend running?");
  }
  if (!res.ok) {
    throw new ApiError(await errorMessage(res), res.status);
  }
  return res;
}

async function errorMessage(res: Response): Promise<string> {
  try {
    const data = await res.json();
    if (typeof data?.detail === "string") return data.detail;
  } catch {
    // Not JSON (e.g. the dev proxy couldn't reach the backend).
  }
  if (res.status === 502 || res.status === 503 || res.status === 504) {
    return "The server isn't responding. Is the backend running?";
  }
  return `Request failed (${res.status}). Please try again.`;
}

export async function generateParagraph(req: GenerateRequest): Promise<GenerateResponse> {
  const res = await request("/generate", req);
  return (await res.json()) as GenerateResponse;
}

/** `voice`: a server TTS voice id (e.g. "ko-KR-Neural2-A"); omitted = the server's default. */
export async function synthesizeSpeech(text: string, rate: number, voice?: string): Promise<Blob> {
  const res = await request("/tts", { text, rate, ...(voice && { voice }) });
  return res.blob();
}

/** Audio plus each word's start time in seconds (null if the server's TTS can't report timings). */
export async function synthesizeTimedSpeech(
  words: string[],
  rate: number,
  voice?: string,
): Promise<{ audio: Blob; wordTimes: number[] | null }> {
  const res = await request("/tts/timed", { words, rate, ...(voice && { voice }) });
  const data = (await res.json()) as { audio_base64: string; mime_type: string; word_times: number[] | null };
  const bytes = Uint8Array.from(atob(data.audio_base64), (c) => c.charCodeAt(0));
  return { audio: new Blob([bytes], { type: data.mime_type }), wordTimes: data.word_times };
}

/**
 * Exact word start times for a recording (speech recognition on the server), or null if alignment
 * isn't available. Never throws: alignment is an optional improvement.
 */
export async function alignWords(audio: Blob, words: string[]): Promise<number[] | null> {
  try {
    const bytes = new Uint8Array(await audio.arrayBuffer());
    let bin = "";
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    const res = await request("/tts/align", { audio_base64: btoa(bin), words });
    const data = (await res.json()) as { word_times: number[] | null };
    return Array.isArray(data.word_times) && data.word_times.length === words.length ? data.word_times : null;
  } catch {
    return null;
  }
}

export interface TtsVoiceInfo {
  name: string;
  gender: "female" | "male" | "neutral";
  family: string;
}

/** The server TTS's voices (Google's Korean voices) and its default voice. */
export async function listTtsVoices(): Promise<{ voices: TtsVoiceInfo[]; default: string }> {
  let res: Response;
  try {
    res = await fetch(`${config.apiBaseUrl}/tts/voices`);
  } catch {
    throw new ApiError("Couldn't reach the server. Is the backend running?");
  }
  if (!res.ok) throw new ApiError(await errorMessage(res), res.status);
  return (await res.json()) as { voices: TtsVoiceInfo[]; default: string };
}

/** A word suggested by the server (POST /api/words/suggest); not yet approved by the learner. */
export interface SuggestedWord {
  spelling: string;
  meaning: string;
  pos: PartOfSpeech;
  level: Level;
  pronounced?: string;
  rules: RuleId[];
  letters: LetterNoteId[];
  note?: string;
  romanization: string;
}

export async function suggestWords(
  category: CategoryId,
  band: LevelBand,
  count: number,
  exclude: string[],
): Promise<SuggestedWord[]> {
  const res = await request("/words/suggest", { category, band, count, exclude });
  return ((await res.json()) as { words: SuggestedWord[] }).words;
}

// ---------- Per-learner data (sent with this browser's sync key) ----------

async function dataRequest<T>(method: "GET" | "POST" | "PUT" | "DELETE", path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${config.apiBaseUrl}${path}`, {
      method,
      headers: { "X-Sync-Key": getSyncKey(), ...(body !== undefined && { "Content-Type": "application/json" }) },
      ...(body !== undefined && { body: JSON.stringify(body) }),
    });
  } catch {
    throw new ApiError("Couldn't reach the server. Check your connection and try again.");
  }
  if (!res.ok) throw new ApiError(await errorMessage(res), res.status);
  return (await res.json()) as T;
}

/** Common Words progress saved online for this browser (null if none yet). Not validated: parse it. */
export async function fetchCloudProgress(): Promise<unknown> {
  return (await dataRequest<{ progress: unknown }>("GET", "/progress")).progress;
}

/** Upload progress; the server merges it with what it had and returns the result (not validated). */
export async function uploadCloudProgress(progress: Progress): Promise<unknown> {
  return (await dataRequest<{ progress: unknown }>("PUT", "/progress", { progress })).progress;
}

export interface ParagraphSettings {
  difficulty: Difficulty;
  length: Length;
  topic: string;
}

export interface SavedParagraphSummary extends ParagraphSettings {
  id: string;
  /** ms since 1970 */
  createdAt: number;
  /** The paragraph's first characters. */
  preview: string;
}

export async function listSavedParagraphs(): Promise<SavedParagraphSummary[]> {
  return (await dataRequest<{ paragraphs: SavedParagraphSummary[] }>("GET", "/paragraphs")).paragraphs;
}

export async function saveParagraph(
  settings: ParagraphSettings,
  paragraph: GenerateResponse,
): Promise<SavedParagraphSummary> {
  return (await dataRequest<{ saved: SavedParagraphSummary }>("POST", "/paragraphs", { settings, paragraph })).saved;
}

export async function openSavedParagraph(
  id: string,
): Promise<{ saved: SavedParagraphSummary; settings: ParagraphSettings; paragraph: GenerateResponse }> {
  return dataRequest("GET", `/paragraphs/${encodeURIComponent(id)}`);
}

export async function deleteSavedParagraph(id: string): Promise<void> {
  await dataRequest("DELETE", `/paragraphs/${encodeURIComponent(id)}`);
}
