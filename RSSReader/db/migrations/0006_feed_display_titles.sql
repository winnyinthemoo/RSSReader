ALTER TABLE feeds ADD COLUMN source_title TEXT;
ALTER TABLE feeds ADD COLUMN custom_title TEXT;

UPDATE feeds
SET
  source_title = title,
  custom_title = title
WHERE source_title IS NULL
  AND custom_title IS NULL;
