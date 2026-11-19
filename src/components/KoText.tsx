const HANGUL_RUN = /([ᄀ-ᇿ㄰-㆏가-힣]+)/;

/**
 * Renders English prose with any Hangul runs wrapped in a Korean-font chip.
 * Without this, a lone jamo like ㅣ in a sentence looks like a stray "|" character.
 */
export function KoText({ text }: { text: string }) {
  return (
    <>
      {text.split(HANGUL_RUN).map((part, i) =>
        i % 2 === 1 ? (
          <span key={i} lang="ko" className="ko-inline">
            {part}
          </span>
        ) : (
          part
        ),
      )}
    </>
  );
}
