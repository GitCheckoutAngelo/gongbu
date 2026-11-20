-- Ready-made grammar practice conversations (about four per pattern, each in a real situation), loaded from
-- data/grammarConversations.json by scripts/grammar/buildLibrary.ts. "Your own situation" is still written
-- by Claude on the spot.
CREATE TABLE grammar_conversations (
  id TEXT PRIMARY KEY,
  pattern_id TEXT NOT NULL,
  politeness TEXT NOT NULL,
  data TEXT NOT NULL, -- JSON: the Reader's paragraph shape (words, sentences, highlights, practice)
  sort INTEGER NOT NULL
);

CREATE INDEX grammar_conversations_pattern ON grammar_conversations (pattern_id, sort);
