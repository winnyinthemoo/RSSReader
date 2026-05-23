CREATE TABLE IF NOT EXISTS article_notes (
  article_id TEXT PRIMARY KEY,
  content TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE
);
