# Grammar patterns

The Reader's **Grammar practice** mode writes a text around one pattern (-(으)ㄹ까요?, -아서/어서…), in a
setting and at a politeness level the learner picks. The patterns are in `data/grammarPatterns.json`
(224 practice items for TOPIK 1-4, in 12 "what you want to say" groups; 75 near-variants are merged into
families, listed on their item's card), loaded into the database and served by `GET /api/grammar`.

## How the list was made

The 국립국어원 standard curriculum (국제 통용 한국어 표준 교육과정) lists about 224 grammar items for levels
1-4, but not as a downloadable file. So the list was compiled with Claude, using that curriculum and the
major textbooks as the checklist:

```bash
# 1. For each meaning group, every TOPIK 1-4 pattern (resumable)      → out/inventory.json
GRAMMAR_STEP=inventory npx vite-node --config vitest.config.ts scripts/grammar/buildPatterns.ts
# 2. The standard syllabus picked from that (duplicates merged)        → out/curated.json
GRAMMAR_STEP=curate npx vite-node --config vitest.config.ts scripts/grammar/buildPatterns.ts
# 3. A card per pattern: how it attaches, two examples, similar ones   → out/cards.json
GRAMMAR_STEP=cards npx vite-node --config vitest.config.ts scripts/grammar/buildPatterns.ts
# 4. A plain-language face per pattern for learners who don't know grammar terms: a title
#    ("by, using, towards"), one sentence, and a tiny example (버스로 = by bus)   → out/plain.json
GRAMMAR_STEP=plain npx vite-node --config vitest.config.ts scripts/grammar/buildPatterns.ts
# 5. Families and groups: near-variants merge into one practice item (N부터 N까지 → N에서 N까지), and every
#    item gets a "what you want to say" group                         → out/families.json
GRAMMAR_STEP=families npx vite-node --config vitest.config.ts scripts/grammar/buildPatterns.ts
# 6. Speech levels each pattern is naturally used at (-아/어 주시겠어요? only polite/formal, -자 casual):
#    the Reader greys out the others                                    → out/levels.json
GRAMMAR_STEP=levels npx vite-node --config vitest.config.ts scripts/grammar/buildPatterns.ts
# 7. Check every card (corrections.json applied) and write the list   → data/grammarPatterns.json, out/grammar.sql
npx vite-node --config vitest.config.ts scripts/grammar/buildSeed.ts
npm test
# 8. Load it (new migrations first: npx wrangler d1 migrations apply gongbu --local / --remote)
npx wrangler d1 execute gongbu --local  --file scripts/grammar/out/grammar.sql
npx wrangler d1 execute gongbu --remote --file scripts/grammar/out/grammar.sql
```

Checks (`check.ts`, also run by `grammar.test.ts`): the form is in textbook notation, each example is Korean
with a translation, the marked part of each example really is in the sentence, levels, groups and registers
are valid, "similar" links point at real patterns, and the plain title and explanation use no grammar terms. Hand fixes go in `corrections.json` (create it),
keyed by `form|group`, like the word list's.

Pattern ids are kept: `buildSeed.ts` reuses each item's id on every rebuild, and a merged variant's old id
stays as an alias of its family (the server finds it by either). `corrections.json` can override a family
with `"mergeInto"` (a key, or `null` to keep a pattern on its own).

Cost: $2.14 with Claude Sonnet 5.5 (inventory $0.28, curation $0.18, cards $1.18, plain $0.30, families $0.08,
levels $0.12).

## Ready-made conversations

Grammar practice opens **ready-made conversations**: about four per pattern, written once and checked, so
they appear instantly and read naturally. **Your own situation** is the only part Claude writes on the spot.

```bash
# 1. Real situations, 8 per setting (who A and B are, the speech levels, the kind of talk)  → data/scenarios.json
npx vite-node --config vitest.config.ts scripts/grammar/buildScenarios.ts
# 2. Per pattern, Claude writes a conversation in each of ~4 situations that suit it (resumable;
#    GRAMMAR_LIMIT=5 for a trial; GRAMMAR_MODEL to change model)        → out/conversations.json
npx vite-node --config vitest.config.ts scripts/grammar/buildConversations.ts
# 3. Check them and build the library (romanization, glosses, highlights)  → data/grammarConversations.json
npx vite-node --config vitest.config.ts scripts/grammar/buildLibrary.ts
npm test
# 4. Load it
npx wrangler d1 execute gongbu --local  --file scripts/grammar/out/conversations.sql   (and --remote)
```

Situations are picked per pattern: ones where its kind of talk comes up (a "shall we…?" pattern gets a
planning situation), at speech levels it's used at, one per level where possible, all in different settings.
Each conversation must use the pattern at least twice, have both speakers, a translation per line and glosses
for its words (`conversationProblems` in buildLibrary.ts); anything that fails is left out.

Cost: scenarios $0.35; conversations about $15 for all 224 patterns with Claude Sonnet 5.5 (Haiku 5.5 would
be about $1.20 and slightly plainer; the library is written once).

## Your own situation

`POST /api/generate` with `grammar: { pattern, setting, politeness }`: Claude writes a new conversation
(`worker/services/paragraph/providers/claude.ts`): real speakers in that situation, the pattern only where a
native speaker would use it, its ending adapted to the speech level (-(으)ㄹ까요? → -(으)ㄹ까? when casual),
and the scene and roles back for display. A speech level the pattern isn't used at moves to one it is.
