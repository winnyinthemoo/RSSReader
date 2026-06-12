# Database

SQLite schema and migrations for RSSReader.

## Migrations

| File | Description |
|------|-------------|
| `0001_create_feeds_and_articles.sql` | Feeds and articles (MVP) |
| `0002_ai_providers_models.sql` | AI provider and model profiles |
| `0003_tags.sql` | Tags and article-tag relations |
| `0004_ai_results_usage.sql` | Agent settings, summaries, translations, usage events |

Migrations run in order on application startup via `backend/src/database/mod.rs`.

## Notes

- API keys are **not** stored in SQLite. They are saved in the OS credential store via `keyring` (`backend/src/ai/secrets.rs`, service `com.rssreader.vortex`). Legacy plaintext `secrets/*.key` files are migrated on first access.
- AI persisted outputs live in `article_summaries`, `article_translation_*`, and `llm_usage_events`.
