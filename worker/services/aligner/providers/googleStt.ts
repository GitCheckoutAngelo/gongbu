/**
 * Word timings from Google Cloud Speech-to-Text: recognize the (clean, synthetic) TTS audio with word
 * time offsets, then match the recognized words to ours (matchWords). Needs the Cloud Speech-to-Text
 * API enabled for the key (GOOGLE_STT_API_KEY, or GOOGLE_TTS_API_KEY if that key is allowed to use it).
 * Uses v1p1beta1, where MP3 input is supported; synchronous recognition takes up to ~60 s of audio.
 */
import type { Settings } from "../../../config";
import { bytesToBase64 } from "../../../base64";
import { matchWords } from "../matchWords";
import { alignerRegistry, type RecognizedWord, type WordAligner } from "../types";

const API = "https://speech.googleapis.com/v1p1beta1/speech:recognize";
/** Google TTS MP3 is ~64 kbit/s (8 KB/s); keep well under the 60 s synchronous limit. */
const MAX_BYTES = 55 * 8000;

const seconds = (d: unknown) => (typeof d === "string" ? parseFloat(d) : 0) || 0;

export class GoogleSttAligner implements WordAligner {
  constructor(
    private readonly apiKey: string,
    private readonly fetchFn: typeof fetch = (...args) => fetch(...args),
    private readonly languageCode = "ko-KR",
  ) {}

  /** Null when there's no key: alignment is optional, so the app just keeps its estimate. */
  static fromSettings(settings: Settings): WordAligner | null {
    const key = settings.googleSttApiKey ?? settings.googleTtsApiKey;
    return key ? new GoogleSttAligner(key) : null;
  }

  async align(mp3: Uint8Array, words: string[]): Promise<number[] | null> {
    if (mp3.length === 0 || mp3.length > MAX_BYTES) return null;
    const res = await this.fetchFn(API, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": this.apiKey },
      body: JSON.stringify({
        config: {
          encoding: "MP3",
          sampleRateHertz: 24000,
          languageCode: this.languageCode,
          enableWordTimeOffsets: true,
          // Our own words, to bias recognition towards the exact text.
          speechContexts: [{ phrases: [words.join(" ").slice(0, 2000)] }],
        },
        audio: { content: bytesToBase64(mp3) },
      }),
    });
    if (!res.ok) {
      // Most likely the Speech-to-Text API isn't enabled for this key; the caller falls back quietly.
      throw new Error(`Speech-to-Text ${res.status}: ${(await res.text()).slice(0, 200)}`);
    }
    const data = (await res.json()) as {
      results?: { alternatives?: { words?: { word?: string; startTime?: string; endTime?: string }[] }[] }[];
    };
    const heard: RecognizedWord[] = (data.results ?? []).flatMap(
      (r) =>
        r.alternatives?.[0]?.words?.map((w) => ({ word: w.word ?? "", start: seconds(w.startTime), end: seconds(w.endTime) })) ??
        [],
    );
    return matchWords(words, heard);
  }
}

// "none" turns alignment off (the browser's estimate is used).
alignerRegistry.register("google_stt", (settings) => GoogleSttAligner.fromSettings(settings) ?? { align: async () => null });
alignerRegistry.register("none", () => ({ align: async () => null }));
