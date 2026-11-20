-- Plain-language face of each grammar pattern (for learners who don't know grammar terms):
-- a short title, a one-sentence explanation, and a tiny example chunk.
ALTER TABLE grammar_patterns ADD COLUMN title TEXT NOT NULL DEFAULT '';
ALTER TABLE grammar_patterns ADD COLUMN explain TEXT NOT NULL DEFAULT '';
ALTER TABLE grammar_patterns ADD COLUMN sample TEXT NOT NULL DEFAULT '{}'; -- JSON { ko, en }
