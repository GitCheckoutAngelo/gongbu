import { AddWords } from "../components/words/AddWords";
import { ProgressPanel } from "../components/words/ProgressPanel";
import { StudyPanel } from "../components/words/StudyPanel";
import { WordBrowser } from "../components/words/WordBrowser";
import { WordsProvider, WordsReady } from "../components/words/WordsContext";
import { Link } from "../router";

const TABS = [
  { to: "/words", label: "Today" },
  { to: "/words/browse", label: "Browse" },
  { to: "/words/add", label: "Add words" },
];

/** Common Words: spaced-repetition drills over high-frequency beginner vocabulary. */
export default function WordsPage({ path }: { path: string }) {
  const tab = TABS.find((t) => t.to === path) ?? TABS[0];
  return (
    <WordsProvider>
      <nav className="tabs" aria-label="Common Words">
        {TABS.map((t) => (
          <Link key={t.to} to={t.to} aria-current={t === tab ? "page" : undefined}>
            {t.label}
          </Link>
        ))}
      </nav>
      <WordsReady>
        {tab.to === "/words" && (
          <>
            <StudyPanel />
            <ProgressPanel />
          </>
        )}
        {tab.to === "/words/browse" && <WordBrowser />}
        {tab.to === "/words/add" && <AddWords />}
      </WordsReady>
    </WordsProvider>
  );
}
