import type { CSSProperties, ReactNode } from "react";
import { Link } from "../router";
import { useTts } from "../tts/TtsContext";
import {
  WatermarkCards,
  WatermarkGrammar,
  WatermarkHangul,
  WatermarkLines,
} from "./HomeWatermarks";
import { SettingsMenu } from "./SettingsPanel";
import { IconHome } from "./words/icons";

// Two groups, as on the home page: Learn (reference) and Practice (daily).
const NAV_GROUPS = [
  {
    label: "Learn",
    items: [
      { to: "/hangul", label: "Hangul", ko: "한글" },
      { to: "/grammar", label: "Grammar", ko: "문법" },
    ],
  },
  {
    label: "Practice",
    items: [
      { to: "/words", label: "Words", ko: "단어" },
      { to: "/reader", label: "Reader", ko: "읽기" },
    ],
  },
];

/** Phones: a tab bar fixed to the bottom of the screen (within thumb reach), instead of the top tabs. */
const BOTTOM_TABS = [
  { to: "/", label: "Home", icon: <IconHome /> },
  { to: "/hangul", label: "Hangul", icon: <WatermarkHangul /> },
  { to: "/grammar", label: "Grammar", icon: <WatermarkGrammar /> },
  { to: "/words", label: "Words", icon: <WatermarkCards /> },
  { to: "/reader", label: "Reader", icon: <WatermarkLines /> },
];

/** Pages shown as tabs of one nav item: Hangul = letters + pronunciation rules; Grammar = basics + patterns. */
const SUBPAGES: Record<string, { to: string; label: string; ko: string }[]> = {
  "/hangul": [
    { to: "/hangul", label: "Letters", ko: "자모" },
    { to: "/rules", label: "Pronunciation", ko: "발음" },
  ],
  "/grammar": [
    { to: "/grammar", label: "Sentence basics", ko: "기본" },
    { to: "/grammar/patterns", label: "Patterns", ko: "문형" },
  ],
};

/** The nav item a path belongs to (/words/browse is in Words, /rules in Hangul). */
function sectionOf(path: string): string {
  for (const [section, pages] of Object.entries(SUBPAGES))
    if (pages.some((p) => p.to === path)) return section;
  return path.startsWith("/words") ? "/words" : path;
}
const inSection = (path: string, to: string) => sectionOf(path) === to;

/** Switches between a nav item's pages, with one highlight that slides under the current one. */
function SubpageTabs({ path }: { path: string }) {
  const pages = SUBPAGES[sectionOf(path)];
  if (!pages) return null;
  const at = pages.findIndex((p) => p.to === path);
  return (
    <nav
      className="subpage-tabs"
      aria-label="Pages"
      style={{ "--at": at, "--count": pages.length } as CSSProperties}
    >
      {pages.map((p) => (
        <Link
          key={p.to}
          to={p.to}
          aria-current={p.to === path ? "page" : undefined}
        >
          <span lang="ko">{p.ko}</span> {p.label}
        </Link>
      ))}
    </nav>
  );
}

export function Layout({
  path,
  children,
}: {
  path: string;
  children: ReactNode;
}) {
  const { error, clearError } = useTts();
  // Like the top tabs, no tab bar on Home: its tiles are the navigation there.
  const showTabs = path !== "/";
  return (
    <div className={`app${showTabs ? " has-bottom-nav" : ""}`}>
      <header className="site-header">
        <div className="header-top">
          <h1>
            {/* The title is also the way home. */}
            <Link
              to="/"
              className="brand"
              aria-current={path === "/" ? "page" : undefined}
            >
              공부 <span className="subtitle">Gongbu</span>
            </Link>
          </h1>
          <SettingsMenu />
        </div>
        {/* No nav bar on Home: its tiles are the navigation there. */}
        {path !== "/" && (
          <nav className="nav" aria-label="Main">
            <Link
              to="/"
              className="nav-home"
              aria-label="Home"
              aria-current={path === "/" ? "page" : undefined}
            >
              <IconHome />
            </Link>
            {NAV_GROUPS.map((group) => (
              <div
                key={group.label}
                className="nav-group"
                role="group"
                aria-label={group.label}
              >
                <span className="nav-group-label" aria-hidden="true">
                  {group.label}
                </span>
                {group.items.map((item) => (
                  <Link
                    key={item.to}
                    to={item.to}
                    aria-current={inSection(path, item.to) ? "page" : undefined}
                  >
                    <span lang="ko">{item.ko}</span> {item.label}
                  </Link>
                ))}
              </div>
            ))}
          </nav>
        )}
      </header>

      {error && (
        <div className="error tts-error" role="alert">
          <span>{error}</span>
          <button
            type="button"
            className="dismiss"
            aria-label="Dismiss"
            onClick={clearError}
          >
            ×
          </button>
        </div>
      )}

      <main>
        <SubpageTabs path={path} />
        {children}
      </main>

      {showTabs && (
        <nav className="bottom-nav" aria-label="Sections">
          {BOTTOM_TABS.map((tab) => (
            <Link
              key={tab.to}
              to={tab.to}
              aria-current={inSection(path, tab.to) ? "page" : undefined}
            >
              <span className="bottom-nav-icon" aria-hidden="true">
                {tab.icon}
              </span>
              <span className="bottom-nav-label">{tab.label}</span>
            </Link>
          ))}
        </nav>
      )}
    </div>
  );
}
