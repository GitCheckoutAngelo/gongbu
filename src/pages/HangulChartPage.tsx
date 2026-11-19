import { useCallback, useEffect, useRef, useState } from "react";
import { JamoDetail, type DetailTab } from "../components/hangul/JamoDetail";
import { SyllableBlocks } from "../components/hangul/SyllableBlocks";
import { CATEGORY_TITLES, jamoByCategory, jamoById } from "../data/hangul";
import type { JamoCategory } from "../data/types";
import { navigate } from "../router";
import { useTts } from "../tts/TtsContext";

type ChartTab = "consonants" | "vowels";

const TABS: { id: ChartTab; glyph: string; label: string; sections: JamoCategory[] }[] = [
  { id: "consonants", glyph: "ㄱ", label: "Consonants", sections: ["basic-consonant", "double-consonant"] },
  { id: "vowels", glyph: "ㅏ", label: "Vowels", sections: ["basic-vowel", "compound-vowel"] },
];

/** /hangul#blocks opens the syllable-block explainer (not a jamo id, so no clash). */
const BLOCKS_HASH = "blocks";

/** The syllable-block explainer in the same sheet as the letter details. */
function BlocksSheet({ onClose }: { onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeRef.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.classList.add("no-scroll");
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.classList.remove("no-scroll");
    };
  }, [onClose]);
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div
        className="sheet blocks-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="blocks-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button ref={closeRef} type="button" className="sheet-close" aria-label="Close" onClick={onClose}>
          ×
        </button>
        <SyllableBlocks inSheet />
      </div>
    </div>
  );
}

const countOf = (sections: JamoCategory[]) => sections.reduce((n, c) => n + jamoByCategory(c).length, 0);

/**
 * The chart in two tabs (consonants, vowels), so each fits on a screen; "How syllable blocks work"
 * opens an explainer sheet (/hangul#blocks).
 * The selected jamo lives in the URL hash (/hangul#giyeok), so it can be linked and Back closes it;
 * opening one by link switches to its tab.
 */
export function HangulChartPage({ hash }: { hash: string }) {
  const { stop } = useTts();
  const selected = hash ? jamoById(hash) : undefined;
  const [tab, setTab] = useState<ChartTab>(selected?.kind === "vowel" ? "vowels" : "consonants");
  const [detailTab, setDetailTab] = useState<DetailTab>("examples");

  useEffect(() => {
    if (selected) setTab(selected.kind === "vowel" ? "vowels" : "consonants");
  }, [selected]);

  const close = useCallback(() => {
    stop();
    navigate("/hangul");
  }, [stop]);

  const current = TABS.find((t) => t.id === tab)!;

  return (
    <>
      <section className="card hangul-head">
        <div className="hangul-head-top">
          <h2>
            Hangul chart <span className="muted ko-sub">한글 자모</span>
          </h2>
          <button
            type="button"
            className="blocks-button"
            aria-haspopup="dialog"
            onClick={() => navigate(`/hangul#${BLOCKS_HASH}`)}
          >
            <span className="blocks-button-glyph" lang="ko" aria-hidden="true">
              가
            </span>
            How syllable blocks work
          </button>
        </div>
        <p className="muted">Tap a letter to see how it sounds, how it's romanized, and example words.</p>
        <div className="chart-tabs" role="tablist" aria-label="Hangul chart">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`chart-tab-${t.id}`}
              aria-selected={t.id === tab}
              aria-controls={`chart-panel-${t.id}`}
              className={`chart-tab tab-${t.id}${t.id === tab ? " selected" : ""}`}
              onClick={() => setTab(t.id)}
            >
              <span className="chart-tab-glyph" lang="ko" aria-hidden="true">
                {t.glyph}
              </span>
              <span className="chart-tab-label">{t.label}</span>
              {t.sections.length > 0 && <span className="chart-tab-count">{countOf(t.sections)}</span>}
            </button>
          ))}
        </div>
      </section>

      <div
        key={tab}
        id={`chart-panel-${tab}`}
        role="tabpanel"
        aria-labelledby={`chart-tab-${tab}`}
        className="chart-panel"
      >
        <section className={`card jamo-chart ${tab}`}>
            {current.sections.map((category) => {
              const items = jamoByCategory(category);
              return (
                <div
                  key={category}
                  className={`jamo-section ${category.endsWith("vowel") ? "is-vowel" : "is-consonant"} ${category}`}
                >
                  <h3 className="jamo-section-head">
                    <span className="jamo-dot" aria-hidden="true" />
                    {CATEGORY_TITLES[category].title}{" "}
                    <span className="muted ko-sub" lang="ko">
                      {CATEGORY_TITLES[category].korean}
                    </span>
                    <span className="jamo-count">{items.length}</span>
                  </h3>
                  <div className="jamo-grid">
                    {items.map((j) => (
                      <button
                        key={j.id}
                        type="button"
                        className={`jamo-tile${selected?.id === j.id ? " selected" : ""}`}
                        onClick={() => navigate(`/hangul#${j.id}`)}
                        aria-label={`${j.char} ${j.name}`}
                      >
                        <span className="jamo-char" lang="ko">
                          {j.char}
                        </span>
                        <span className="jamo-rom">
                          {j.kind === "consonant"
                            ? [j.romanization.initial || "∅", j.romanization.final]
                                .filter((v, i, arr) => v && arr.indexOf(v) === i)
                                .join(" / ")
                            : j.romanization}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
        </section>
      </div>

      {selected && <JamoDetail jamo={selected} tab={detailTab} onTabChange={setDetailTab} onClose={close} />}
      {hash === BLOCKS_HASH && <BlocksSheet onClose={close} />}
    </>
  );
}
