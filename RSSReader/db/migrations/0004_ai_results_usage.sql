-- Agent settings, persisted AI outputs, and LLM usage events

CREATE TABLE IF NOT EXISTS ai_agent_settings (
  agent_type TEXT PRIMARY KEY,
  primary_model_id TEXT,
  fallback_model_id TEXT,
  config_json TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS article_summaries (
  id TEXT PRIMARY KEY,
  article_id TEXT NOT NULL,
  target_language TEXT NOT NULL,
  detail_level TEXT NOT NULL,
  content TEXT NOT NULL,
  model_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE,
  UNIQUE(article_id, target_language, detail_level)
);

CREATE INDEX IF NOT EXISTS idx_article_summaries_article_id ON article_summaries(article_id);

CREATE TABLE IF NOT EXISTS article_translation_runs (
  id TEXT PRIMARY KEY,
  article_id TEXT NOT NULL,
  target_language TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE,
  UNIQUE(article_id, target_language)
);

CREATE TABLE IF NOT EXISTS article_translation_segments (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  segment_index INTEGER NOT NULL,
  segment_tag TEXT NOT NULL,
  source_html TEXT NOT NULL,
  translated_text TEXT,
  status TEXT NOT NULL,
  FOREIGN KEY (run_id) REFERENCES article_translation_runs(id) ON DELETE CASCADE,
  UNIQUE(run_id, segment_index)
);

CREATE TABLE IF NOT EXISTS llm_usage_events (
  id TEXT PRIMARY KEY,
  task_type TEXT NOT NULL,
  article_id TEXT,
  provider_id TEXT,
  model_id TEXT,
  model_name_snapshot TEXT NOT NULL,
  base_url_snapshot TEXT NOT NULL,
  request_status TEXT NOT NULL,
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  total_tokens INTEGER,
  started_at TEXT,
  finished_at TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_llm_usage_created_at ON llm_usage_events(created_at);
CREATE INDEX IF NOT EXISTS idx_llm_usage_task_type ON llm_usage_events(task_type, created_at);
