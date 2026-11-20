-- Gongbu's user data. There are no accounts: each browser makes a random sync key, and every row
-- belongs to one key ("owner").

-- Common Words progress: one JSON document per owner (the same shape as a backup file's "progress").
CREATE TABLE progress (
  owner TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Reader paragraphs the learner chose to keep.
CREATE TABLE saved_paragraphs (
  id TEXT PRIMARY KEY,
  owner TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  difficulty TEXT NOT NULL,
  length TEXT NOT NULL,
  topic TEXT NOT NULL DEFAULT '',
  -- The first words, for the list (so listing doesn't read every full paragraph).
  preview TEXT NOT NULL,
  -- The full paragraph as shown in the Reader (paragraph, translation, sentences, words).
  data TEXT NOT NULL
);

CREATE INDEX saved_paragraphs_owner ON saved_paragraphs (owner, created_at DESC);
