import { SYLLABLE_BLOCK_EXAMPLES } from "../../data/hangul";
import type { SyllableBlockExample } from "../../data/types";
import { Link } from "../../router";
import { SpeakButton } from "../SpeakButton";

function BlockDiagram({ ex }: { ex: SyllableBlockExample }) {
  const vowelCells =
    ex.layout === "wrap" && ex.vowelParts ? (
      <>
        <span className="cell vowel" style={{ gridArea: "v1" }}>
          {ex.vowelParts[0]}
        </span>
        <span className="cell vowel" style={{ gridArea: "v2" }}>
          {ex.vowelParts[1]}
        </span>
      </>
    ) : (
      <span className="cell vowel" style={{ gridArea: "v" }}>
        {ex.vowel}
      </span>
    );
  return (
    <div className={`block-diagram layout-${ex.layout}${ex.final ? " has-final" : ""}`} aria-hidden="true">
      <span className="cell initial" style={{ gridArea: "i" }}>
        {ex.initial}
      </span>
      {vowelCells}
      {ex.final && (
        <span className="cell final" style={{ gridArea: "f" }}>
          {ex.final}
        </span>
      )}
    </div>
  );
}

/** How letters stack into syllable blocks. `inSheet`: shown in a sheet, so no card frame of its own. */
export function SyllableBlocks({ inSheet = false }: { inSheet?: boolean }) {
  return (
    <section className={`${inSheet ? "" : "card "}syllable-blocks`} aria-labelledby="blocks-title">
      <h2 id="blocks-title">
        Building syllable blocks <span className="muted ko-sub">음절</span>
      </h2>
      <p>
        Letters are stacked into one square block per syllable: an <strong className="tag initial">initial</strong>{" "}
        consonant, a <strong className="tag vowel">vowel</strong>, and an optional{" "}
        <strong className="tag final">final</strong> consonant (받침). Tall vowels go to the right, flat vowels go
        below, and combined vowels wrap around. If there's no consonant sound at the start, the silent ㅇ fills
        the slot. <Link to="/rules#block-structure">More in Rules →</Link>
      </p>
      <ul className="block-examples">
        {SYLLABLE_BLOCK_EXAMPLES.map((ex) => (
          <li key={ex.syllable} className="block-example">
            <BlockDiagram ex={ex} />
            <div className="block-equation">
              <span lang="ko">
                {[ex.initial, ex.vowel, ex.final].filter(Boolean).join(" + ")} ={" "}
                <strong className="block-result">{ex.syllable}</strong>
              </span>
              <span className="muted">
                {ex.romanization}
                {ex.pronounced && <> · [{ex.pronounced}]</>}
              </span>
            </div>
            <SpeakButton text={ex.syllable} />
          </li>
        ))}
      </ul>
    </section>
  );
}
