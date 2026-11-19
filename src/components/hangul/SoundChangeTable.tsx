import { useState } from "react";
import type { ChangeRow } from "../../data/soundChanges";
import { Link } from "../../router";
import { KoText } from "../KoText";
import { SpeakButton } from "../SpeakButton";

const HEADERS: Record<ChangeRow["position"], string> = {
  initial: "Previous syllable ends in…",
  final: "Next syllable starts with…",
  vowel: "Context",
};

/** Generated rows for one position; common rows first, the rest behind "Show all". */
export function SoundChangeTable({ rows, position }: { rows: ChangeRow[]; position: ChangeRow["position"] }) {
  const [expanded, setExpanded] = useState(false);
  const common = rows.filter((r) => r.frequency === 1);
  const visible = expanded || common.length === 0 ? rows : common;
  const hidden = rows.length - visible.length;

  return (
    <>
      <table className="change-table">
        <thead>
          <tr>
            <th scope="col">{HEADERS[position]}</th>
            <th scope="col">Sound becomes</th>
            <th scope="col">Example</th>
            <th scope="col">Rule</th>
          </tr>
        </thead>
        <tbody>
          {visible.map((row) => (
            <tr key={`${row.when}-${row.example.spelling}`}>
              <td className="ct-when" data-label={HEADERS[position]}>
                <KoText text={row.when} />
              </td>
              <td className="ct-becomes">
                <KoText text={row.becomes} />
                {row.note && (
                  <span className="ct-note">
                    <KoText text={row.note} />
                  </span>
                )}
              </td>
              <td className="ct-example">
                <SpeakButton text={row.example.spelling} />
                <span className="ct-example-text">
                  <span lang="ko" className="ct-word">
                    {row.example.spelling}
                    {row.example.pronounced && <span className="ct-pron"> → [{row.example.pronounced}]</span>}
                  </span>
                  <span className="ct-rom">
                    {row.example.romanization} <span className="muted">· {row.example.meaning}</span>
                  </span>
                </span>
              </td>
              <td className="ct-rule">
                {row.rule ? (
                  <Link to={`/rules#${row.rule.id}`}>{row.rule.title}</Link>
                ) : (
                  <span className="muted small">{row.reference ?? "basic sound"}</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > common.length && common.length > 0 && (
        <button type="button" className="show-all" onClick={() => setExpanded((v) => !v)} aria-expanded={expanded}>
          {expanded ? "Show fewer" : `Show all (${hidden} less common)`}
        </button>
      )}
    </>
  );
}
