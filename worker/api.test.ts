import { describe, expect, it, vi } from "vitest";
import { handleApi, servicesFromSettings, type Services } from "./api";
import { settingsFromEnv } from "./config";
import { ServiceError } from "./errors";

const settings = settingsFromEnv({});

function services(overrides: Partial<{ [K in keyof Services]: ReturnType<Services[K]> }> = {}): Services {
  return {
    paragraph: () =>
      overrides.paragraph ?? {
        generate: vi.fn().mockResolvedValue({
          paragraph: "저는 학생이에요. 학교에 가요.",
          translation: "I'm a student.",
          glosses: ["", "", "", ""],
          sentences: [],
        }),
      },
    romanizer: () => overrides.romanizer ?? { romanizeWords: (ws: string[]) => ws.map((w) => `r(${w})`) },
    tts: () =>
      overrides.tts ?? {
        synthesize: vi.fn().mockResolvedValue(new TextEncoder().encode("mp3")),
        synthesizeTimed: vi.fn().mockResolvedValue({ audioBase64: btoa("mp3"), wordTimes: [0, 0.5] }),
      },
    wordSuggester: () => overrides.wordSuggester ?? { suggest: vi.fn().mockResolvedValue([]) },
    aligner: () => overrides.aligner ?? { align: vi.fn().mockResolvedValue(null) },
  };
}

const post = (path: string, body: unknown) =>
  new Request(`https://app.test/api${path}`, { method: "POST", body: JSON.stringify(body) });

