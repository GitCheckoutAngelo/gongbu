import type { ReactNode } from "react";
import { Link } from "../router";
import { useTts } from "../tts/TtsContext";
import { SettingsMenu } from "./SettingsPanel";

// Learning order: letters → how they sound together → vocabulary → reading.
const NAV = [
  { to: "/hangul", label: "Hangul", ko: "한글" },
  { to: "/rules", label: "Rules", ko: "발음" },
  { to: "/words", label: "Words", ko: "단어" },
  { to: "/reader", label: "Reader", ko: "읽기" },
];

export function Layout({ path, children }: { path: string; children: ReactNode }) {
  const { error, clearError } = useTts();
  return (
    <div className="app">
      <header className="site-header">
        <div className="header-top">
          <h1>
            공부 <span className="subtitle">Gongbu</span>
          </h1>
          <SettingsMenu />
        </div>
        <nav className="nav" aria-label="Main">
          {NAV.map((item) => (
            <Link key={item.to} to={item.to} aria-current={path === item.to ? "page" : undefined}>
              <span lang="ko">{item.ko}</span> {item.label}
            </Link>
          ))}
        </nav>
      </header>

      {error && (
        <div className="error tts-error" role="alert">
          <span>{error}</span>
          <button type="button" className="dismiss" aria-label="Dismiss" onClick={clearError}>
            ×
          </button>
        </div>
      )}

      <main>
        {children}
      </main>
    </div>
  );
}
