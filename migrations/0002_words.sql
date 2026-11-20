-- The shared Common Words list (same for everyone). Loaded from data/wordSeed.json by
-- scripts/wordlist/buildSeed.ts (upserts), so it can grow without a new app release.
-- Word ids are saved in learners' progress: never change one.
CREATE TABLE words (
  id TEXT PRIMARY KEY,
  spelling TEXT NOT NULL,
  meaning TEXT NOT NULL,
  pos TEXT NOT NULL,
  category TEXT NOT NULL,
  level INTEGER NOT NULL,
  romanization TEXT NOT NULL,
  pronounced TEXT,
  rules TEXT NOT NULL DEFAULT '[]',   -- JSON array of rule ids
  letters TEXT NOT NULL DEFAULT '[]', -- JSON array of letter-note ids
  note TEXT,
  register TEXT NOT NULL DEFAULT 'neutral',
  spoken_rank INTEGER,
  -- "hand": written and checked by hand; "nikl": generated from the 국립국어원 list, then reviewed
  origin TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
