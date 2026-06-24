use super::super::client::openai_compat::ChatUsage;
use super::super::error::AiResult;
use super::super::model::{AgentType, UsageCleanupResult, UsageEventRecord, UsageReportResult};
use super::super::provider::AiRepository;

pub struct UsageService {
    repository: AiRepository,
}

pub struct UsageRecordInput<'a> {
    pub agent_type: AgentType,
    pub article_id: Option<&'a str>,
    pub provider_id: Option<&'a str>,
    pub model_id: Option<&'a str>,
    pub model_name: &'a str,
    pub base_url: &'a str,
    pub request_status: &'a str,
    pub usage: Option<&'a ChatUsage>,
    pub started_at: &'a str,
    pub finished_at: &'a str,
}

pub fn record_llm_usage(input: UsageRecordInput<'_>) {
    let Ok(repository) = AiRepository::open_default() else {
        return;
    };
    let event = UsageEventRecord {
        id: uuid::Uuid::new_v4().to_string(),
        task_type: input.agent_type.as_str().to_string(),
        article_id: input.article_id.map(ToString::to_string),
        provider_id: input.provider_id.map(ToString::to_string),
        model_id: input.model_id.map(ToString::to_string),
        model_name_snapshot: input.model_name.to_string(),
        base_url_snapshot: input.base_url.to_string(),
        request_status: input.request_status.to_string(),
        prompt_tokens: input.usage.and_then(|usage| usage.prompt_tokens),
        completion_tokens: input.usage.and_then(|usage| usage.completion_tokens),
        total_tokens: input.usage.and_then(|usage| usage.total_tokens),
        started_at: input.started_at.to_string(),
        finished_at: input.finished_at.to_string(),
        created_at: input.finished_at.to_string(),
    };
    let _ = repository.insert_usage_event(&event);
}

impl UsageService {
    pub fn new() -> AiResult<Self> {
        Ok(Self {
            repository: AiRepository::open_default()?,
        })
    }

    pub fn report(
        &self,
        dimension: &str,
        window_days: u32,
        key: Option<&str>,
    ) -> AiResult<UsageReportResult> {
        let window_days = window_days.max(1);
        let rows = self.repository.usage_report(dimension, window_days, key)?;
        let daily_rows = self
            .repository
            .usage_daily_report(dimension, window_days, key)?;
        let total_requests = rows.iter().map(|row| row.request_count).sum();
        let total_tokens = rows.iter().map(|row| row.total_tokens).sum();
        Ok(UsageReportResult {
            dimension: dimension.to_string(),
            window_days,
            key: key.map(ToString::to_string),
            rows,
            daily_rows,
            total_requests,
            total_tokens,
        })
    }

    pub fn clear_expired(&self, retention_days: u32) -> AiResult<UsageCleanupResult> {
        let deleted_count = self
            .repository
            .delete_usage_older_than_days(retention_days.max(1))?;
        Ok(UsageCleanupResult { deleted_count })
    }

    pub fn clear_all(&self) -> AiResult<UsageCleanupResult> {
        let deleted_count = self.repository.delete_all_usage_events()?;
        Ok(UsageCleanupResult { deleted_count })
    }
}
