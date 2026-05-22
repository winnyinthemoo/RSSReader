use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AgentType {
    Summary,
    Translation,
    Tagging,
}

impl AgentType {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Summary => "summary",
            Self::Translation => "translation",
            Self::Tagging => "tagging",
        }
    }

    pub fn parse(value: &str) -> Option<Self> {
        match value {
            "summary" => Some(Self::Summary),
            "translation" => Some(Self::Translation),
            "tagging" => Some(Self::Tagging),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SummaryDetailLevel {
    Short,
    Medium,
    Detailed,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TranslationPromptStrategy {
    Standard,
    #[serde(rename = "hy_mt_optimized")]
    HyMtOptimized,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiProvider {
    pub id: String,
    pub display_name: String,
    pub base_url: String,
    pub is_enabled: bool,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiModel {
    pub id: String,
    pub provider_id: String,
    pub model_name: String,
    pub is_enabled: bool,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiProviderListResult {
    pub providers: Vec<AiProvider>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiModelListResult {
    pub models: Vec<AiModel>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateAiProviderRequest {
    pub display_name: String,
    pub base_url: String,
    pub api_key: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateAiProviderRequest {
    pub display_name: Option<String>,
    pub base_url: Option<String>,
    pub api_key: Option<String>,
    pub is_enabled: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateAiModelRequest {
    pub provider_id: String,
    pub model_name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateAiModelRequest {
    pub model_name: Option<String>,
    pub is_enabled: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderTestRequest {
    pub provider_id: Option<String>,
    pub base_url: Option<String>,
    pub api_key: Option<String>,
    pub model_name: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::{ProviderTestRequest, StartSummaryRequest, SummaryDetailLevel};

    #[test]
    fn provider_test_request_accepts_camel_case_json() {
        let request: ProviderTestRequest =
            serde_json::from_str(r#"{"providerId":"p1","modelName":"deepseek-chat"}"#).unwrap();
        assert_eq!(request.provider_id.as_deref(), Some("p1"));
        assert_eq!(request.model_name.as_deref(), Some("deepseek-chat"));
        assert!(request.base_url.is_none());
    }

    #[test]
    fn start_summary_request_accepts_camel_case_json() {
        let request: StartSummaryRequest = serde_json::from_str(
            r#"{"articleId":"a1","targetLanguage":"zh-Hans","detailLevel":"medium"}"#,
        )
        .unwrap();
        assert_eq!(request.article_id, "a1");
        assert_eq!(request.target_language, "zh-Hans");
        assert_eq!(request.detail_level, SummaryDetailLevel::Medium);
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderTestResult {
    pub ok: bool,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SummaryAgentConfig {
    pub default_target_language: String,
    pub default_detail_level: SummaryDetailLevel,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TranslationAgentConfig {
    pub default_target_language: String,
    pub concurrency: u8,
    pub prompt_strategy: TranslationPromptStrategy,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaggingAgentConfig {}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiAgentSettings {
    pub agent_type: AgentType,
    pub primary_model_id: Option<String>,
    pub fallback_model_id: Option<String>,
    pub summary: Option<SummaryAgentConfig>,
    pub translation: Option<TranslationAgentConfig>,
    pub tagging: Option<TaggingAgentConfig>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ArticleSummaryRecord {
    pub id: String,
    pub article_id: String,
    pub target_language: String,
    pub detail_level: SummaryDetailLevel,
    pub content: String,
    pub model_id: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GetSummaryRequest {
    pub article_id: String,
    pub target_language: String,
    pub detail_level: SummaryDetailLevel,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StartSummaryRequest {
    pub article_id: String,
    pub target_language: String,
    pub detail_level: SummaryDetailLevel,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SummaryStreamChunk {
    pub delta: String,
    pub done: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TranslationSegmentView {
    pub id: String,
    pub segment_index: i32,
    pub segment_tag: String,
    pub source_html: String,
    pub translated_text: Option<String>,
    pub status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TranslationView {
    pub run_id: String,
    pub article_id: String,
    pub target_language: String,
    pub status: String,
    pub segments: Vec<TranslationSegmentView>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StartTranslationRequest {
    pub article_id: String,
    pub target_language: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaggingSuggestRequest {
    pub article_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaggingSuggestResult {
    pub tags: Vec<String>,
    pub fallback_notice: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AssignTagsRequest {
    pub article_id: String,
    pub tags: Vec<String>,
    pub source: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UsageReportRequest {
    pub dimension: String,
    pub window_days: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UsageReportRow {
    pub key: String,
    pub label: String,
    pub request_count: u64,
    pub total_tokens: u64,
    pub succeeded_count: u64,
    pub failed_count: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UsageReportResult {
    pub dimension: String,
    pub window_days: u32,
    pub rows: Vec<UsageReportRow>,
    pub total_requests: u64,
    pub total_tokens: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PromptRevealResult {
    pub path: String,
    pub created: bool,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct AgentSettingsRecord {
    pub primary_model_id: Option<String>,
    pub fallback_model_id: Option<String>,
    pub config: Value,
}
