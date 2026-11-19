import { describe, expect, it, vi } from "vitest";
import { settingsFromEnv } from "../../config";
import { alignerRegistry } from "./index";
import { matchWords } from "./matchWords";
import { GoogleSttAligner } from "./providers/googleStt";

const WORDS = "저는 학생이에요. 학교에 가요.".split(" ");

describe("matchWords", () => {
  it("uses the recognized start time of each word", () => {
    const heard = [
      { word: "저는", start: 0.1, end: 0.4 },
      { word: "학생이에요", start: 0.4, end: 1.1 },
      { word: "학교에", start: 1.5, end: 1.9 },
      { word: "가요", start: 1.9, end: 2.3 },
    ];
    expect(matchWords(WORDS, heard)).toEqual([0.1, 0.4, 1.5, 1.9]);
  });

  it("handles words split or merged differently by recognition", () => {
    // Recognition merged "학교에 가요" and split "학생이에요" into two.
    const heard = [
      { word: "저는", start: 0.1, end: 0.4 },
      { word: "학생", start: 0.4, end: 0.7 },
      { word: "이에요", start: 0.7, end: 1.1 },
      { word: "학교에가요", start: 1.5, end: 2.5 },
    ];
    const t = matchWords(WORDS, heard)!;
    expect(t[0]).toBeCloseTo(0.1);
    expect(t[1]).toBeCloseTo(0.4);
    expect(t[2]).toBeCloseTo(1.5);
    expect(t[3]).toBeCloseTo(1.5 + (3 / 5) * 1.0); // 3 of 5 characters into the merged word
  });

  it("interpolates a word recognition missed, and stays in time order", () => {
    const heard = [
      { word: "저는", start: 0.1, end: 0.4 },
      { word: "학생이에요", start: 0.4, end: 1.1 },
      { word: "가요", start: 1.9, end: 2.3 },
    ];
    const t = matchWords(WORDS, heard)!;
    expect(t[2]).toBeGreaterThan(t[1]);
    expect(t[2]).toBeLessThan(t[3]);
  });

  it("gives up when too little matches", () => {
    expect(matchWords(WORDS, [{ word: "안녕하세요", start: 0, end: 1 }])).toBeNull();
    expect(matchWords(WORDS, [])).toBeNull();
  });
});

describe("GoogleSttAligner", () => {
  const ok = (body: unknown) => vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status: 200 }));

  it("asks for word time offsets in Korean and matches the result", async () => {
    const fetchFn = ok({
      results: [
        {
          alternatives: [
            {
              words: [
                { word: "저는", startTime: "0.100s", endTime: "0.400s" },
                { word: "학생이에요", startTime: "0.400s", endTime: "1.100s" },
                { word: "학교에", startTime: "1.500s", endTime: "1.900s" },
                { word: "가요", startTime: "1.900s", endTime: "2.300s" },
              ],
            },
          ],
        },
      ],
    });
    const times = await new GoogleSttAligner("k", fetchFn).align(new Uint8Array([1, 2, 3]), WORDS);
    expect(times).toEqual([0.1, 0.4, 1.5, 1.9]);
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe("https://speech.googleapis.com/v1p1beta1/speech:recognize");
    expect(init.headers["x-goog-api-key"]).toBe("k");
    const body = JSON.parse(init.body);
    expect(body.config).toMatchObject({ encoding: "MP3", languageCode: "ko-KR", enableWordTimeOffsets: true });
    expect(body.audio.content).toBe(btoa("\x01\x02\x03"));
  });

  it("throws on API errors (the route turns that into null) and skips over-long audio", async () => {
    const denied = vi.fn().mockResolvedValue(new Response("Permission denied", { status: 403 }));
    await expect(new GoogleSttAligner("k", denied).align(new Uint8Array([1]), WORDS)).rejects.toThrow("403");
    const fetchFn = ok({});
    expect(await new GoogleSttAligner("k", fetchFn).align(new Uint8Array(500_000), WORDS)).toBeNull();
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("is registered, uses the STT key or falls back to the TTS key, and 'none' turns it off", async () => {
    expect(alignerRegistry.create("google_stt", settingsFromEnv({ GOOGLE_TTS_API_KEY: "t" }))).toBeInstanceOf(
      GoogleSttAligner,
    );
    const noKey = alignerRegistry.create("google_stt", settingsFromEnv({}));
    expect(await noKey.align(new Uint8Array([1]), WORDS)).toBeNull();
    expect(await alignerRegistry.create("none", settingsFromEnv({})).align(new Uint8Array([1]), WORDS)).toBeNull();
  });
});
