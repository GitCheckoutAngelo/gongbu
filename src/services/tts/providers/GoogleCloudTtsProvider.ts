import { alignWords, synthesizeSpeech, synthesizeTimedSpeech } from "../../../api/client";
import {
  envelopeOf,
  estimateWordTimes,
  snapToSpeech,
  wordTimesFromEnvelope,
  type Envelope,
} from "../estimateWordTimes";
import { getGoogleVoice, partnerVoice } from "../googleVoice";
import { registerTtsProvider } from "../providerStore";
import { TtsError, type SpeakOptions, type SpeakResult, type TtsProvider } from "../TtsProvider";

const MAX_CACHE_ENTRIES = 20;

interface CachedAudio {
  url: string;
  /** Start time (seconds) of each word, when requested and available. */
  wordTimes: number[] | null;
  /** The audio's loudness over time (decoded in the background), for measuring pauses. */
  envelope?: Promise<Envelope | null>;
  /** Exact word times from speech recognition on the server (null if unavailable). */
  aligned?: Promise<number[] | null>;
}

/**
 * Best word times: the measured audio gives exact pause/sentence boundaries; speech recognition places
 * the words inside each sentence where its times are plausible (it's coarse, 0.1 s steps, and can be
 * wrong by up to ~0.9 s on its own, measured on Chirp audio). Without the audio analysis, recognition
 * times are only snapped out of silences.
 */
function withAlignment(words: string[], envelope: Promise<Envelope | null>, aligned: Promise<number[] | null>) {
  return {
    envelope,
    aligned: Promise.all([aligned, envelope]).then(([times, env]) => {
      if (!times) return null;
      if (!env) return times;
      return wordTimesFromEnvelope(words, env, times) ?? snapToSpeech(times, env);
    }),
  };
}

/** How long playback waits for the audio analysis before starting on the rough estimate. */
const ANALYSIS_WAIT_MS = 400;

let audioContext: AudioContext | null | undefined;
/** Decode MP3 audio and measure its loudness over time; null if the browser can't. */
async function analyse(blob: Blob): Promise<Envelope | null> {
  try {
    if (audioContext === undefined) {
      const Ctx =
        window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      audioContext = Ctx ? new Ctx() : null;
    }
    if (!audioContext) return null;
    const buffer = await audioContext.decodeAudioData(await blob.arrayBuffer());
    return envelopeOf(buffer.getChannelData(0), buffer.sampleRate);
  } catch {
    return null;
  }
}

/** Index of the last word whose start time has passed (-1 before the first). */
function wordAt(times: number[], t: number): number {
  let index = -1;
  for (let i = 0; i < times.length && times[i] <= t; i++) index = i;
  return index;
}

/**
 * Plays MP3 audio from the backend, cached per (rate, text). When the caller wants word positions,
 * it uses /tts/timed (audio + per-word start times from Google) and reports the current word
 * while playing.
 */
export class GoogleCloudTtsProvider implements TtsProvider {
  private readonly cache = new Map<string, Promise<CachedAudio>>();
  private audio: HTMLAudioElement | undefined;
  /** The speed the playing audio was generated at (Google bakes the speed into the audio). */
  private audioRate = 1;
  private finishCurrent: ((result: SpeakResult) => void) | undefined;
  private frame = 0;
  private runId = 0;

  isAvailable(): boolean {
    return typeof Audio !== "undefined";
  }

  unavailableMessage(): string {
    return "This browser can't play audio. Try the “Browser” voice instead.";
  }

