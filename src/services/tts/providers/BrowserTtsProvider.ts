import { registerTtsProvider } from "../providerStore";
import { TtsError, type SpeakOptions, type SpeakResult, type TtsProvider } from "../TtsProvider";

const NO_VOICE_MESSAGE =
  "No Korean voice is installed in this browser/OS. Install a Korean voice in your system's " +
  "language/speech settings, or switch to “Google Cloud” in Settings.";

interface Chunk {
  text: string;
  /** Offset of this chunk in the full text. */
  start: number;
}

/** Split into sentences (with their offsets): some browsers cut off a single long utterance after ~15s. */
function splitSentences(text: string): Chunk[] {
  const chunks: Chunk[] = [];
  const re = /[^.!?。…]+[.!?。…]*/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text))) {
    const raw = match[0];
    const lead = raw.length - raw.trimStart().length;
    const trimmed = raw.trim();
    if (trimmed) chunks.push({ text: trimmed, start: match.index + lead });
  }
  return chunks.length ? chunks : [{ text, start: 0 }];
}

/** Character offset in `text` where each word starts. */
function wordOffsets(text: string, words: string[]): number[] {
  const offsets: number[] = [];
  let cursor = 0;
  for (const word of words) {
    const at = text.indexOf(word, cursor);
    offsets.push(at === -1 ? cursor : at);
    cursor = at === -1 ? cursor : at + word.length;
  }
  return offsets;
}

/** Index of the word containing character position `pos`. */
function wordIndexAt(offsets: number[], pos: number): number {
  let index = 0;
  for (let i = 0; i < offsets.length && offsets[i] <= pos; i++) index = i;
  return index;
}

function isKorean(voice: SpeechSynthesisVoice): boolean {
  return voice.lang.replace("_", "-").toLowerCase().startsWith("ko");
}

/**
 * Web Speech API. Word positions come from the utterance's "boundary" events, which only some voices
 * send (typically OS voices such as Microsoft or Apple ones; Chrome's online Google voices usually
 * don't). Without them, no word is reported, rather than a guessed one.
 */
export class BrowserTtsProvider implements TtsProvider {
  private readonly synth: SpeechSynthesis | undefined =
    typeof window !== "undefined" && "speechSynthesis" in window ? window.speechSynthesis : undefined;
  private voicesLoaded = false;
  private runId = 0;
  private finishCurrent: (() => void) | undefined;

  constructor() {
    if (!this.synth) return;
    const update = () => {
      if (this.synth!.getVoices().length > 0) this.voicesLoaded = true;
    };
    update();
    this.synth.addEventListener?.("voiceschanged", update);
  }

  isAvailable(): boolean {
    if (!this.synth) return false;
    // Until the voice list loads we can't know yet; speak() re-checks.
    return !this.voicesLoaded || this.findVoice(this.synth.getVoices()) !== undefined;
  }

  unavailableMessage(): string {
    return this.synth
      ? NO_VOICE_MESSAGE
      : "This browser doesn't support speech synthesis. Switch to “Google Cloud” in Settings.";
  }

  async speak(text: string, rate: number, options: SpeakOptions = {}): Promise<SpeakResult> {
    this.stop();
    const run = ++this.runId;
    if (!this.synth) throw new TtsError(this.unavailableMessage());

    const voice = this.findVoice(await this.loadVoices());
    if (run !== this.runId) return "stopped";
    if (!voice) throw new TtsError(NO_VOICE_MESSAGE);

    const { onWord, onProgress } = options;
    let onStart = options.onStart; // fires once, on the first sentence
    const offsets = options.words?.length ? wordOffsets(text, options.words) : null;
    // Speech can't seek, so "start from a word" means speaking the text from that word's offset.
    const startWord = offsets ? Math.min(options.startWord ?? 0, offsets.length - 1) : 0;
    const begin = offsets && startWord > 0 ? offsets[startWord] : 0;
    if (startWord > 0) onWord?.(startWord);
    for (const part of splitSentences(text.slice(begin))) {
      const chunk = { text: part.text, start: part.start + begin };
      // Even without word events we know the sentence, so resuming can at least restart this sentence.
      if (offsets) onProgress?.(wordIndexAt(offsets, chunk.start));
      const onBoundary =
        offsets && (onWord || onProgress)
          ? (charIndex: number) => {
              const index = wordIndexAt(offsets, chunk.start + charIndex);
              onWord?.(index);
              onProgress?.(index);
            }
          : undefined;
      await this.speakOne(chunk.text, voice, rate, onBoundary, onStart);
      onStart = undefined;
      if (run !== this.runId) return "stopped";
    }
    return "ended";
  }

  stop(): void {
    this.runId++;
    this.synth?.cancel();
    this.finishCurrent?.();
    this.finishCurrent = undefined;
  }

  private findVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | undefined {
    const korean = voices.filter(isKorean);
    return korean.find((v) => v.localService) ?? korean[0];
  }

  private loadVoices(): Promise<SpeechSynthesisVoice[]> {
    const synth = this.synth!;
    const voices = synth.getVoices();
    if (voices.length > 0) return Promise.resolve(voices);
    return new Promise((resolve) => {
      const done = () => {
        synth.removeEventListener?.("voiceschanged", done);
        clearTimeout(timer);
        this.voicesLoaded = true;
        resolve(synth.getVoices());
      };
      const timer = setTimeout(done, 2000);
      synth.addEventListener?.("voiceschanged", done);
    });
  }

  private speakOne(
    text: string,
    voice: SpeechSynthesisVoice,
    rate: number,
    onBoundary?: (charIndex: number) => void,
    onStart?: () => void,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      // "Started" fires once: on the start event, or (if a browser skips it) the first word or the end.
      let startPending = !!onStart;
      const started = () => {
        if (startPending) {
          startPending = false;
          onStart?.();
        }
      };
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.voice = voice;
      utterance.lang = voice.lang || "ko-KR";
      utterance.rate = rate;
      if (onBoundary) {
        utterance.onboundary = (event) => {
          started();
          if (event.name === "word") onBoundary(event.charIndex);
        };
      }
      const finish = () => {
        started();
        this.finishCurrent = undefined;
        resolve();
      };
      this.finishCurrent = finish;
      utterance.onend = finish;
      if (onStart) utterance.onstart = started;
      utterance.onerror = (event) => {
        if (event.error === "interrupted" || event.error === "canceled") finish();
        else {
          this.finishCurrent = undefined;
          reject(new TtsError(`The browser couldn't speak this text (${event.error}).`));
        }
      };
      this.synth!.speak(utterance);
    });
  }
}

registerTtsProvider({ id: "browser", label: "Browser", create: () => new BrowserTtsProvider() });
