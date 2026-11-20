/**
 * App-wide text-to-speech state: which provider is selected (persisted), speed, what is
 * playing, and the last error. Every page speaks through this, using the provider registry
 * in services/tts, so there's one settings switch and one place that talks to providers.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { config } from "../config";
import { getGoogleVoice, setGoogleVoice as storeGoogleVoice } from "../services/tts/googleVoice";
import { getTtsProvider, hasTtsProvider, listTtsProviders } from "../services/tts/registry";
import type { SpeakOptions, SpeakResult } from "../services/tts/TtsProvider";

const PROVIDER_STORAGE_KEY = "korean-reader.ttsProvider";
const FOLLOW_WORDS_KEY = "gongbu.followWords";
const FOLLOW_SENTENCE_KEY = "gongbu.followSentence";

/** A remembered on/off choice (default on). */
function useRememberedToggle(key: string): [boolean, (on: boolean) => void] {
  const [value, setValue] = useState(() => {
    try {
      return localStorage.getItem(key) !== "off";
    } catch {
      return true;
    }
  });
  const set = useCallback(
    (on: boolean) => {
      setValue(on);
      try {
        localStorage.setItem(key, on ? "on" : "off");
      } catch {
        // ignore
      }
    },
    [key],
  );
  return [value, set];
}

function readStoredProvider(): string {
  try {
    const stored = localStorage.getItem(PROVIDER_STORAGE_KEY);
    if (stored && hasTtsProvider(stored)) return stored;
  } catch {
    // localStorage unavailable (private mode etc.)
  }
  return hasTtsProvider(config.defaultTtsProvider) ? config.defaultTtsProvider : (listTtsProviders()[0]?.id ?? "");
}

export interface TtsContextValue {
  providers: { id: string; label: string }[];
  providerId: string;
  setProviderId: (id: string) => void;
  rate: number;
  setRate: (rate: number) => void;
  /** The user's choice: highlight the current sentence while reading aloud. */
  followSentence: boolean;
  setFollowSentence: (on: boolean) => void;
  /** The user's choice: highlight the current word while reading aloud. */
  followWords: boolean;
  /**
   * Whether words are actually followed: the user's choice, except with Chirp 3 HD voices, whose word
   * timing is too unpredictable (they highlight by sentence only).
   */
  wordsFollowed: boolean;
  /** True while a Chirp 3 HD voice is selected (word highlighting unavailable). */
  sentenceOnlyVoice: boolean;
  setFollowWords: (on: boolean) => void;
  /** Google Cloud voice id ("" = the server's default). */
  googleVoice: string;
  setGoogleVoice: (voice: string) => void;
  /** Key of the item currently speaking (defaults to its text), or null. */
  playingKey: string | null;
  /** Key of the item that was pressed but hasn't started sounding yet (fetching/decoding), or null. */
  loadingKey: string | null;
  error: string | null;
  clearError: () => void;
  /** Warning when the selected provider can't be used here (e.g. no Korean voice). */
  warning: string | undefined;
  /**
   * `options.words` + `options.onWord` / `onProgress` report position, when the provider can tell.
   * Resolves "ended" if it played to the end, otherwise "stopped" (stopped, replaced, or failed).
   */
  speak: (text: string, key?: string, options?: SpeakOptions) => Promise<SpeakResult>;
  /**
   * A dialogue: each turn in its speaker's voice, one after another, as one playback (`key` stays playing
   * between turns; the next turn's audio is fetched while the current one plays). Word callbacks get the
   * index across all turns.
   */
  speakTurns: (turns: DialogueTurn[], key: string, options?: TurnsOptions) => Promise<SpeakResult>;
  stop: () => void;
}

export interface DialogueTurn {
  words: string[];
  speaker: "primary" | "partner";
  /** Index of the turn's first word across the whole dialogue. */
  start: number;
}

export interface TurnsOptions {
  /** Start from this word (index across all turns). */
  startWord?: number;
  onWord?: (index: number) => void;
  onProgress?: (index: number) => void;
  onStart?: () => void;
}

const TtsContext = createContext<TtsContextValue | null>(null);

