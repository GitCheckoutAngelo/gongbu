/** Optional extras for speak(). Providers that can't report word positions simply ignore them. */
export interface SpeakOptions {
  /** The words of `text` in order (text split on spaces), used to report which one is being spoken. */
  words?: string[];
  /** Called with the index of the word now being spoken (for highlighting). Never called if unknown. */
  onWord?: (index: number) => void;
  /**
   * Called with the latest point playback can resume from: the current word, or the first word of the
   * current sentence when the provider can't tell words apart.
   */
  onProgress?: (index: number) => void;
  /** Start speaking from this word (index into `words`) instead of the beginning. */
  startWord?: number;
  /** Called once when sound actually starts (after any fetching/decoding), for loading states. */
  onStart?: () => void;
  /**
   * Dialogues: "partner" speaks in a second voice (the opposite gender in the same voice family, or another
   * voice the device has); "primary" (the default) in the chosen voice.
   */
  speaker?: "primary" | "partner";
}

/** "ended": played to the end. "stopped": stop() was called (or another speak() replaced it). */
export type SpeakResult = "ended" | "stopped";

/** A text-to-speech backend. Implementations live in ./providers/ and register themselves. */
export interface TtsProvider {
  /** Speak `text` in Korean at `rate` (1 = normal). Resolves when finished or stopped. */
  speak(text: string, rate: number, options?: SpeakOptions): Promise<SpeakResult>;
  /** Stop any current speech. The pending `speak()` promise resolves with "stopped". */
  stop(): void;
  /**
   * Optional: change the speed of what's playing right now, without stopping.
   * Returns false if it can't (the caller then restarts playback at the new speed).
   */
  setLiveRate?(rate: number): boolean;
  /** Optional: start fetching the audio for this text now (the next dialogue turn), so it plays without a gap. */
  prefetch?(text: string, rate: number, options?: SpeakOptions): void;
  /** Whether this provider can be used in the current browser. */
  isAvailable(): boolean;
  /** Optional user-facing explanation shown when `isAvailable()` is false. */
  unavailableMessage?(): string;
}

/** An error with a message that is safe to show to the user. */
export class TtsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TtsError";
  }
}