  async speak(text: string, rate: number, options: SpeakOptions = {}): Promise<SpeakResult> {
    this.stop();
    this.audioRate = rate;
    const run = ++this.runId;
    const startWord = options.startWord ?? 0;
    const { onWord, onProgress } = options;
    const wantTimes = !!(options.words?.length && (onWord || onProgress || startWord > 0));
    const voice = options.speaker === "partner" ? await partnerVoice() : getGoogleVoice();
    if (run !== this.runId) return "stopped";
    const { url, wordTimes, envelope, aligned } = await this.getAudio(
      text,
      rate,
      wantTimes ? options.words! : null,
      voice,
    );
    if (run !== this.runId) return "stopped"; // stopped while loading
    if (!wantTimes) return this.play(url, null, options.onStart);
    const words = options.words!;
    // Real timings if the server has usable ones. (All-identical times, e.g. every word at 0, are what
    // Google's Korean voices return.) Otherwise measure them from the audio: speech start/end and the
    // sentence pauses differ per voice. Wait briefly for that; if it isn't ready, start on the rough
    // duration estimate and switch to the measured timings when they arrive.
    const fromServer = wordTimes && (words.length < 2 || new Set(wordTimes).size > 1) ? wordTimes : null;
    // Exact speech-recognition times already in hand (a replay of cached audio): use them from the start.
    const alignedNow = aligned ? await Promise.race([aligned, Promise.resolve(undefined)]) : undefined;
    const usable = fromServer ?? alignedNow ?? null;
    const measured = usable
      ? null
      : (envelope ?? Promise.resolve(null)).then((e) => (e ? wordTimesFromEnvelope(words, e) : null));
    const ready = usable
      ? null
      : await Promise.race([measured, new Promise<undefined>((r) => setTimeout(r, ANALYSIS_WAIT_MS))]);
    if (run !== this.runId) return "stopped"; // stopped while analysing
    return this.play(
      url,
      {
        times: usable ?? ready ?? ((duration: number) => estimateWordTimes(words, duration)),
        // Better timings as they arrive: measured pauses, then exact speech-recognition times (best).
        refine: usable ? [] : [...(ready || !measured ? [] : [measured]), ...(aligned ? [aligned] : [])],
        startWord,
        onWord: onWord || onProgress ? (i: number) => (onWord?.(i), onProgress?.(i)) : undefined,
      },
      options.onStart,
    );
  }

  /** Speed up/slow down the loaded audio relative to the speed it was made at; the pitch is kept. */
  setLiveRate(rate: number): boolean {
    if (!this.audio) return false;
    this.audio.playbackRate = rate / this.audioRate;
    return true;
  }

  stop(): void {
    this.runId++;
    cancelAnimationFrame(this.frame);
    if (this.audio) {
      this.audio.pause();
      this.audio = undefined;
    }
    this.finishCurrent?.("stopped");
    this.finishCurrent = undefined;
  }

  /** Fetch (and cache) a dialogue turn's audio ahead of time. */
  prefetch(text: string, rate: number, options: SpeakOptions = {}): void {
    void (options.speaker === "partner" ? partnerVoice() : Promise.resolve(getGoogleVoice()))
      .then((voice) => this.getAudio(text, rate, options.words?.length ? options.words : null, voice))
      .catch(() => undefined);
  }

  private getAudio(text: string, rate: number, words: string[] | null, voice: string): Promise<CachedAudio> {
    const key = `${words ? "timed" : "plain"}|${voice}|${rate}|${text}`;
    const cached = this.cache.get(key);
    if (cached) {
      // Refresh recency.
      this.cache.delete(key);
      this.cache.set(key, cached);
      return cached;
    }
    const pending = (
      words
        ? synthesizeTimedSpeech(words, rate, voice || undefined).then(({ audio, wordTimes }) => ({
            url: URL.createObjectURL(audio),
            wordTimes,
            ...withAlignment(words, analyse(audio), alignWords(audio, words)),
          }))
        : synthesizeSpeech(text, rate, voice || undefined).then((blob) => ({
            url: URL.createObjectURL(blob),
            wordTimes: null,
          }))
    ).catch((err: unknown) => {
      this.cache.delete(key); // don't cache failures
      throw new TtsError(err instanceof Error ? err.message : "Google Cloud TTS failed.");
    });
    this.cache.set(key, pending);
    this.evictOldest();
    return pending;
  }

