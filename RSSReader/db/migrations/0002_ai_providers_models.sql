-- AI providers and models (API keys stored outside SQLite; see backend secrets module)

CREATE TABLE IF NOT EXISTS ai_providers (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  base_url TEXT NOT NULL,
  is_enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_providers_base_url ON ai_providers(base_url);

CREATE TABLE IF NOT EXISTS ai_models (
  id TEXT PRIMARY KEY,
  provider_id TEXT NOT NULL,
  model_name TEXT NOT NULL,
  is_enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (provider_id) REFERENCES ai_providers(id) ON DELETE CASCADE,
  UNIQUE(provider_id, model_name)
);

CREATE INDEX IF NOT EXISTS idx_ai_models_provider_id ON ai_models(provider_id);
