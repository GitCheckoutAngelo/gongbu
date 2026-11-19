import type { ReactNode } from "react";
import { Link } from "../router";
import { useTts } from "../tts/TtsContext";
import { SettingsMenu } from "./SettingsPanel";
import { IconHome } from "./words/icons";

// Two groups, as on the home page: Learn (reference) and Practice (daily).
const NAV_GROUPS = [
  {
    label: "Learn",
    items: [
      { to: "/hangul", label: "Hangul", ko: "한글" },
      { to: "/rules", label: "Rules", ko: "발음" },
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

export function Layout({ path, children }: { path: string; children: ReactNode }) {
  const { error, clearError } = useTts();
  return (
    <div className="app">
      <header className="site-header">
        <div className="header-top">
          <h1>
            {/* The title is also the way home. */}
            <Link to="/" className="brand" aria-current={path === "/" ? "page" : undefined}>
              공부 <span className="subtitle">Gongbu</span>
            </Link>
          </h1>
          <SettingsMenu />
        </div>
        {/* No nav bar on Home: its tiles are the navigation there. */}
        {path !== "/" && (
          <nav className="nav" aria-label="Main">
            <Link to="/" className="nav-home" aria-label="Home" aria-current={path === "/" ? "page" : undefined}>
              <IconHome />
            </Link>
            {NAV_GROUPS.map((group) => (
              <div key={group.label} className="nav-group" role="group" aria-label={group.label}>
                <span className="nav-group-label" aria-hidden="true">
                  {group.label}
                </span>
                {group.items.map((item) => (
                  <Link key={item.to} to={item.to} aria-current={path === item.to ? "page" : undefined}>
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
          <button type="button" className="dismiss" aria-label="Dismiss" onClick={clearError}>
            ×
          </button>
        </div>
      )}

      <main>{children}</main>
    </div>
  );
}
