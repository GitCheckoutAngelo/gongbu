/**
 * Korean words that show how they're read and what they mean, in a bubble on hover
 * (or on tap, via focus, on a phone). Words missing from the glossary are shown plainly.
 */
import { BASICS_GLOSSARY, type GlossEntry } from "../../data/basicsGlossary";

const HANGUL_RUN = /([ᄀ-ᇿ㄰-㆏가-힣]+)/;

/** The Korean pieces in "(날씨)" are dimmed so the English reads first. */
function Pieces({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\([^()]*[가-힣][^()]*\))/).map((part, i) =>
        i % 2 === 1 ? (
          <span key={i} className="gloss-piece" lang="ko">
            {part}
          </span>
        ) : (
          part
        ),
      )}
    </>
  );
}

export function GlossWord({ ko }: { ko: string }) {
  const entry = BASICS_GLOSSARY[ko];
  if (!entry) return <span lang="ko">{ko}</span>;
  return (
    <span className="gloss-word" tabIndex={0} lang="ko">
      {ko}
      <GlossTip entry={entry} />
    </span>
  );
}

/**
 * Just the bubble, for a box that already shows the word (a sentence tile). It appears when its
 * parent `.has-tip` is hovered or focused. Pass `ko` to look it up, or an `entry` directly.
 */
export function GlossTip({ ko, entry }: { ko?: string; entry?: GlossEntry }) {
  const e = entry ?? (ko ? BASICS_GLOSSARY[ko] : undefined);
  if (!e) return null;
  return <TipBody entry={e} />;
}

/** "coffee (커피)" or "now, polite (어요, merges into 가요)": English, Korean, optional note. */
const PIECE = /^(.*?)\s*\(([^()]*[가-힣ㄱ-ㅎ][^()]*)\)\s*(.*)$/;

/**
 * Splits a glossary meaning into a short meaning line and the word's pieces.
 *   "ate: eat (먹) + past, polite (었어요)"  → "ate",    [먹 eat, 었어요 past, polite]
 *   "coffee (커피) + object tag (를)"         → "coffee", [커피 coffee, 를 object tag]
 *   "topic tag, after a consonant: e.g. …"   → "topic tag, after a consonant", note "e.g. …"
 */
function parseGloss(en: string) {
  const colon = en.indexOf(": ");
  const meaning = colon >= 0 ? en.slice(0, colon) : null;
  const rest = colon >= 0 ? en.slice(colon + 2) : en;
  const bits = rest.split(" + ");
  const pieces = bits.map((b) => b.match(PIECE));
  if (bits.length > 1 && pieces.every(Boolean)) {
    const parts = pieces.map((m) => {
      const [ko, ...note] = m![2].split(", ");
      return {
        ko,
        en: m![1],
        note: [note.join(", "), m![3].replace(/^,\s*/, "")]
          .filter(Boolean)
          .join(", "),
      };
    });
    return { meaning: meaning ?? parts[0].en, parts, note: null };
  }
  return meaning
    ? { meaning, parts: null, note: rest }
    : { meaning: rest, parts: null, note: null };
}

function TipBody({ entry }: { entry: GlossEntry }) {
  const g = parseGloss(entry.en);
  return (
    <span className="gloss-tip" role="tooltip" lang="en">
      <span className="gloss-rom">{entry.rom}</span>
      <span className="gloss-en">
        <Pieces text={g.meaning} />
      </span>
      {g.parts && (
        <span className="gloss-build">
          {g.parts.map((p, i) => (
            <span key={i} className="gloss-part">
              {i > 0 && <span className="gloss-plus">+</span>}
              <span className="gloss-part-ko" lang="ko">
                {p.ko}
              </span>{" "}
              {p.en}
              {p.note && <span className="gloss-part-note"> ({p.note})</span>}
            </span>
          ))}
        </span>
      )}
      {g.note && (
        <span className="gloss-build">
          <Pieces text={g.note} />
        </span>
      )}
    </span>
  );
}

/** English prose with each Korean word made hoverable. */
export function GlossText({ text }: { text: string }) {
  return (
    <>
      {text
        .split(HANGUL_RUN)
        .map((part, i) =>
          i % 2 === 1 ? <GlossWord key={i} ko={part} /> : part,
        )}
    </>
  );
}
