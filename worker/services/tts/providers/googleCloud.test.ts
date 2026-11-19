import { describe, expect, it, vi } from "vitest";
import { settingsFromEnv } from "../../../config";
import { ServiceError } from "../../../errors";
import { ttsRegistry } from "../index";
import { GoogleCloudTtsService, buildMarkedSsml, wordTimesFromTimepoints } from "./googleCloud";

const MP3_B64 = btoa("mp3-bytes");

function okFetch(body: unknown) {
  return vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status: 200 }));
}

describe("GoogleCloudTtsService", () => {
  it("synthesizes with the API key header, voice and rate, and decodes the audio", async () => {
    const fetchFn = okFetch({ audioContent: MP3_B64 });
    const svc = new GoogleCloudTtsService("my-key", "ko-KR-Standard-B", fetchFn);
    const audio = await svc.synthesize("안녕하세요", 0.75);
    expect(new TextDecoder().decode(audio)).toBe("mp3-bytes");
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe("https://texttospeech.googleapis.com/v1/text:synthesize");
    expect(init.headers["x-goog-api-key"]).toBe("my-key");
    const body = JSON.parse(init.body);
    expect(body.voice).toEqual({ languageCode: "ko-KR", name: "ko-KR-Standard-B" });
    expect(body.audioConfig).toEqual({ audioEncoding: "MP3", speakingRate: 0.75 });
  });

  it("requests SSML marks with time pointing and returns per-word times", async () => {
    const fetchFn = okFetch({
      audioContent: MP3_B64,
      timepoints: [
        { markName: "w0", timeSeconds: 0.01 },
        { markName: "w1", timeSeconds: 0.6 },
      ],
    });
    const svc = new GoogleCloudTtsService("k", "ko-KR-Standard-A", fetchFn);
    const result = await svc.synthesizeTimed(["저는", "학생이에요."], 1);
    expect(result).toEqual({ audioBase64: MP3_B64, wordTimes: [0.01, 0.6] });
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe("https://texttospeech.googleapis.com/v1beta1/text:synthesize");
    const body = JSON.parse(init.body);
    expect(body.input.ssml).toBe('<speak><mark name="w0"/>저는 <mark name="w1"/>학생이에요.</speak>');
    expect(body.enableTimePointing).toEqual(["SSML_MARK"]);
  });

  it("escapes SSML and fills missing marks", () => {
    expect(buildMarkedSsml(["A&B", "<x>"])).toBe('<speak><mark name="w0"/>A&amp;B <mark name="w1"/>&lt;x&gt;</speak>');
    expect(wordTimesFromTimepoints([{ markName: "w0", timeSeconds: 0 }, { markName: "w2", timeSeconds: 1.25 }], 4)).toEqual([
      0, 0, 1.25, 1.25,
    ]);
    expect(wordTimesFromTimepoints([], 3)).toBeNull();
    // Google's Korean voices report 0 for every mark: treat that as "no timings".
    expect(wordTimesFromTimepoints([{ markName: "w0", timeSeconds: 0 }, { markName: "w1", timeSeconds: 0 }], 2)).toBeNull();
  });

  it("uses a requested Korean voice and refuses anything else", async () => {
    const fetchFn = okFetch({ audioContent: MP3_B64 });
    const svc = new GoogleCloudTtsService("k", "ko-KR-Standard-A", fetchFn);
    await svc.synthesize("안녕", 1, "ko-KR-Neural2-C");
    expect(JSON.parse(fetchFn.mock.calls[0][1].body).voice.name).toBe("ko-KR-Neural2-C");
    await expect(svc.synthesize("hi", 1, "en-US-Studio-O")).rejects.toMatchObject({ status: 422 });
  });

  it("skips SSML marks for Chirp 3 HD voices (no word timings)", async () => {
    const fetchFn = okFetch({ audioContent: MP3_B64 });
    const svc = new GoogleCloudTtsService("k", "ko-KR-Standard-A", fetchFn);
    const result = await svc.synthesizeTimed(["저는", "학생이에요."], 1, "ko-KR-Chirp3-HD-Kore");
    expect(result.wordTimes).toBeNull();
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe("https://texttospeech.googleapis.com/v1/text:synthesize");
    expect(JSON.parse(init.body).input).toEqual({ text: "저는 학생이에요." });
  });

  it("lists Korean voices with family and gender", async () => {
    const fetchFn = okFetch({
      voices: [
        { name: "ko-KR-Wavenet-C", ssmlGender: "MALE" },
        { name: "ko-KR-Chirp3-HD-Kore", ssmlGender: "FEMALE" },
        { name: "ko-KR-Studio-X", ssmlGender: "FEMALE" },
      ],
    });
    const voices = await new GoogleCloudTtsService("k", "v", fetchFn).listVoices();
    expect(voices).toEqual([
      { name: "ko-KR-Chirp3-HD-Kore", family: "Chirp3-HD", gender: "female" },
      { name: "ko-KR-Wavenet-C", family: "Wavenet", gender: "male" },
    ]);
    expect(fetchFn.mock.calls[0][0]).toBe("https://texttospeech.googleapis.com/v1/voices?languageCode=ko-KR");
  });

  it("gives friendly errors for a bad key, quota and network failures", async () => {
    const badKey = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ error: { code: 400, message: "API key not valid.", details: [{ reason: "API_KEY_INVALID" }] } }),
        { status: 400 },
      ),
    );
    await expect(new GoogleCloudTtsService("bad", "v", badKey).synthesize("안녕", 1)).rejects.toThrow("GOOGLE_TTS_API_KEY");

    const quota = vi.fn().mockResolvedValue(new Response("{}", { status: 429 }));
    await expect(new GoogleCloudTtsService("k", "v", quota).synthesize("안녕", 1)).rejects.toMatchObject({ status: 429 });

    const offline = vi.fn().mockRejectedValue(new TypeError("fetch failed"));
    await expect(new GoogleCloudTtsService("k", "v", offline).synthesize("안녕", 1)).rejects.toThrow("Couldn't reach");
  });

  it("requires an API key", () => {
    expect(() => ttsRegistry.create("google_cloud", settingsFromEnv({}))).toThrow(ServiceError);
    expect(ttsRegistry.create("google_cloud", settingsFromEnv({ GOOGLE_TTS_API_KEY: "k" }))).toBeInstanceOf(
      GoogleCloudTtsService,
    );
  });
});
