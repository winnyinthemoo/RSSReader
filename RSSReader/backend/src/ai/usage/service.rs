use super::super::error::AiResult;
use super::super::model::UsageReportResult;
use super::super::provider::AiRepository;

pub struct UsageService {
    repository: AiRepository,
}

impl UsageService {
    pub fn new() -> AiResult<Self> {
        Ok(Self {
            repository: AiRepository::open_default()?,
        })
    }

    pub fn report(&self, dimension: &str, window_days: u32) -> AiResult<UsageReportResult> {
        let rows = self.repository.usage_report(dimension, window_days)?;
        let total_requests = rows.iter().map(|row| row.request_count).sum();
        let total_tokens = rows.iter().map(|row| row.total_tokens).sum();
        Ok(UsageReportResult {
            dimension: dimension.to_string(),
            window_days,
            rows,
            total_requests,
            total_tokens,
        })
    }
}
