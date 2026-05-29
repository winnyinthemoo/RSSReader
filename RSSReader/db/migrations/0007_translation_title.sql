-- Store translated article titles alongside translation runs.

ALTER TABLE article_translation_runs ADD COLUMN translated_title TEXT;
