import { Registry } from "../../registry";

export interface TimedAudio {
  /** MP3 audio, base64-encoded (Google returns it this way; the API passes it straight through). */
  audioBase64: string;
  /** Start time in seconds of each word (same order as the input), or null if unknown. */
  wordTimes: number[] | null;
}

export interface TtsVoice {
  /** Provider voice id, e.g. "ko-KR-Neural2-A". */
  name: string;
  gender: "female" | "male" | "neutral";
  /** Voice family, e.g. "Standard", "Wavenet", "Neural2", "Chirp3-HD". */
  family: string;
}

export interface TtsService {
  /** MP3 audio of `text` spoken in Korean at `rate` (1.0 = normal), in `voice` (default if omitted). */
  synthesize(text: string, rate: number, voice?: string): Promise<Uint8Array>;
  /** Optional: audio plus when each word starts, for highlighting. */
  synthesizeTimed?(words: string[], rate: number, voice?: string): Promise<TimedAudio>;
  /** Optional: the Korean voices a learner can choose from. */
  listVoices?(): Promise<TtsVoice[]>;
}

export const ttsRegistry = new Registry<TtsService>("TTS");
