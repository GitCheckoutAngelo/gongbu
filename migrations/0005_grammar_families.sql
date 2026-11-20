-- Grammar families: near-variants merged into one practice item, listed on its card, and their old ids
-- kept so an earlier choice still finds the item.
ALTER TABLE grammar_patterns ADD COLUMN variants TEXT NOT NULL DEFAULT '[]'; -- JSON [{ form, title }]
ALTER TABLE grammar_patterns ADD COLUMN aliases TEXT NOT NULL DEFAULT '[]';  -- JSON [old pattern id]
