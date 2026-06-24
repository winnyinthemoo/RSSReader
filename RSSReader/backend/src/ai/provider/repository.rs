use std::time::Duration;

use rusqlite::{params, Connection, OptionalExtension};

use crate::database::run_migrations;

use super::super::error::{AiError, AiResult};
use super::super::model::{
    AgentSettingsRecord, AgentType, AiModel, AiProvider, ArticleSummaryRecord, SummaryDetailLevel,
    TranslationSegmentView, TranslationView, UsageDailyRow, UsageEventRecord, UsageReportRow,
};

pub struct AiRepository {
    connection: Connection,
}

impl AiRepository {
    pub fn open_default() -> AiResult<Self> {
        let path = default_database_path()?;
        let connection = Connection::open(path).map_err(|e| e.to_string())?;
        Self::from_connection(connection)
    }

    pub fn from_connection(connection: Connection) -> AiResult<Self> {
        connection.busy_timeout(Duration::from_secs(5))?;
        connection.execute_batch("PRAGMA foreign_keys = ON;")?;
        run_migrations(&connection).map_err(AiError::Database)?;
        Ok(Self { connection })
    }

    pub fn list_providers(&self) -> AiResult<Vec<AiProvider>> {
        let mut stmt = self.connection.prepare(
            "SELECT id, display_name, base_url, is_enabled, created_at, updated_at
             FROM ai_providers ORDER BY display_name COLLATE NOCASE",
        )?;
        let rows = stmt.query_map([], |row| {
            Ok(AiProvider {
                id: row.get(0)?,
                display_name: row.get(1)?,
                base_url: row.get(2)?,
                api_key_hint: None,
                is_enabled: row.get::<_, i64>(3)? != 0,
                created_at: row.get(4)?,
                updated_at: row.get(5)?,
            })
        })?;
        Ok(rows.collect::<Result<Vec<_>, _>>()?)
    }

    pub fn get_provider(&self, id: &str) -> AiResult<Option<AiProvider>> {
        self.connection
            .query_row(
                "SELECT id, display_name, base_url, is_enabled, created_at, updated_at
                 FROM ai_providers WHERE id = ?1",
                params![id],
                |row| {
                    Ok(AiProvider {
                        id: row.get(0)?,
                        display_name: row.get(1)?,
                        base_url: row.get(2)?,
                        api_key_hint: None,
                        is_enabled: row.get::<_, i64>(3)? != 0,
                        created_at: row.get(4)?,
                        updated_at: row.get(5)?,
                    })
                },
            )
            .optional()
            .map_err(Into::into)
    }

