/**
 * Faint, static watermark graphics for the home tiles (wide screens only; see styles.css). Drawn as
 * shapes in the favicon's style so they look the same without Korean fonts. Purely decorative.
 */
const common = {
  viewBox: "0 0 64 64",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 4,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
  focusable: false,
};

/** 공, as in the favicon: ㄱ over ㅗ over ㅇ. */
export const WatermarkHangul = () => (
  <svg {...common}>
    <path d="M18 10.75H45V21.5" />
    <path d="M32 25.5V32.25M13.5 32.25H50.5" />
    <circle cx="32" cy="46.75" r="6.5" />
  </svg>
);

/** Sound waves: pronunciation. */
export const WatermarkRules = () => (
  <svg {...common}>
    <path d="M14 26v12M22 20v24M30 12v40M38 22v20M46 16v32M54 28v8" />
  </svg>
);

/** A small stack of flashcards: vocabulary drills. */
export const WatermarkCards = () => (
  <svg {...common}>
    <rect x="20" y="8" width="34" height="42" rx="5" />
    <path d="M14 15v34a5 5 0 0 0 5 5h27" />
    <path d="M8 22v30a5 5 0 0 0 5 5h25" />
  </svg>
);

/** Lines of text with one line highlighted: reading along. */
export const WatermarkLines = () => (
  <svg {...common}>
    <path d="M10 14h44M10 26h36M10 50h28" />
    <rect x="7" y="33" width="50" height="10" rx="3" fill="currentColor" stroke="none" />
  </svg>
);
