/**
 * A minimal looping illustration shown while Claude writes a paragraph: an outline pen writes 공부
 * stroke by stroke (in stroke order, lifting between strokes), holds, fades, and starts again.
 * Decorative only; the busy Generate/Regenerate button already says what's happening.
 *
 * Timing uses the Web Animations API so the pen and every stroke share one clock, with each stroke's
 * share of the time proportional to its real length.
 */
import { useEffect, useRef } from "react";

/** Strokes in writing order (viewBox 0 0 72 40). */
const STROKES = [
  // 공: ㄱ, then ㅗ (short down, long across), then ㅇ (counter-clockwise from the top)
  "M10 6H28V13",
  "M19 16V21",
  "M7 21H31",
  "M19 25A5 5 0 1 0 19.01 25",
  // 부: ㅂ (left, right, middle, bottom), then ㅜ (across, then down)
  "M45 6V17",
  "M61 6V17",
  "M45 11.5H61",
  "M45 17H61",
  "M41 22H65",
  "M53 22V34",
];

const CYCLE_MS = 7000;
const WRITE_END = 0.78; // writing finishes here; then hold
const FADE_START = 0.86;
const FADE_END = 0.96;
const LIFT_COST = 4; // extra "length" for each pen lift, so it pauses a moment between strokes

export function WritingAnimation() {
  const strokeRefs = useRef<(SVGPathElement | null)[]>([]);
  const penRef = useRef<SVGGElement>(null);

  useEffect(() => {
    const paths = strokeRefs.current.filter((p): p is SVGPathElement => !!p);
    const pen = penRef.current;
    if (paths.length !== STROKES.length || !pen || typeof pen.animate !== "function") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    // Lay strokes and the lifts between them along one timeline, in proportion to length.
    const lengths = paths.map((p) => p.getTotalLength());
    const lifts = paths.map((p, i) => {
      if (i === 0) return 0;
      const a = paths[i - 1].getPointAtLength(lengths[i - 1]);
      const b = p.getPointAtLength(0);
      return Math.hypot(b.x - a.x, b.y - a.y) * 0.5 + LIFT_COST;
    });
    const total = [...lengths, ...lifts].reduce((s, l) => s + l, 0);
    const at = (units: number) => (units / total) * WRITE_END;

    const options: KeyframeAnimationOptions = { duration: CYCLE_MS, iterations: Infinity };
    const animations: Animation[] = [];
    const penFrames: Keyframe[] = [];
    let units = 0;

    paths.forEach((path, i) => {
      units += lifts[i];
      const start = at(units);
      units += lengths[i];
      const end = at(units);
      animations.push(
        path.animate(
          [
            { offset: 0, strokeDashoffset: 1, opacity: 1 },
            { offset: start, strokeDashoffset: 1 },
            { offset: end, strokeDashoffset: 0 },
            { offset: FADE_START, opacity: 1 },
            { offset: FADE_END, strokeDashoffset: 0, opacity: 0 },
            { offset: 1, strokeDashoffset: 0, opacity: 0 },
          ],
          options,
        ),
      );
      // The pen follows the stroke (sampled about once per unit), then glides to the next one.
      const steps = Math.max(2, Math.ceil(lengths[i]));
      for (let s = 0; s <= steps; s++) {
        const pt = path.getPointAtLength((lengths[i] * s) / steps);
        penFrames.push({ offset: start + ((end - start) * s) / steps, transform: `translate(${pt.x}px, ${pt.y}px)` });
      }
    });

    const first = penFrames[0];
    const last = penFrames[penFrames.length - 1];
    animations.push(
      pen.animate(
        [
          { transform: first.transform, offset: 0, opacity: 0 },
          { transform: first.transform, offset: 0.03, opacity: 1 },
          ...penFrames.filter((f) => (f.offset as number) > 0.03),
          { transform: last.transform, offset: FADE_START, opacity: 1 },
          { transform: last.transform, offset: FADE_END, opacity: 0 },
          { transform: last.transform, offset: 1, opacity: 0 },
        ],
        options,
      ),
    );
    pen.style.visibility = "visible";

    return () => {
      animations.forEach((a) => a.cancel());
      pen.style.visibility = "";
    };
  }, []);

  return (
    <div className="writing" aria-hidden="true">
      <svg className="writing-art" viewBox="0 0 72 40" focusable="false">
        {STROKES.map((d, i) => (
          <path
            key={d}
            ref={(el) => {
              strokeRefs.current[i] = el;
            }}
            className="writing-line"
            pathLength={1}
            d={d}
          />
        ))}
        {/* Drawn pointing down with its tip at (0, 0), leaning right. Hidden unless animated. */}
        <g ref={penRef} className="writing-pen">
          <g transform="rotate(35)">
            <rect className="writing-pen-body" x="-3" y="-25" width="6" height="17" rx="1.5" />
            <path className="writing-pen-nib" d="M-3 -8 L0 -1 L3 -8 Z" />
          </g>
        </g>
      </svg>
    </div>
  );
}
