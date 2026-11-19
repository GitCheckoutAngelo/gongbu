/**
 * Google Cloud Text-to-Speech over its REST API (Workers can't run Google's gRPC client).
 * Auth: API key, sent in the x-goog-api-key header. Word timings: an SSML <mark> before each word
 * plus `enableTimePointing` (v1beta1), which returns when each mark is reached.
 */
import type { Settings } from "../../../config";
import { ServiceError } from "../../../errors";
import { ttsRegistry, type TimedAudio, type TtsService, type TtsVoice } from "../types";

const API = "https://texttospeech.googleapis.com";

export const NO_KEY_MESSAGE =
  "Google Cloud TTS isn't set up on the server: set GOOGLE_TTS_API_KEY with `wrangler secret put` " +
  "(or in .dev.vars locally), or switch to the Browser voice.";

const escapeXml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

/** <speak><mark name="w0"/>저는 <mark name="w1"/>학생이에요.</speak> */
export function buildMarkedSsml(words: string[]): string {
  return `<speak>${words.map((w, i) => `<mark name="w${i}"/>${escapeXml(w)}`).join(" ")}</speak>`;
}

/** Korean voices a request may choose (anything else is refused, so callers can't pick another language). */
export const KOREAN_VOICE = /^ko-KR-(Standard|Wavenet|Neural2|Chirp3-HD)-[A-Za-z]+$/;

/** The family part of a voice name: ko-KR-Neural2-A -> "Neural2". */
export const voiceFamily = (name: string) => KOREAN_VOICE.exec(name)?.[1] ?? "";

/** Chirp 3 HD voices don't support SSML marks, so they never return word timings. */
const supportsMarks = (name: string) => !name.includes("-Chirp3-HD-");

/**
 * One start time per word from Google's timepoints; a missing mark reuses the previous time.
 * Returns null when the times are unusable: Google's Korean voices currently report 0 for every mark
 * (checked against the live API), and the browser then estimates timings instead.
 */
export function wordTimesFromTimepoints(
  timepoints: { markName?: string; timeSeconds?: number }[] | undefined,
  wordCount: number,
): number[] | null {
  const byIndex = new Map<number, number>();
  for (const tp of timepoints ?? []) {
    const m = /^w(\d+)$/.exec(tp.markName ?? "");
    if (m) byIndex.set(Number(m[1]), tp.timeSeconds ?? 0);
  }
  if (byIndex.size === 0) return null;
  if (wordCount > 1 && new Set(byIndex.values()).size <= 1) return null;
  const times: number[] = [];
  let last = 0;
  for (let i = 0; i < wordCount; i++) {
    last = byIndex.get(i) ?? last;
    times.push(last);
  }
  return times;
}

export function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

interface GoogleError {
  error?: { code?: number; message?: string; status?: string; details?: { reason?: string }[] };
}

async function friendlyError(res: Response): Promise<ServiceError> {
  let body: GoogleError = {};
  try {
    body = (await res.json()) as GoogleError;
  } catch {
    // non-JSON error body
  }
  const message = body.error?.message ?? "";
  const reasons = (body.error?.details ?? []).map((d) => d.reason);
  if (reasons.includes("API_KEY_INVALID") || /API key not valid/i.test(message)) {
    return new ServiceError("The Google API key was rejected. Check GOOGLE_TTS_API_KEY.", 500);
  }
  if (res.status === 401 || res.status === 403) {
    return new ServiceError(
      "Google Cloud rejected the request. Check that the Text-to-Speech API is enabled in your project and that your API key is allowed to use it.",
      500,
    );
  }
  if (res.status === 429) return new ServiceError("The Google Cloud TTS quota has been reached. Try the Browser voice.", 429);
  if (res.status === 400) return new ServiceError(`Google Cloud TTS couldn't read this text: ${message}`, 400);
  return new ServiceError("Google Cloud TTS failed. Please try again.");
}

export class GoogleCloudTtsService implements TtsService {
  constructor(
    private readonly apiKey: string,
    private readonly voiceName: string,
    private readonly fetchFn: typeof fetch = (...args) => fetch(...args),
    private readonly languageCode = "ko-KR",
  ) {}

  static fromSettings(settings: Settings): GoogleCloudTtsService {
    if (!settings.googleTtsApiKey) throw new ServiceError(NO_KEY_MESSAGE, 500);
    return new GoogleCloudTtsService(settings.googleTtsApiKey, settings.googleTtsVoice);
  }

  private async call(path: string, body: unknown): Promise<{ audioContent: string; timepoints?: { markName?: string; timeSeconds?: number }[] }> {
    let res: Response;
    try {
      res = await this.fetchFn(`${API}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": this.apiKey },
        body: JSON.stringify(body),
      });
    } catch {
      throw new ServiceError("Couldn't reach Google Cloud TTS. Please try again.");
    }
    if (!res.ok) throw await friendlyError(res);
    return (await res.json()) as { audioContent: string; timepoints?: { markName?: string; timeSeconds?: number }[] };
  }

  /** The requested voice (validated) or the server's default. */
  private resolveVoice(requested?: string): string {
    if (!requested) return this.voiceName;
    if (!KOREAN_VOICE.test(requested)) throw new ServiceError(`Unknown voice "${requested}".`, 422);
    return requested;
  }

  private voice(name: string) {
    return { languageCode: this.languageCode, name };
  }

  async synthesize(text: string, rate: number, voice?: string): Promise<Uint8Array> {
    const data = await this.call("/v1/text:synthesize", {
      input: { text },
      voice: this.voice(this.resolveVoice(voice)),
      audioConfig: { audioEncoding: "MP3", speakingRate: rate },
    });
    return base64ToBytes(data.audioContent);
  }

  async synthesizeTimed(words: string[], rate: number, voice?: string): Promise<TimedAudio> {
    const name = this.resolveVoice(voice);
    if (!supportsMarks(name)) {
      const plain = await this.call("/v1/text:synthesize", {
        input: { text: words.join(" ") },
        voice: this.voice(name),
        audioConfig: { audioEncoding: "MP3", speakingRate: rate },
      });
      return { audioBase64: plain.audioContent, wordTimes: null };
    }
    const data = await this.call("/v1beta1/text:synthesize", {
      input: { ssml: buildMarkedSsml(words) },
      voice: this.voice(name),
      audioConfig: { audioEncoding: "MP3", speakingRate: rate },
      enableTimePointing: ["SSML_MARK"],
    });
    return { audioBase64: data.audioContent, wordTimes: wordTimesFromTimepoints(data.timepoints, words.length) };
  }

  /** Google's Korean voices (listing voices is free). */
  async listVoices(): Promise<TtsVoice[]> {
    let res: Response;
    try {
      res = await this.fetchFn(`${API}/v1/voices?languageCode=${this.languageCode}`, {
        headers: { "x-goog-api-key": this.apiKey },
      });
    } catch {
      throw new ServiceError("Couldn't reach Google Cloud TTS. Please try again.");
    }
    if (!res.ok) throw await friendlyError(res);
    const data = (await res.json()) as { voices?: { name: string; ssmlGender?: string }[] };
    return (data.voices ?? [])
      .filter((v) => KOREAN_VOICE.test(v.name))
      .map((v): TtsVoice => ({
        name: v.name,
        family: voiceFamily(v.name),
        gender: v.ssmlGender === "FEMALE" ? "female" : v.ssmlGender === "MALE" ? "male" : "neutral",
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }
}

ttsRegistry.register("google_cloud", (settings) => GoogleCloudTtsService.fromSettings(settings));
