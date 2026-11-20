"""
Spoken frequency of Korean dictionary words, from a subtitle word-form list.

Subtitle lists count each written form separately (먹었어, 먹고, 먹는 …). This splits every form into
morphemes with Kiwi and adds its count to each content word's dictionary form (먹다), giving how
often each word is *spoken*.

Input:  sources/ko_full.txt  (hermitdave/FrequencyWords, OpenSubtitles 2018, CC BY-SA 4.0): "form count"
Output: out/spoken_frequency.tsv  lemma, kiwi tag, count, rank (1 = most frequent)

Run:    scripts/wordlist/.venv/Scripts/python scripts/wordlist/spoken_frequency.py
"""
import collections
import pathlib
import sys

from kiwipiepy import Kiwi

HERE = pathlib.Path(__file__).parent
SOURCE = HERE / "sources" / "ko_full.txt"
OUT = HERE / "out" / "spoken_frequency.tsv"
MIN_COUNT = 3  # forms seen fewer times are mostly typos and names

# Content-word tags (Sejong tagset as used by Kiwi). Verbs/adjectives get 다 added.
NOUNS = {"NNG", "NNB", "NP", "NR"}
PREDICATES = {"VV", "VA", "VX"}
OTHER = {"MAG", "MAJ", "MM", "IC", "XR"}


def lemma_of(token) -> str | None:
    if token.tag in NOUNS or token.tag in OTHER:
        return token.form
    if token.tag in PREDICATES:
        return token.lemma if token.lemma.endswith("다") else token.form + "다"
    if token.tag.startswith("VV") or token.tag.startswith("VA"):  # irregular variants, e.g. VV-I
        return token.lemma if token.lemma.endswith("다") else token.form + "다"
    return None


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    forms: list[tuple[str, int]] = []
    for line in SOURCE.read_text(encoding="utf-8").splitlines():
        parts = line.rsplit(" ", 1)
        if len(parts) != 2 or not parts[1].isdigit():
            continue
        form, count = parts[0], int(parts[1])
        # Hangul words only (drop Latin, digits, punctuation-only forms).
        if count >= MIN_COUNT and form and all("가" <= ch <= "힣" for ch in form):
            forms.append((form, count))
    print(f"{len(forms)} word forms with count >= {MIN_COUNT}")

    kiwi = Kiwi()
    counts: collections.Counter[tuple[str, str]] = collections.Counter()
    for (form, count), tokens in zip(forms, kiwi.tokenize([f for f, _ in forms])):
        skip = False
        for i, token in enumerate(tokens):
            if skip:
                skip = False
                continue
            nxt = tokens[i + 1] if i + 1 < len(tokens) else None
            # A root or noun followed by 하/되 (미안 + 해 → 미안하다, 공부 + 해 → 공부하다) is one word.
            if nxt and token.tag in ("XR", "NNG") and nxt.tag.split("-")[0] in ("XSV", "XSA"):
                suffix = nxt.lemma if nxt.lemma.endswith("다") else nxt.form + "다"
                tag = "VV" if nxt.tag.startswith("XSV") else "VA"
                counts[(token.form + suffix, tag)] += count
                skip = True
                continue
            lemma = lemma_of(token)
            if lemma:
                tag = token.tag.split("-")[0]
                counts[(lemma, tag)] += count

    OUT.parent.mkdir(exist_ok=True)
    ranked = counts.most_common()
    with OUT.open("w", encoding="utf-8", newline="\n") as f:
        f.write("lemma\ttag\tcount\trank\n")
        for rank, ((lemma, tag), count) in enumerate(ranked, 1):
            f.write(f"{lemma}\t{tag}\t{count}\t{rank}\n")
    print(f"{len(ranked)} dictionary words -> {OUT}")
    print("Top 60:", ", ".join(f"{l}({t})" for (l, t), _ in ranked[:60]))


if __name__ == "__main__":
    main()