  private evictOldest(): void {
    while (this.cache.size > MAX_CACHE_ENTRIES) {
      const [oldestKey, oldest] = this.cache.entries().next().value!;
      this.cache.delete(oldestKey);
      oldest.then(({ url }) => URL.revokeObjectURL(url)).catch(() => {});
    }
  }

  /**
   * Play `url`. With `tracking`, report the current word and start at `startWord`; `times` is either
   * real per-word start times or a function that estimates them from the audio's duration.
   */
  private play(
    url: string,
    tracking: {
      times: number[] | ((durationSeconds: number) => number[]);
      /**
       * Better timings that arrive after playback starts, worst to best. Each replaces the current
       * timings when it arrives, unless a better one already has.
       */
      refine?: Promise<number[] | null>[];
      startWord: number;
      onWord?: (i: number) => void;
    } | null,
    onStart?: () => void,
  ): Promise<SpeakResult> {
    return new Promise((resolve, reject) => {
      const audio = new Audio(url);
      this.audio = audio;
      let times: number[] = [];
      let lastWord = -1;
      const tick = () => {
        if (!tracking?.onWord || this.audio !== audio) return;
        const index = wordAt(times, audio.currentTime);
        if (index !== lastWord && index >= 0) {
          lastWord = index;
          tracking.onWord(index);
        }
        this.frame = requestAnimationFrame(tick);
      };
      const finish = (result: SpeakResult = "stopped") => {
        cancelAnimationFrame(this.frame);
        this.finishCurrent = undefined;
        resolve(result);
      };
      this.finishCurrent = finish;
      let started = false;
      audio.onplaying = () => {
        if (!started) {
          started = true;
          onStart?.();
        }
        cancelAnimationFrame(this.frame);
        this.frame = requestAnimationFrame(tick);
      };
      audio.onended = () => finish("ended");
      audio.onerror = () => {
        cancelAnimationFrame(this.frame);
        this.finishCurrent = undefined;
        reject(new TtsError("Couldn't play the audio."));
      };
      // Estimated timings need the duration. Some browsers don't know it at "loadedmetadata" (it can be
      // Infinity/NaN for MP3); re-estimate as soon as it's known.
      const estimate = tracking && typeof tracking.times === "function" ? tracking.times : null;
      let refined = false;
      if (estimate) {
        audio.addEventListener("durationchange", () => {
          if (!refined && this.audio === audio && Number.isFinite(audio.duration) && audio.duration > 0) {
            times = estimate(audio.duration);
          }
        });
      }
      let rank = -1;
      tracking?.refine?.forEach((p, r) =>
        p.then((better) => {
          if (better && r > rank && this.audio === audio) {
            rank = r;
            refined = true;
            times = better;
          }
        }),
      );
      const start = () => {
        if (this.audio !== audio) return finish(); // stopped while loading metadata
        if (tracking) {
          times = typeof tracking.times === "function" ? tracking.times(audio.duration) : tracking.times;
          // Jump straight to the chosen word's start time in the (cached) audio.
          const startTime = tracking.startWord > 0 ? (times[Math.min(tracking.startWord, times.length - 1)] ?? 0) : 0;
          if (startTime > 0) audio.currentTime = startTime;
        }
        audio.play().catch((err: unknown) => {
          if (this.audio !== audio) return finish(); // stopped
          this.finishCurrent = undefined;
          reject(new TtsError(`Couldn't start audio playback${err instanceof Error ? `: ${err.message}` : "."}`));
        });
      };
      // Seeking and estimating need the audio's metadata (duration) first.
      if (tracking) audio.addEventListener("loadedmetadata", start, { once: true });
      else start();
    });
  }
}

registerTtsProvider({ id: "google_cloud", label: "Google Cloud", create: () => new GoogleCloudTtsProvider() });
