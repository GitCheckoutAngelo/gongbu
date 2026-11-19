/**
 * Home: the app's two halves at a glance. Each tile has one status line and at most one action.
 * Learn = reference (Hangul, Rules); Practice = daily (Words, Reader).
 */
import { useEffect, useState, type ReactNode } from "react";
import { WatermarkCards, WatermarkHangul, WatermarkLines, WatermarkRules } from "../components/HomeWatermarks";
import { IconPlay, IconRepeat, IconSparkle } from "../components/words/icons";
import { JAMO } from "../data/hangul";
import { RULES } from "../data/rules";
import { Link, navigate } from "../router";
import { loadReaderSnapshot } from "./readerSnapshot";

const LEVEL_LABEL = { beginner: "Beginner", intermediate: "Intermediate", advanced: "Advanced" } as const;
const LENGTH_LABEL = { short: "Short", medium: "Medium", long: "Long" } as const;

function Tile({
  to,
  ko,
  en,
  status,
  action,
  art,
}: {
  to: string;
  ko: string;
  en: string;
  status: ReactNode;
  action?: ReactNode;
  /** A faint decorative graphic (shown on wide screens). */
  art?: ReactNode;
}) {
  return (
    <div className="home-tile">
      {art && (
        <span className="home-art" aria-hidden="true">
          {art}
        </span>
      )}
      {/* The whole tile opens the page; the action (if any) sits on top of it. */}
      <Link to={to} className="home-tile-link">
        <span className="home-tile-ko" lang="ko">
          {ko}
        </span>
        <span className="home-tile-en">{en}</span>
        <span className="home-tile-status">{status}</span>
      </Link>
      {action}
    </div>
  );
}

export function HomePage() {
  const reader = loadReaderSnapshot();
  const [words, setWords] = useState<{ due: number; fresh: number } | null>(null);

  useEffect(() => {
    let live = true;
    import("../services/srs/homeSummary").then(({ wordsToday }) => live && setWords(wordsToday()));
    return () => {
      live = false;
    };
  }, []);

  const toDo = words ? words.due + words.fresh : 0;
  const settings = reader?.used;

  return (
    <div className="home">
      <section className="home-group" aria-labelledby="home-learn">
        <h2 id="home-learn" className="home-group-title">
          Learn <span className="muted ko-sub">배우기</span>
        </h2>
        <Tile to="/hangul" ko="한글" en="Hangul" status={`${JAMO.length} letters`} art={<WatermarkHangul />} />
        <Tile
          to="/rules"
          ko="발음"
          en="Rules"
          status={`${RULES.length} pronunciation rules`}
          art={<WatermarkRules />}
        />
      </section>

      <section className="home-group" aria-labelledby="home-practice">
        <h2 id="home-practice" className="home-group-title">
          Practice <span className="muted ko-sub">연습하기</span>
        </h2>
        <Tile
          to="/words"
          ko="단어"
          en="Words"
          art={<WatermarkCards />}
          status={
            !words ? (
              "…"
            ) : toDo === 0 ? (
              "All done today ✓"
            ) : (
              <>
                {words.due} due · {words.fresh} new
              </>
            )
          }
          action={
            words && toDo > 0 ? (
              <button type="button" className="primary home-action" onClick={() => navigate("/words#start")}>
                <IconPlay /> Start
              </button>
            ) : undefined
          }
        />
        <Tile
          to="/reader"
          ko="읽기"
          en="Reader"
          art={<WatermarkLines />}
          status={
            reader?.result && settings
              ? [LEVEL_LABEL[settings.difficulty], LENGTH_LABEL[settings.length], settings.topic]
                  .filter(Boolean)
                  .join(" · ")
              : "No paragraph yet"
          }
          action={
            <button type="button" className="home-action secondary" onClick={() => navigate("/reader")}>
              {reader?.result ? (
                <>
                  <IconRepeat /> Continue
                </>
              ) : (
                <>
                  <IconSparkle /> Generate
                </>
              )}
            </button>
          }
        />
      </section>
    </div>
  );
}
