import { lazy, Suspense, useEffect } from "react";
import { Layout } from "./components/Layout";
import { GrammarPage } from "./pages/GrammarPage";
import { HangulChartPage } from "./pages/HangulChartPage";
import { HomePage } from "./pages/HomePage";
import { ReaderPage } from "./pages/ReaderPage";
import { RulesPage } from "./pages/RulesPage";
import { navigate, useLocation } from "./router";
import { TtsProviderRoot, useTts } from "./tts/TtsContext";

// Loaded on demand: the word list is the biggest piece of data in the app.
const WordsPage = lazy(() => import("./pages/WordsPage"));

const KNOWN_PATHS = [
  "/",
  "/hangul",
  "/rules",
  "/grammar",
  "/grammar/patterns",
  "/words",
  "/words/browse",
  "/words/add",
  "/reader",
];

function Routes() {
  const { path, hash } = useLocation();
  const { stop } = useTts();

  // Changing page: stop audio and start at the top (unless a #hash deep link handles scrolling).
  useEffect(() => {
    stop();
    if (!window.location.hash) window.scrollTo(0, 0);
  }, [path]); // intentionally only on page change

  // The app opens on Home. Anything unknown goes there too.
  useEffect(() => {
    if (!KNOWN_PATHS.includes(path)) navigate("/", { replace: true });
  }, [path]);

  let page;
  switch (path) {
    case "/reader":
      page = <ReaderPage />;
      break;
    case "/hangul":
      page = <HangulChartPage hash={hash} />;
      break;
    case "/rules":
      page = <RulesPage hash={hash} />;
      break;
    case "/grammar":
    case "/grammar/patterns":
      page = <GrammarPage view={path === "/grammar" ? "basics" : "patterns"} />;
      break;
    case "/words":
    case "/words/browse":
    case "/words/add":
      page = (
        <Suspense fallback={<p className="empty muted">Loading words…</p>}>
          <WordsPage path={path} />
        </Suspense>
      );
      break;
    default:
      page = <HomePage />;
  }
  return <Layout path={KNOWN_PATHS.includes(path) ? path : "/"}>{page}</Layout>;
}

export default function App() {
  return (
    <TtsProviderRoot>
      <Routes />
    </TtsProviderRoot>
  );
}
