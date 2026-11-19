import { StableLabel } from "./StableLabel";
import { IconPlay } from "./words/icons";

interface Props {
  playing: boolean;
  /** Pressed, but the audio hasn't started yet. */
  loading?: boolean;
  /** Paused partway through: Play continues from there. */
  resumable?: boolean;
  rate: number;
  onPlay: () => void;
  /** Pauses; the caller remembers the position. */
  onStop: () => void;
  onRateChange: (rate: number) => void;
}

export const RATES = [0.5, 0.75, 1, 1.25];

/** Play/Pause plus a speed chip that steps through the speeds (also in the header's voice settings). */
export function PlaybackControls({ playing, loading, resumable, rate, onPlay, onStop, onRateChange }: Props) {
  const nextRate = RATES[(RATES.indexOf(rate) + 1) % RATES.length] ?? 1;
  return (
    <div className="playback">
      <button
        type="button"
        className="speed-chip"
        onClick={() => onRateChange(nextRate)}
        aria-label={`Speed ${rate}x. Change to ${nextRate}x`}
        title="Change speed"
      >
        {rate}x
      </button>
      <button
        type="button"
        className={`play-button${playing ? " playing" : ""}${loading ? " loading" : ""}`}
        onClick={playing ? onStop : onPlay}
        aria-busy={loading || undefined}
        title={loading ? "Getting the audio ready (press to cancel)" : undefined}
      >
        <span className="icon-slot" aria-hidden="true">
          {loading ? <span className="spinner" /> : playing ? <span className="pause-icon" /> : <IconPlay />}
        </span>
        <StableLabel
          options={["Play", "Resume", "Pause", "Loading…"]}
          current={loading ? "Loading…" : playing ? "Pause" : resumable ? "Resume" : "Play"}
        />
      </button>
    </div>
  );
}
