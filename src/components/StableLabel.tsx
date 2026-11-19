/**
 * A button label that keeps the same width whichever text is showing: every option is laid out in the
 * same grid cell (the widest sets the size), and only `current` is visible. Stops buttons resizing when
 * they switch between e.g. "Play" / "Pause" / "Resume".
 */
export function StableLabel({ options, current }: { options: string[]; current: string }) {
  return (
    <span className="stable-label">
      {options.map((o) => (
        <span key={o} className={o === current ? "on" : undefined} aria-hidden={o !== current || undefined}>
          {o}
        </span>
      ))}
    </span>
  );
}
