# Word list pipeline

Builds the next Common Words from two sources, ranked by how often each word is spoken, with entries
written by Claude and checked by the same pronunciation checks as every word in the list.

The list itself is `data/wordSeed.json`: the one source of every Common Word. Edit hand-written words
there directly; generated words come from the steps below.

## Sources and credit

- **국립국어원 「한국어 학습용 어휘 목록」 (2003)**: 5,965 learner words graded A/B/C. National Institute of
  Korean Language, used under 공공누리 (KOGL) Type 1: credit the source. Download the text file from
  <https://www.korean.go.kr/front_eng/down/down_02V.do?etc_seq=70> into `sources/nikl.txt`.
- **Spoken frequency**: hermitdave/FrequencyWords, OpenSubtitles 2018 Korean (`content/2018/ko/ko_full.txt`),
  licensed **CC BY-SA 4.0**. Data derived from it (the spoken ranks) carries the same licence and credit.
  Into `sources/ko_full.txt`.

Caveats: Korean subtitles are mostly translations of English-language films and series, so the ranks lean
toward drama vocabulary, and the analyser sometimes credits a short noun with forms of another word
(볼 from 볼 수 있다). Such words are held back in `corrections.json`.

## Steps

```bash
# once: Python environment with Kiwi (Korean morphological analyser, used only here)
python -m venv scripts/wordlist/.venv
scripts/wordlist/.venv/Scripts/pip install kiwipiepy

# 1. Spoken frequency by dictionary form (먹었어, 먹고 → 먹다): out/spoken_frequency.tsv
scripts/wordlist/.venv/Scripts/python scripts/wordlist/spoken_frequency.py
# 2. All candidates ranked by speech, marking words already in the list: out/candidates.json
scripts/wordlist/.venv/Scripts/python scripts/wordlist/merge_candidates.py
# 3. Claude writes entries for the next N words (resumable; prints the cost): out/enriched.json
npx vite-node --config vitest.config.ts scripts/wordlist/enrich.ts -- --limit 300
# 4. Checks (pronunciation, clashing or ambiguous meanings) with corrections.json applied: out/review.tsv
npx vite-node --config vitest.config.ts scripts/wordlist/check.ts
# 5. Add or refresh the generated words in data/wordSeed.json (and regenerate romanization and
#    spoken ranks for every word); also writes out/words.sql (upserts)
npx vite-node --config vitest.config.ts scripts/wordlist/buildSeed.ts
npm test
# 6. Load it (new migrations first: npx wrangler d1 migrations apply gongbu --local / --remote)
npx wrangler d1 execute gongbu --local  --file scripts/wordlist/out/words.sql
npx wrangler d1 execute gongbu --remote --file scripts/wordlist/out/words.sql
```

The app reads the list from `GET /api/words`, so loading new words into the database updates every
learner without a new release. Word ids are kept in
learners' progress: `buildSeed.ts` reuses each word's id on every rebuild, so never edit ids by hand.

`out/` and `sources/` are not committed (generated or downloaded). `corrections.json` is: it records every
hand fix and every held-back word, with the reason.

Cost so far: 300 words for $0.45 with Claude Sonnet 5.5 (about $1.50 per 1,000 words), plus $0.13 to tag
the built-in words' register.
