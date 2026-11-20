import type { CommonWord } from "../../data/vocabularyMeta";
import { ruleById } from "../../data/rules";
import { LETTER_NOTES } from "../../data/vocabularyMeta";
import { Link } from "../../router";
import { RuleTag } from "./RuleTag";

/** Short labels for compact tags (full titles are on the rule cards). */
const SHORT_LABELS: Record<string, string> = {
  "block-structure": "blocks",
  "final-sounds": "final sound",
  "double-finals": "double final",
  linking: "linking",
  nasalization: "nasal",
  liquidization: "ㄹ assim.",
  tensification: "tense",
  aspiration: "aspirated",
  palatalization: "palatal",
  "h-dropping": "ㅎ drop",
  ui: "ㅢ vowel",
  ye: "ㅖ vowel",
};

/** Small tinted tags, one color per rule; hover or tap one for a summary of the rule. */
export function WordTags({ word, links = true }: { word: CommonWord; links?: boolean }) {
  const ids = [...(word.rules ?? []), ...(word.letters ?? [])];
  if (ids.length === 0) return null;
  return (
    <span className="word-tags">
      {ids.map((id) => (
        <RuleTag key={id} id={id} label={SHORT_LABELS[id] ?? id} showMore={links} word={word} />
      ))}
    </span>
  );
}

/** "[학꾜] · Tensification": the pronounced form with links to the rules that explain it. */
export function WordPronunciation({ word }: { word: CommonWord }) {
  if (!word.pronounced) return null;
  return (
    <span className="word-pron">
      <span className="word-pron-form" lang="ko" title="Pronounced">
        [{word.pronounced.split("/").join(" / ")}]
      </span>
      {(word.rules ?? []).map((id) => {
        const rule = ruleById(id);
        return (
          rule && (
            <Link key={id} to={`/rules#${id}`} className="rule-chip">
              {rule.title}
            </Link>
          )
        );
      })}
      {(word.letters ?? []).map((id) => (
        <Link key={id} to={`/hangul#${id}`} className="rule-chip" title={LETTER_NOTES[id].summary}>
          <span lang="ko">{LETTER_NOTES[id].char}</span> vowel note
        </Link>
      ))}
    </span>
  );
}