export function TtsProviderRoot({ children }: { children: ReactNode }) {
  const [providerId, setProviderIdState] = useState(readStoredProvider);
  const [rate, setRateState] = useState(1);
  const [googleVoice, setGoogleVoiceState] = useState(getGoogleVoice);
  const [followWords, setFollowWords] = useRememberedToggle(FOLLOW_WORDS_KEY);
  const [followSentence, setFollowSentence] = useRememberedToggle(FOLLOW_SENTENCE_KEY);
  // Chirp 3 HD voices don't give reliable word timing: they highlight by sentence only.
  const sentenceOnlyVoice = providerId === "google_cloud" && googleVoice.includes("-Chirp3-HD-");
  const [playingKey, setPlayingKey] = useState<string | null>(null);
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const playToken = useRef(0);

  const provider = providerId ? getTtsProvider(providerId) : undefined;
  const warning =
    provider && !provider.isAvailable()
      ? (provider.unavailableMessage?.() ?? "This voice isn't available.")
      : undefined;

  const stop = useCallback(() => {
    playToken.current++;
    provider?.stop();
    setPlayingKey(null);
    setLoadingKey(null);
  }, [provider]);

  useEffect(() => () => provider?.stop(), [provider]);

  const speak = useCallback(
    async (text: string, key: string = text, options?: SpeakOptions): Promise<SpeakResult> => {
      if (!provider) return "stopped";
      stop();
      setError(null);
      if (!provider.isAvailable()) {
        setError(provider.unavailableMessage?.() ?? "This voice isn't available.");
        return "stopped";
      }
      const token = ++playToken.current;
      setPlayingKey(key);
      setLoadingKey(key);
      // Ignore late position callbacks from a playback that has since been stopped or replaced.
      const guard = (fn?: (i: number) => void) => fn && ((i: number) => token === playToken.current && fn(i));
      try {
        return await provider.speak(text, rate, {
          ...options,
          onWord: guard(options?.onWord),
          onProgress: guard(options?.onProgress),
          // Sound started: no longer loading. (Ignored if this playback has since been replaced.)
          onStart: () => {
            if (token !== playToken.current) return;
            setLoadingKey(null);
            options?.onStart?.();
          },
        });
      } catch (err) {
        if (token === playToken.current) setError(err instanceof Error ? err.message : "Playback failed.");
        return "stopped";
      } finally {
        if (token === playToken.current) {
          setPlayingKey(null);
          setLoadingKey(null);
        }
      }
    },
    [provider, rate, stop],
  );

  // The speed for each turn of a dialogue (read when the turn starts, so a change mid-dialogue carries on).
  const rateRef = useRef(rate);
  rateRef.current = rate;

  const speakTurns = useCallback(
    async (turns: DialogueTurn[], key: string, options: TurnsOptions = {}): Promise<SpeakResult> => {
      if (!provider) return "stopped";
      stop();
      setError(null);
      if (!provider.isAvailable()) {
        setError(provider.unavailableMessage?.() ?? "This voice isn't available.");
        return "stopped";
      }
      const token = ++playToken.current;
      const live = () => token === playToken.current;
      setPlayingKey(key);
      setLoadingKey(key);
      const startWord = options.startWord ?? 0;
      let first = turns.findIndex((t) => startWord < t.start + t.words.length);
      if (first < 0) first = 0;
      try {
        for (let n = first; n < turns.length; n++) {
          const turn = turns[n];
          const next = turns[n + 1];
          if (next) {
            provider.prefetch?.(next.words.join(" "), rateRef.current, { words: next.words, speaker: next.speaker });
          }
          const outcome = await provider.speak(turn.words.join(" "), rateRef.current, {
            words: turn.words,
            speaker: turn.speaker,
            startWord: n === first ? Math.max(0, startWord - turn.start) : 0,
            onWord: (i) => live() && options.onWord?.(turn.start + i),
            onProgress: (i) => live() && options.onProgress?.(turn.start + i),
            onStart: () => {
              if (!live()) return;
              setLoadingKey(null);
              options.onStart?.();
            },
          });
          if (outcome !== "ended" || !live()) return "stopped";
        }
        return "ended";
      } catch (err) {
        if (live()) setError(err instanceof Error ? err.message : "Playback failed.");
        return "stopped";
      } finally {
        if (live()) {
          setPlayingKey(null);
          setLoadingKey(null);
        }
      }
    },
    [provider, stop],
  );

  const setProviderId = useCallback(
    (id: string) => {
      stop();
      setError(null);
      setProviderIdState(id);
      try {
        localStorage.setItem(PROVIDER_STORAGE_KEY, id);
      } catch {
        // ignore
      }
    },
    [stop],
  );

  const setRate = useCallback(
    (r: number) => {
      // Change the speed of what's playing if the provider can; otherwise stop (the Reader restarts
      // from where it was, at the new speed).
      if (!(playingKey && provider?.setLiveRate?.(r))) stop();
      setRateState(r);
    },
    [stop, playingKey, provider],
  );

  const setGoogleVoice = useCallback(
    (voice: string) => {
      stop();
      storeGoogleVoice(voice);
      setGoogleVoiceState(voice);
    },
    [stop],
  );

  const value = useMemo<TtsContextValue>(
    () => ({
      providers: listTtsProviders(),
      providerId,
      setProviderId,
      rate,
      setRate,
      googleVoice,
      setGoogleVoice,
      followSentence,
      setFollowSentence,
      followWords,
      setFollowWords,
      wordsFollowed: followWords && !sentenceOnlyVoice,
      sentenceOnlyVoice,
      playingKey,
      loadingKey,
      error,
      clearError: () => setError(null),
      warning,
      speak,
      speakTurns,
      stop,
    }),
    [
      providerId,
      setProviderId,
      rate,
      setRate,
      googleVoice,
      setGoogleVoice,
      followSentence,
      setFollowSentence,
      followWords,
      setFollowWords,
      sentenceOnlyVoice,
      playingKey,
      loadingKey,
      error,
      warning,
      speak,
      speakTurns,
      stop,
    ],
  );

  return <TtsContext.Provider value={value}>{children}</TtsContext.Provider>;
}

export function useTts(): TtsContextValue {
  const ctx = useContext(TtsContext);
  if (!ctx) throw new Error("useTts must be used inside <TtsProviderRoot>");
  return ctx;
}
