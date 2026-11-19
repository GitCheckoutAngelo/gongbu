import { lazy, Suspense, useEffect } from "react";
import { Layout } from "./components/Layout";
import { HangulChartPage } from "./pages/HangulChartPage";
import { ReaderPage } from "./pages/ReaderPage";
import { RulesPage } from "./pages/RulesPage";
import { navigate, useLocation } from "./router";
import { TtsProviderRoot, useTts } from "./tts/TtsContext";

// Loaded on demand: the word list is the biggest piece of data in the app.
const WordsPage = lazy(() => import("./pages/WordsPage"));

const KNOWN_PATHS = ["/hangul", "/rules", "/words", "/words/browse", "/words/add", "/reader"];

function Routes() {
  const { path, hash } = useLocation();
  const { stop } = useTts();

  // Changing page: stop audio and start at the top (unless a #hash deep link handles scrolling).
  useEffect(() => {
    stop();
    if (!window.location.hash) window.scrollTo(0, 0);
  }, [path]); // intentionally only on page change

  // The app opens on the first tab (Hangul). Anything unknown goes there too.
  useEffect(() => {
    if (!KNOWN_PATHS.includes(path)) navigate(`/hangul${window.location.hash}`, { replace: true });
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
      page = <HangulChartPage hash={hash} />;
  }
  const section = path.startsWith("/words") ? "/words" : KNOWN_PATHS.includes(path) ? path : "/hangul";
  return <Layout path={section}>{page}</Layout>;
}

export default function App() {
  return (
    <TtsProviderRoot>
      <Routes />
    </TtsProviderRoot>
  );
}
