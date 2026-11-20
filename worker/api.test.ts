import { describe, expect, it, vi } from "vitest";
import { handleApi, servicesFromSettings, type Services } from "./api";
import { settingsFromEnv } from "./config";
import { ServiceError } from "./errors";
import { MemoryUserDataStore } from "./services/userData";
import { MemoryWordStore } from "./services/words";
import { MemoryGrammarStore } from "./services/grammar";

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
    userData: () => overrides.userData ?? new MemoryUserDataStore(),
    words: () => overrides.words ?? new MemoryWordStore(),
    grammar: () => overrides.grammar ?? new MemoryGrammarStore(),
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
    const res = await handleApi(
      post("/generate", { difficulty: "intermediate", length: "long", topic: "학교" }),
      settings,
      services({ paragraph: { generate } }),
    );
    expect(res.status).toBe(200);
    expect(generate).toHaveBeenCalledWith("intermediate", "long", "학교", undefined);
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

  it("serves the shared word list with a version, and 304 when the browser's copy is current", async () => {
    const word = {
      id: "사과",
      spelling: "사과",
      meaning: "apple",
      pos: "noun",
      category: "food",
      level: 1,
      romanization: "sagwa",
      register: "neutral",
    };
    const words = new MemoryWordStore([word], "1-100");
    const res = await handleApi(new Request("https://app.test/api/words"), settings, services({ words }));
    expect(res.status).toBe(200);
    expect(res.headers.get("ETag")).toBe('"1-100"');
    expect(await res.json()).toEqual({ words: [word], version: "1-100" });
    const again = new Request("https://app.test/api/words", { headers: { "If-None-Match": '"1-100"' } });
    expect((await handleApi(again, settings, services({ words }))).status).toBe(304);
  });

  it("practises a grammar pattern: level from the pattern, dialogue for spoken patterns, highlights back", async () => {
    const pattern = {
      id: "-(으)ㄹ까요?",
      form: "-(으)ㄹ까요?",
      title: "shall we…?",
      explain: "Use it to suggest doing something together: 같이 갈까요? = shall we go together?",
      sample: { ko: "갈까요?", en: "shall we go?" },
      meaning: "shall we…?",
      level: 1,
      group: "asking" as const,
      register: "spoken" as const,
      attaches: "Verb stem + -을까요 / -ㄹ까요.",
      examples: [],
      similar: [],
    };
    const generate = vi.fn().mockResolvedValue({
      paragraph: "커피 마실까요? 좋아요.",
      translation: "",
      glosses: ["", "", ""],
      sentences: [],
      highlights: [1, 9],
    });
    const res = await handleApi(
      post("/generate", {
        difficulty: "advanced",
        length: "short",
        grammar: { pattern: pattern.id, setting: "At a café" },
      }),
      settings,
      services({ paragraph: { generate }, grammar: new MemoryGrammarStore([pattern]) }),
    );
    expect(res.status).toBe(200);
    expect(generate).toHaveBeenCalledWith("beginner", "short", undefined, {
      pattern,
      setting: "At a café",
      politeness: "polite",
      format: "dialogue",
    });
    const body = (await res.json()) as { highlights: number[]; practice: { format: string } };
    expect(body.highlights).toEqual([1]); // out-of-range index dropped
    expect(body.practice.format).toBe("dialogue");

    const unknown = await handleApi(
      post("/generate", { grammar: { pattern: "nope" } }),
      settings,
      services({ grammar: new MemoryGrammarStore([pattern]) }),
    );
    expect(unknown.status).toBe(422);
  });

  it("serves a pattern's ready-made conversations (an old merged id finds its family)", async () => {
    const pattern = {
      id: "N에서 N까지",
      form: "N에서 N까지",
      title: "from … to …",
      explain: "",
      sample: { ko: "집에서 학교까지", en: "from home to school" },
      meaning: "from … to …",
      level: 1,
      group: "particles" as const,
      register: "both" as const,
      attaches: "",
      examples: [],
      similar: [],
      aliases: ["N부터 N까지"],
    };
    const grammar = new MemoryGrammarStore([pattern], "1", [{ patternId: pattern.id }]);
    const res = await handleApi(
      new Request("https://app.test/api/grammar/conversations?pattern=" + encodeURIComponent("N부터 N까지")),
      settings,
      services({ grammar }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ pattern: "N에서 N까지", conversations: [{ patternId: "N에서 N까지" }] });
    const missing = await handleApi(
      new Request("https://app.test/api/grammar/conversations?pattern=nope"),
      settings,
      services({ grammar }),
    );
    expect(missing.status).toBe(404);
  });
});
