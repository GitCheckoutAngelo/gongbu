-- Grammar patterns for the Reader's Grammar practice mode (same for everyone). Loaded from
-- data/grammarPatterns.json by scripts/grammar/buildSeed.ts (upserts). Pattern ids are kept in saved
-- paragraphs: never change one.
CREATE TABLE grammar_patterns (
  id TEXT PRIMARY KEY,
  form TEXT NOT NULL,
  meaning TEXT NOT NULL,
  level INTEGER NOT NULL,
  group_id TEXT NOT NULL,
  register TEXT NOT NULL,
  attaches TEXT NOT NULL,
  examples TEXT NOT NULL DEFAULT '[]', -- JSON [{ ko, en, part }]
  similar TEXT NOT NULL DEFAULT '[]',  -- JSON [pattern id]
  note TEXT,
  sort INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
