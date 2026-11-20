-- The speech levels each grammar pattern is naturally used at, so the Reader never asks for a clash
-- (e.g. -아/어 주시겠어요? between close friends).
ALTER TABLE grammar_patterns ADD COLUMN speech_levels TEXT NOT NULL DEFAULT '["casual","polite","formal"]';