    pub fn insert_provider(&self, provider: &AiProvider) -> AiResult<()> {
        self.connection.execute(
            "INSERT INTO ai_providers (id, display_name, base_url, is_enabled, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![
                provider.id,
                provider.display_name,
                provider.base_url,
                provider.is_enabled as i64,
                provider.created_at,
                provider.updated_at,
            ],
        )?;
        Ok(())
    }

    pub fn update_provider(&self, provider: &AiProvider) -> AiResult<()> {
        self.connection.execute(
            "UPDATE ai_providers SET display_name = ?2, base_url = ?3, is_enabled = ?4, updated_at = ?5
             WHERE id = ?1",
            params![
                provider.id,
                provider.display_name,
                provider.base_url,
                provider.is_enabled as i64,
                provider.updated_at,
            ],
        )?;
        Ok(())
    }

    pub fn delete_provider(&self, id: &str) -> AiResult<()> {
        self.connection
            .execute("DELETE FROM ai_providers WHERE id = ?1", params![id])?;
        Ok(())
    }

    pub fn list_models(&self) -> AiResult<Vec<AiModel>> {
        let mut stmt = self.connection.prepare(
            "SELECT id, provider_id, model_name, is_enabled, created_at, updated_at
             FROM ai_models ORDER BY model_name COLLATE NOCASE",
        )?;
        let rows = stmt.query_map([], |row| {
            Ok(AiModel {
                id: row.get(0)?,
                provider_id: row.get(1)?,
                model_name: row.get(2)?,
                is_enabled: row.get::<_, i64>(3)? != 0,
                created_at: row.get(4)?,
                updated_at: row.get(5)?,
            })
        })?;
        Ok(rows.collect::<Result<Vec<_>, _>>()?)
    }

    pub fn get_model(&self, id: &str) -> AiResult<Option<AiModel>> {
        self.connection
            .query_row(
                "SELECT id, provider_id, model_name, is_enabled, created_at, updated_at
                 FROM ai_models WHERE id = ?1",
                params![id],
                |row| {
                    Ok(AiModel {
                        id: row.get(0)?,
                        provider_id: row.get(1)?,
                        model_name: row.get(2)?,
                        is_enabled: row.get::<_, i64>(3)? != 0,
                        created_at: row.get(4)?,
                        updated_at: row.get(5)?,
                    })
                },
            )
            .optional()
            .map_err(Into::into)
    }

    pub fn insert_model(&self, model: &AiModel) -> AiResult<()> {
        self.connection.execute(
            "INSERT INTO ai_models (id, provider_id, model_name, is_enabled, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![
                model.id,
                model.provider_id,
                model.model_name,
                model.is_enabled as i64,
                model.created_at,
                model.updated_at,
            ],
        )?;
        Ok(())
    }

    pub fn update_model(&self, model: &AiModel) -> AiResult<()> {
        self.connection.execute(
            "UPDATE ai_models SET model_name = ?2, is_enabled = ?3, updated_at = ?4 WHERE id = ?1",
            params![
                model.id,
                model.model_name,
                model.is_enabled as i64,
                model.updated_at,
            ],
        )?;
        Ok(())
    }

    pub fn delete_model(&self, id: &str) -> AiResult<()> {
        self.connection
            .execute("DELETE FROM ai_models WHERE id = ?1", params![id])?;
        Ok(())
    }

    pub fn get_agent_settings(&self, agent_type: AgentType) -> AiResult<AgentSettingsRecord> {
        let record = self
            .connection
            .query_row(
                "SELECT primary_model_id, fallback_model_id, config_json FROM ai_agent_settings WHERE agent_type = ?1",
                params![agent_type.as_str()],
                |row| {
                    let config_json: String = row.get(2)?;
                    let config = serde_json::from_str(&config_json).unwrap_or(serde_json::json!({}));
                    Ok(AgentSettingsRecord {
                        primary_model_id: row.get(0)?,
                        fallback_model_id: row.get(1)?,
                        config,
                    })
                },
            )
            .optional()?
            .unwrap_or_default();
        Ok(record)
    }

    pub fn upsert_agent_settings(
        &self,
        agent_type: AgentType,
        record: &AgentSettingsRecord,
        updated_at: &str,
    ) -> AiResult<()> {
        let config_json =
            serde_json::to_string(&record.config).map_err(|e| AiError::Database(e.to_string()))?;
        self.connection.execute(
            "INSERT INTO ai_agent_settings (agent_type, primary_model_id, fallback_model_id, config_json, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5)
             ON CONFLICT(agent_type) DO UPDATE SET
               primary_model_id = excluded.primary_model_id,
               fallback_model_id = excluded.fallback_model_id,
               config_json = excluded.config_json,
               updated_at = excluded.updated_at",
            params![
                agent_type.as_str(),
                record.primary_model_id,
                record.fallback_model_id,
                config_json,
                updated_at,
            ],
        )?;
        Ok(())
    }

    pub fn get_summary(
        &self,
        article_id: &str,
        target_language: &str,
        detail_level: SummaryDetailLevel,
    ) -> AiResult<Option<ArticleSummaryRecord>> {
        let level = detail_level_to_str(detail_level);
        self.connection
            .query_row(
                "SELECT id, article_id, target_language, detail_level, content, model_id, created_at, updated_at
                 FROM article_summaries
                 WHERE article_id = ?1 AND target_language = ?2 AND detail_level = ?3",
                params![article_id, target_language, level],
                |row| {
                    Ok(ArticleSummaryRecord {
                        id: row.get(0)?,
                        article_id: row.get(1)?,
                        target_language: row.get(2)?,
                        detail_level: parse_detail_level(row.get::<_, String>(3)?),
                        content: row.get(4)?,
                        model_id: row.get(5)?,
                        created_at: row.get(6)?,
                        updated_at: row.get(7)?,
                    })
                },
            )
            .optional()
            .map_err(Into::into)
    }

    pub fn usage_report(
        &self,
        dimension: &str,
        window_days: u32,
        key: Option<&str>,
    ) -> AiResult<Vec<UsageReportRow>> {
        let group_expr = usage_dimension_expr(dimension);
        let sql = format!(
            "SELECT
                COALESCE({group_expr}, 'unknown') AS usage_key,
                COALESCE({group_expr}, 'Unknown') AS usage_label,
                COUNT(*) AS request_count,
                COALESCE(SUM(total_tokens), 0) AS total_tokens,
                SUM(CASE WHEN request_status = 'succeeded' THEN 1 ELSE 0 END) AS succeeded_count,
                SUM(CASE WHEN request_status = 'failed' THEN 1 ELSE 0 END) AS failed_count
             FROM llm_usage_events
             WHERE CAST(created_at AS INTEGER) >= CAST(strftime('%s', 'now', ?1) AS INTEGER)
                AND (?2 IS NULL OR COALESCE({group_expr}, 'unknown') = ?2)
             GROUP BY usage_key, usage_label
             ORDER BY request_count DESC, usage_label COLLATE NOCASE"
        );
        let window = format!("-{} days", window_days.saturating_sub(1));
        let mut stmt = self.connection.prepare(&sql)?;
        let rows = stmt.query_map(params![window, key], |row| {
            Ok(UsageReportRow {
                key: row.get(0)?,
                label: row.get(1)?,
                request_count: row.get::<_, i64>(2)?.max(0) as u64,
                total_tokens: row.get::<_, i64>(3)?.max(0) as u64,
                succeeded_count: row.get::<_, i64>(4)?.max(0) as u64,
                failed_count: row.get::<_, i64>(5)?.max(0) as u64,
            })
        })?;
        Ok(rows.collect::<Result<Vec<_>, _>>()?)
    }

    pub fn usage_daily_report(
        &self,
        dimension: &str,
        window_days: u32,
        key: Option<&str>,
    ) -> AiResult<Vec<UsageDailyRow>> {
        let window = format!("-{} days", window_days.saturating_sub(1));
        let group_expr = usage_dimension_expr_with_alias(dimension, "events");
        let sql = format!(
            "WITH RECURSIVE days(day, remaining) AS (
                SELECT date('now', ?1), ?2
                UNION ALL
                SELECT date(day, '+1 day'), remaining - 1 FROM days WHERE remaining > 1
             )
             SELECT
                days.day,
                COALESCE(COUNT(events.id), 0) AS request_count,
                COALESCE(SUM(events.total_tokens), 0) AS total_tokens
             FROM days
             LEFT JOIN llm_usage_events events
                ON date(events.created_at, 'unixepoch') = days.day
                AND (?3 IS NULL OR COALESCE({group_expr}, 'unknown') = ?3)
             GROUP BY days.day
             ORDER BY days.day"
        );
        let mut stmt = self.connection.prepare(&sql)?;
        let rows = stmt.query_map(params![window, window_days.max(1), key], |row| {
            Ok(UsageDailyRow {
                date: row.get(0)?,
                request_count: row.get::<_, i64>(1)?.max(0) as u64,
                total_tokens: row.get::<_, i64>(2)?.max(0) as u64,
            })
        })?;
        Ok(rows.collect::<Result<Vec<_>, _>>()?)
    }

    pub fn insert_usage_event(&self, event: &UsageEventRecord) -> AiResult<()> {
        self.connection.execute(
            "INSERT INTO llm_usage_events (
                id, task_type, article_id, provider_id, model_id, model_name_snapshot,
                base_url_snapshot, request_status, prompt_tokens, completion_tokens,
                total_tokens, started_at, finished_at, created_at
             ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)",
            params![
                event.id,
                event.task_type,
                event.article_id,
                event.provider_id,
                event.model_id,
                event.model_name_snapshot,
                event.base_url_snapshot,
                event.request_status,
                event.prompt_tokens,
                event.completion_tokens,
                event.total_tokens,
                event.started_at,
                event.finished_at,
                event.created_at,
            ],
        )?;
        Ok(())
    }

    pub fn delete_usage_older_than_days(&self, retention_days: u32) -> AiResult<u64> {
        let window = format!("-{} days", retention_days.saturating_sub(1));
        let deleted = self.connection.execute(
            "DELETE FROM llm_usage_events
             WHERE CAST(created_at AS INTEGER) < CAST(strftime('%s', 'now', ?1) AS INTEGER)",
            params![window],
        )?;
        Ok(deleted as u64)
    }

    pub fn delete_all_usage_events(&self) -> AiResult<u64> {
        let deleted = self
            .connection
            .execute("DELETE FROM llm_usage_events", [])?;
        Ok(deleted as u64)
    }

    pub fn list_tag_names(&self) -> AiResult<Vec<String>> {
        let mut stmt = self
            .connection
            .prepare("SELECT name FROM tags ORDER BY usage_count DESC, name COLLATE NOCASE")?;
        let rows = stmt.query_map([], |row| row.get(0))?;
        Ok(rows.collect::<Result<Vec<_>, _>>()?)
    }

    pub fn upsert_summary(&self, summary: &ArticleSummaryRecord) -> AiResult<()> {
        let level = detail_level_to_str(summary.detail_level);
        self.connection.execute(
            "INSERT INTO article_summaries (
                id, article_id, target_language, detail_level, content, model_id, created_at, updated_at
             ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
             ON CONFLICT(article_id, target_language, detail_level) DO UPDATE SET
               content = excluded.content,
               model_id = excluded.model_id,
               updated_at = excluded.updated_at",
            params![
                summary.id,
                summary.article_id,
                summary.target_language,
                level,
                summary.content,
                summary.model_id,
                summary.created_at,
                summary.updated_at,
            ],
        )?;
        Ok(())
    }

    pub fn assign_tag(
        &self,
        article_id: &str,
        display_name: &str,
        normalized_name: &str,
        source: &str,
        now: &str,
    ) -> AiResult<()> {
        let tag_id: String = if let Some(existing) = self
            .connection
            .query_row(
                "SELECT id FROM tags WHERE normalized_name = ?1",
                params![normalized_name],
                |row| row.get(0),
            )
            .optional()?
        {
            existing
        } else {
            let id = uuid::Uuid::new_v4().to_string();
            self.connection.execute(
                "INSERT INTO tags (id, name, normalized_name, usage_count, created_at)
                 VALUES (?1, ?2, ?3, 0, ?4)",
                params![id, display_name, normalized_name, now],
            )?;
            id
        };

        let inserted = self.connection.execute(
            "INSERT OR IGNORE INTO article_tags (article_id, tag_id, source, created_at)
             VALUES (?1, ?2, ?3, ?4)",
            params![article_id, tag_id, source, now],
        )?;

        if inserted > 0 {
            self.connection.execute(
                "UPDATE tags SET usage_count = usage_count + 1 WHERE id = ?1",
                params![tag_id],
            )?;
        }

        Ok(())
    }

    pub fn delete_translation_run(&self, article_id: &str, target_language: &str) -> AiResult<()> {
        self.connection.execute(
            "DELETE FROM article_translation_runs WHERE article_id = ?1 AND target_language = ?2",
            params![article_id, target_language],
        )?;
        Ok(())
    }

    pub fn insert_translation_run(
        &self,
        run_id: &str,
        article_id: &str,
        target_language: &str,
        translated_title: Option<&str>,
        status: &str,
        now: &str,
    ) -> AiResult<()> {
        self.connection.execute(
            "INSERT INTO article_translation_runs (
                id, article_id, target_language, translated_title, status, created_at, updated_at
             ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                run_id,
                article_id,
                target_language,
                translated_title,
                status,
                now,
                now
            ],
        )?;
        Ok(())
    }

    pub fn update_translation_run_status(
        &self,
        run_id: &str,
        status: &str,
        now: &str,
    ) -> AiResult<()> {
        self.connection.execute(
            "UPDATE article_translation_runs SET status = ?1, updated_at = ?2 WHERE id = ?3",
            params![status, now, run_id],
        )?;
        Ok(())
    }

    pub fn insert_translation_segment(
        &self,
        id: &str,
        run_id: &str,
        segment_index: i32,
        segment_tag: &str,
        source_html: &str,
        translated_text: Option<&str>,
        status: &str,
    ) -> AiResult<()> {
        self.connection.execute(
            "INSERT INTO article_translation_segments (
                id, run_id, segment_index, segment_tag, source_html, translated_text, status
             ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                id,
                run_id,
                segment_index,
                segment_tag,
                source_html,
                translated_text,
                status
            ],
        )?;
        Ok(())
    }

    pub fn update_translation_segment(
        &self,
        run_id: &str,
        segment_index: i32,
        translated_text: Option<&str>,
        status: &str,
    ) -> AiResult<()> {
        let updated = self.connection.execute(
            "UPDATE article_translation_segments
             SET translated_text = ?3, status = ?4
             WHERE run_id = ?1 AND segment_index = ?2",
            params![run_id, segment_index, translated_text, status],
        )?;
        if updated == 0 {
            return Err(AiError::NotFound(format!(
                "Translation segment not found: {run_id}#{segment_index}"
            )));
        }
        Ok(())
    }
    pub fn get_translation(
        &self,
        article_id: &str,
        target_language: &str,
    ) -> AiResult<Option<TranslationView>> {
        let run = self
            .connection
            .query_row(
                "SELECT id, article_id, target_language, translated_title, status
                 FROM article_translation_runs
                 WHERE article_id = ?1 AND target_language = ?2",
                params![article_id, target_language],
                |row| {
                    Ok((
                        row.get::<_, String>(0)?,
                        row.get::<_, String>(1)?,
                        row.get::<_, String>(2)?,
                        row.get::<_, Option<String>>(3)?,
                        row.get::<_, String>(4)?,
                    ))
                },
            )
            .optional()?;

        let Some((run_id, article_id, target_language, translated_title, status)) = run else {
            return Ok(None);
        };

        let mut stmt = self.connection.prepare(
            "SELECT id, segment_index, segment_tag, source_html, translated_text, status
             FROM article_translation_segments
             WHERE run_id = ?1
             ORDER BY segment_index ASC",
        )?;
        let segments = stmt
            .query_map(params![run_id], |row| {
                Ok(TranslationSegmentView {
                    id: row.get(0)?,
                    segment_index: row.get(1)?,
                    segment_tag: row.get(2)?,
                    source_html: row.get(3)?,
                    translated_text: row.get(4)?,
                    status: row.get(5)?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;

        Ok(Some(TranslationView {
            run_id,
            article_id,
            target_language,
            translated_title,
            status,
            bilingual_html: None,
            bilingual_aligned: false,
            bilingual_placed: 0,
            bilingual_expected: segments.len(),
            segments,
        }))
    }
}

fn detail_level_to_str(level: SummaryDetailLevel) -> &'static str {
    match level {
        SummaryDetailLevel::Short => "short",
        SummaryDetailLevel::Medium => "medium",
        SummaryDetailLevel::Detailed => "detailed",
    }
}

fn parse_detail_level(value: String) -> SummaryDetailLevel {
    match value.as_str() {
        "short" => SummaryDetailLevel::Short,
        "detailed" => SummaryDetailLevel::Detailed,
        _ => SummaryDetailLevel::Medium,
    }
}

fn usage_dimension_expr(dimension: &str) -> &'static str {
    match dimension {
        "provider" => "provider_id",
        "model" => "COALESCE(model_id, model_name_snapshot)",
        "agent" => "task_type",
        _ => "task_type",
    }
}

fn usage_dimension_expr_with_alias(dimension: &str, alias: &str) -> String {
    match dimension {
        "provider" => format!("{alias}.provider_id"),
        "model" => format!("COALESCE({alias}.model_id, {alias}.model_name_snapshot)"),
        "agent" => format!("{alias}.task_type"),
        _ => format!("{alias}.task_type"),
    }
}

fn default_database_path() -> AiResult<String> {
    if let Ok(path) = std::env::var("RSSREADER_DB_PATH") {
        return Ok(path);
    }
    let mut path = std::env::current_dir().map_err(|error| AiError::Database(error.to_string()))?;
    path.push("vortex.sqlite3");
    Ok(path.to_string_lossy().to_string())
}
