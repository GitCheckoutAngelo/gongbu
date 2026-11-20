"""
Combine the word sources into one candidate list, ranked by how often each word is spoken.

Inputs:
  sources/nikl.txt              국립국어원 「한국어 학습용 어휘 목록」 (2003; KOGL Type 1: credit the source).
                                5,965 words graded A/B/C, with homograph numbers (가구03, 가구04).
  out/spoken_frequency.tsv      from spoken_frequency.py (subtitles; CC BY-SA 4.0).
  ../../data/wordSeed.json      the current Common Words list.

Outputs:
  out/candidates.json           every learner-list word, with spoken count/rank and whether the app has it.
  out/spoken_only.tsv           frequently spoken words that aren't in the learner list (colloquial forms,
                                contractions, slang-ish words): candidates for a hand-reviewed casual set.

Run: scripts/wordlist/.venv/Scripts/python scripts/wordlist/merge_candidates.py
"""
import collections
import json
import pathlib
import re
import sys

HERE = pathlib.Path(__file__).parent
OUT = HERE / "out"

# 국립국어원 part-of-speech codes → the app's part of speech, and which Kiwi tags count as the same word.
NOMINAL = {"NNG", "NNB", "NP", "NR"}
PREDICATE = {"VV", "VA", "VX"}
POS = {
    "명": ("noun", NOMINAL),
    "의": ("noun", NOMINAL),  # bound noun (것, 수, 개): some are counters, decided per word later
    "대": ("pronoun", NOMINAL),
    "수": ("numeral", NOMINAL),
    "동": ("verb", PREDICATE),
    "형": ("adjective", PREDICATE),
    "보": ("verb", PREDICATE),  # auxiliary verb/adjective (싶다, 보다)
    "부": ("adverb", {"MAG", "MAJ"}),
    "관": ("determiner", {"MM"}),
    "감": ("interjection", {"IC"}),
    "고": ("noun", set()),  # proper nouns (place names): not counted by the spoken script
    "불": ("expression", NOMINAL),  # unclassified contractions such as 걔 (그 아이)
}
GRADE_LEVEL = {"A": "beginner", "B": "intermediate", "C": "advanced"}


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")

    spoken: dict[tuple[str, str], int] = {}
    for line in (OUT / "spoken_frequency.tsv").read_text(encoding="utf-8").splitlines()[1:]:
        lemma, tag, count, _ = line.split("\t")
        spoken[(lemma, tag)] = int(count)

    def spoken_count(spelling: str, tags: set[str]) -> int:
        return sum(spoken.get((spelling, t), 0) for t in tags)

    built_in = json.loads((HERE.parent.parent / "data" / "wordSeed.json").read_text(encoding="utf-8"))
    built_in_keys = {(w["spelling"], w["pos"]) for w in built_in}
    built_in_spellings = {w["spelling"] for w in built_in}

    raw = (HERE / "sources" / "nikl.txt").read_bytes().decode("cp949")
    candidates = []
    for line in raw.splitlines()[2:]:
        cols = line.split("\t")
        if len(cols) < 5 or not cols[1]:
            continue
        written_rank, word, code, gloss, grade = cols[:5]
        m = re.fullmatch(r"(.+?)(\d{2})?", word)
        spelling, homograph = m.group(1), m.group(2)
        pos, tags = POS[code]
        candidates.append(
            {
                "spelling": spelling,
                "homograph": int(homograph) if homograph else None,
                "pos": pos,
                "niklPos": code,
                "gloss": gloss,
                "grade": grade,
                "band": GRADE_LEVEL[grade],
                "writtenRank": int(written_rank) if written_rank.isdigit() else None,
                "spokenCount": spoken_count(spelling, tags),
                "builtIn": (spelling, pos) in built_in_keys or spelling in built_in_spellings,
            }
        )

    # Homographs (가구 "household" / 가구 "furniture") share one spoken count: speech can't tell them apart.
    by_key = collections.Counter((c["spelling"], c["pos"]) for c in candidates)
    for c in candidates:
        c["spokenShared"] = by_key[(c["spelling"], c["pos"])] > 1

    candidates.sort(key=lambda c: (-c["spokenCount"], c["writtenRank"] or 10**9))
    for rank, c in enumerate(candidates, 1):
        c["spokenRank"] = rank if c["spokenCount"] > 0 else None

    (OUT / "candidates.json").write_text(json.dumps(candidates, ensure_ascii=False, indent=1), encoding="utf-8")

    # Frequently spoken words missing from the learner list.
    covered = {(c["spelling"], t) for c in candidates for t in POS[c["niklPos"]][1]}
    with (OUT / "spoken_only.tsv").open("w", encoding="utf-8", newline="\n") as f:
        f.write("lemma\ttag\tcount\n")
        n = 0
        for line in (OUT / "spoken_frequency.tsv").read_text(encoding="utf-8").splitlines()[1:]:
            lemma, tag, count, _ = line.split("\t")
            if (lemma, tag) not in covered and lemma not in built_in_spellings and len(lemma) > 1:
                f.write(f"{lemma}\t{tag}\t{count}\n")
                n += 1
                if n >= 600:
                    break

    new = [c for c in candidates if not c["builtIn"]]
    print(f"{len(candidates)} learner-list words; {len(candidates) - len(new)} already built in; {len(new)} new")
    print(f"never heard in the subtitles: {sum(c['spokenCount'] == 0 for c in candidates)}")
    print("Top 40 new by speech:", ", ".join(f"{c['spelling']}({c['grade']})" for c in new[:40]))
    unmatched = [w["spelling"] for w in built_in if not any(c["spelling"] == w["spelling"] for c in candidates)]
    print(f"built-in words not in the learner list: {len(unmatched)}, e.g. {', '.join(unmatched[:25])}")


if __name__ == "__main__":
    main()