describe("API", () => {
  it("GET /api/health lists providers", async () => {
    const res = await handleApi(new Request("https://app.test/api/health"), settings, services());
    expect(await res.json()).toEqual({
      status: "ok",
      providers: { paragraph: "claude", romanizer: "koroman", tts: "google_cloud", wordSuggester: "claude" },
    });
  });

  it("POST /api/generate returns the paragraph, its translation, and a romanization and gloss per word", async () => {
    const generate = vi.fn().mockResolvedValue({
      paragraph: "저는 학생이에요. 학교에 가요.",
      translation: "I'm a student. I go to school.",
      glosses: ["I (topic)", "am a student", "to school", "go"],
      sentences: [
        { english: "I'm a student.", start: 0, end: 2 },
        { english: "I go to school.", start: 2, end: 4 },
      ],
    });
    const res = await handleApi(post("/generate", { difficulty: "intermediate", length: "long", topic: "학교" }), settings, services({ paragraph: { generate } }));
    expect(res.status).toBe(200);
    expect(generate).toHaveBeenCalledWith("intermediate", "long", "학교");
    expect(await res.json()).toEqual({
      paragraph: "저는 학생이에요. 학교에 가요.",
      translation: "I'm a student. I go to school.",
      sentences: [
        { english: "I'm a student.", start: 0, end: 2 },
        { english: "I go to school.", start: 2, end: 4 },
      ],
      words: [
        { korean: "저는", romanized: "r(저는)", english: "I (topic)" },
        { korean: "학생이에요.", romanized: "r(학생이에요.)", english: "am a student" },
        { korean: "학교에", romanized: "r(학교에)", english: "to school" },
        { korean: "가요.", romanized: "r(가요.)", english: "go" },
      ],
    });
  });

  it("POST /api/words/suggest validates input, passes it on, and adds romanization", async () => {
    const word = { spelling: "사과", meaning: "apple", pos: "noun", level: 1, rules: [], letters: [] };
    const suggest = vi.fn().mockResolvedValue([word]);
    const body = { category: "food", band: "intermediate", count: 3, exclude: ["밥"] };
    const res = await handleApi(post("/words/suggest", body), settings, services({ wordSuggester: { suggest } }));
    expect(res.status).toBe(200);
    expect(suggest).toHaveBeenCalledWith({ category: "food", band: "intermediate", count: 3, exclude: ["밥"] });
    expect(await res.json()).toEqual({ words: [{ ...word, romanization: "r(사과)" }] });

    for (const bad of [
      {},
      { category: "snacks" },
      { category: "food", count: 11 },
      { category: "food", exclude: "밥" },
      { category: "food", band: "expert" },
    ]) {
      const r = await handleApi(post("/words/suggest", bad), settings, services({ wordSuggester: { suggest } }));
      expect(r.status).toBe(422);
    }
  });

  it("validates input with a friendly 422", async () => {
    const res = await handleApi(post("/generate", { difficulty: "expert" }), settings, services());
    expect(res.status).toBe(422);
    expect(((await res.json()) as { detail: string }).detail).toContain("difficulty");
    const tooFast = await handleApi(post("/tts", { text: "안녕", rate: 5 }), settings, services());
    expect(tooFast.status).toBe(422);
  });

  it("returns friendly service errors with their status", async () => {
    const generate = vi.fn().mockRejectedValue(new ServiceError("Too many requests right now.", 429));
    const res = await handleApi(post("/generate", {}), settings, services({ paragraph: { generate } }));
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ detail: "Too many requests right now." });
  });

  it("POST /api/tts returns MP3 audio", async () => {
    const res = await handleApi(post("/tts", { text: "안녕하세요", rate: 1 }), settings, services());
    expect(res.headers.get("Content-Type")).toBe("audio/mpeg");
    expect(await res.text()).toBe("mp3");
  });

  it("POST /api/tts/timed returns audio and word times", async () => {
    const res = await handleApi(post("/tts/timed", { words: ["저는", "학생"], rate: 1 }), settings, services());
    expect(await res.json()).toEqual({ audio_base64: btoa("mp3"), mime_type: "audio/mpeg", word_times: [0, 0.5] });
  });

  it("/api/tts/timed falls back to plain audio for providers without timings", async () => {
    const tts = { synthesize: vi.fn().mockResolvedValue(new TextEncoder().encode("mp3")) };
    const res = await handleApi(post("/tts/timed", { words: ["저는", "학생"] }), settings, services({ tts }));
    expect(tts.synthesize).toHaveBeenCalledWith("저는 학생", 1, undefined);
    expect(await res.json()).toEqual({ audio_base64: btoa("mp3"), mime_type: "audio/mpeg", word_times: null });
  });

  it("POST /api/tts/align returns word times, or null when alignment fails", async () => {
    const align = vi.fn().mockResolvedValue([0.1, 0.5]);
    const body = { audio_base64: btoa("mp3"), words: ["저는", "학생"] };
    const res = await handleApi(post("/tts/align", body), settings, services({ aligner: { align } }));
    expect(await res.json()).toEqual({ word_times: [0.1, 0.5] });
    expect(new TextDecoder().decode(align.mock.calls[0][0])).toBe("mp3");

    const failing = { align: vi.fn().mockRejectedValue(new Error("Speech-to-Text 403")) };
    const fallback = await handleApi(post("/tts/align", body), settings, services({ aligner: failing }));
    expect(fallback.status).toBe(200);
    expect(await fallback.json()).toEqual({ word_times: null });

    const bad = await handleApi(post("/tts/align", { audio_base64: "%%%", words: ["a"] }), settings, services());
    expect(bad.status).toBe(422);
  });

  it("passes a chosen voice to TTS and lists voices", async () => {
    const synthesize = vi.fn().mockResolvedValue(new TextEncoder().encode("mp3"));
    const listVoices = vi.fn().mockResolvedValue([{ name: "ko-KR-Neural2-A", family: "Neural2", gender: "female" }]);
    const tts = { synthesize, listVoices };
    await handleApi(post("/tts", { text: "안녕", rate: 1, voice: "ko-KR-Neural2-A" }), settings, services({ tts }));
    expect(synthesize).toHaveBeenCalledWith("안녕", 1, "ko-KR-Neural2-A");
    const res = await handleApi(new Request("https://app.test/api/tts/voices"), settings, services({ tts }));
    expect(await res.json()).toEqual({
      voices: [{ name: "ko-KR-Neural2-A", family: "Neural2", gender: "female" }],
      default: "ko-KR-Standard-A",
    });
    const tooLong = await handleApi(post("/tts", { text: "안녕", voice: "x".repeat(61) }), settings, services({ tts }));
    expect(tooLong.status).toBe(422);
  });

  it("reports a missing secret clearly instead of crashing", async () => {
    const res = await handleApi(post("/generate", {}), settings, servicesFromSettings(settings));
    expect(res.status).toBe(500);
    expect(((await res.json()) as { detail: string }).detail).toContain("ANTHROPIC_API_KEY");
  });

  it("404s unknown routes", async () => {
    expect((await handleApi(new Request("https://app.test/api/nope"), settings, services())).status).toBe(404);
  });
});
