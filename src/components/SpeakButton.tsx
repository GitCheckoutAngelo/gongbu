import type { ReactNode } from "react";
import { useTts } from "../tts/TtsContext";

interface Props {
  /** Korean text to speak. */
  text: string;
  /** Accessible label, e.g. "Play 가". Defaults to "Play <text>". */
  label?: string;
  /** Visible content; defaults to a speaker icon. */
  children?: ReactNode;
  className?: string;
}

/** Plays `text` through the shared TTS provider; pressing again while playing stops it. */
export function SpeakButton({ text, label, children, className }: Props) {
  const { speak, stop, playingKey, loadingKey } = useTts();
  const playing = playingKey === text;
  const loading = loadingKey === text;
  return (
    <button
      type="button"
      className={`speak-button${playing ? " playing" : ""}${loading ? " loading" : ""}${className ? ` ${className}` : ""}`}
      aria-label={loading ? "Loading audio (press to cancel)" : playing ? "Stop" : (label ?? `Play ${text}`)}
      aria-busy={loading || undefined}
      title={loading ? "Loading…" : playing ? "Stop" : (label ?? `Play ${text}`)}
      onClick={() => (playing ? stop() : void speak(text))}
    >
      <span aria-hidden="true" className="speak-icon icon-slot">
        {loading ? <span className="spinner" /> : playing ? "■" : "🔊"}
      </span>
      {children}
    </button>
  );
}
