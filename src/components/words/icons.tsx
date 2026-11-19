/** Small inline SVG icons (no dependency). They use currentColor, so they follow the theme. */
import type { ReactNode, SVGProps } from "react";

function Svg({ children, ...props }: SVGProps<SVGSVGElement> & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}

export const IconClock = () => (
  <Svg>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </Svg>
);

export const IconSparkle = () => (
  <Svg>
    <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />
    <path d="M19 16v4M17 18h4" />
  </Svg>
);

export const IconMistake = () => (
  <Svg>
    <circle cx="12" cy="12" r="9" />
    <path d="M9 9l6 6M15 9l-6 6" />
  </Svg>
);

export const IconStack = () => (
  <Svg>
    <rect x="4" y="8" width="16" height="12" rx="2" />
    <path d="M7 5h10M9 2h6" />
  </Svg>
);

export const IconPlay = () => (
  <Svg fill="currentColor" stroke="none">
    <path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z" />
  </Svg>
);

export const IconCheckCircle = () => (
  <Svg>
    <circle cx="12" cy="12" r="9" />
    <path d="M8 12.5l2.5 2.5L16 9.5" />
  </Svg>
);

export const IconPlus = () => (
  <Svg>
    <path d="M12 5v14M5 12h14" />
  </Svg>
);

export const IconRepeat = () => (
  <Svg>
    <path d="M17 2l3 3-3 3" />
    <path d="M4 11V9a4 4 0 0 1 4-4h12" />
    <path d="M7 22l-3-3 3-3" />
    <path d="M20 13v2a4 4 0 0 1-4 4H4" />
  </Svg>
);

export const IconSpeaker = () => (
  <Svg>
    <path d="M11 5L6 9H3v6h3l5 4z" />
    <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" />
  </Svg>
);

export const IconTag = () => (
  <Svg>
    <path d="M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z" />
    <circle cx="7.5" cy="7.5" r="1.5" />
  </Svg>
);

export const IconArrowRight = () => (
  <Svg>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </Svg>
);

export const IconDevice = () => (
  <Svg>
    <rect x="3" y="4" width="18" height="12" rx="2" />
    <path d="M8 20h8M12 16v4" />
  </Svg>
);

export const IconCloud = () => (
  <Svg>
    <path d="M7 18h10.5a4 4 0 0 0 .6-7.95A6 6 0 0 0 6.3 10 4 4 0 0 0 7 18z" />
  </Svg>
);

export const IconPencil = () => (
  <Svg>
    <path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z" />
    <path d="M13.5 6.5l4 4" />
  </Svg>
);

export const IconChevronDown = () => (
  <Svg>
    <path d="M6 9l6 6 6-6" />
  </Svg>
);

/** Signal bars: `level` of 3 filled (difficulty). */
export function IconBars({ level }: { level: 1 | 2 | 3 }) {
  return (
    <Svg strokeWidth={0} fill="currentColor">
      {[0, 1, 2].map((i) => (
        <rect key={i} x={4 + i * 6} y={14 - i * 4} width="4" height={6 + i * 4} rx="1" opacity={i < level ? 1 : 0.25} />
      ))}
    </Svg>
  );
}

/** Lines of text: more lines = longer (length). */
export function IconLines({ count }: { count: 2 | 3 | 5 }) {
  const ys = { 2: [9, 15], 3: [7, 12, 17], 5: [4, 8, 12, 16, 20] }[count];
  return (
    <Svg>
      {ys.map((y, i) => (
        <path key={y} d={`M4 ${y}h${i === ys.length - 1 ? 9 : 16}`} />
      ))}
    </Svg>
  );
}

/** Faces for the four grades: forgot, struggled, remembered, instant. */
const FACE_MOUTHS = {
  again: <path d="M8 16.5c1.2-1.4 2.5-2 4-2s2.8.6 4 2" />,
  hard: <path d="M8.5 15.5h7" />,
  good: <path d="M8 14.5c1.2 1.4 2.5 2 4 2s2.8-.6 4-2" />,
  easy: <path d="M7.5 13.5h9a4.5 4.5 0 0 1-9 0z" />,
};

export function IconFace({ grade }: { grade: keyof typeof FACE_MOUTHS }) {
  return (
    <Svg>
      <circle cx="12" cy="12" r="9.5" />
      {grade === "again" ? (
        <path d="M8 9l2 1.2M16 9l-2 1.2" />
      ) : (
        <>
          <circle cx="9" cy="10" r="0.6" fill="currentColor" />
          <circle cx="15" cy="10" r="0.6" fill="currentColor" />
        </>
      )}
      {FACE_MOUTHS[grade]}
    </Svg>
  );
}
