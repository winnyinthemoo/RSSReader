use uuid::Uuid;

use crate::feeds::FeedRepository;

use super::super::error::{AiError, AiResult};
use super::super::model::{
    AgentType, ArticleSummaryRecord, GetSummaryRequest, StartSummaryRequest, SummaryStreamChunk,
};
use super::super::prompt::{
    chat_messages_from_rendered, summary_parameters, AgentPromptKind, PromptCustomization,
};
use super::super::provider::{AiProviderService, AiRepository};
use super::super::text::article_body_for_agents;

const MAX_SOURCE_CHARS: usize = 12_000;

pub struct SummaryService {
    repository: AiRepository,
}

impl SummaryService {
    pub fn new() -> AiResult<Self> {
        Ok(Self {
            repository: AiRepository::open_default()?,
        })
    }

    pub fn get_summary(&self, request: GetSummaryRequest) -> AiResult<Option<ArticleSummaryRecord>> {
        self.repository.get_summary(
            &request.article_id,
            &request.target_language,
            request.detail_level,
        )
    }

    pub fn start_summary(&self, request: StartSummaryRequest) -> AiResult<SummaryStreamChunk> {
        let feeds = FeedRepository::open_default().map_err(|error| AiError::Database(error))?;
        let article = feeds
            .get_article(&request.article_id)?
            .ok_or_else(|| AiError::NotFound(format!("Article not found: {}", request.article_id)))?;

        let source_text = truncate_for_llm(&article_body_for_agents(&article));
        if source_text.trim().is_empty() {
            return Err(AiError::InvalidInput(
                "Article has no text content for summarization".to_string(),
            ));
        }

        let parameters = summary_parameters(
            &request.target_language,
            request.detail_level,
            &source_text,
        );
        let resolved = PromptCustomization::resolve(AgentPromptKind::Summary, parameters)?;
        let messages = chat_messages_from_rendered(&resolved.rendered);

        let provider = AiProviderService::new()?;
        let (client, model_name, model_id) = provider.openai_client_for_agent(AgentType::Summary)?;
        let content = client.chat_completion(&model_name, &messages)?;

        let now = now_marker();
        let record = ArticleSummaryRecord {
            id: Uuid::new_v4().to_string(),
            article_id: request.article_id,
            target_language: request.target_language,
            detail_level: request.detail_level,
            content: content.clone(),
            model_id,
            created_at: now.clone(),
            updated_at: now,
        };
        self.repository.upsert_summary(&record)?;

        Ok(SummaryStreamChunk {
            delta: content,
            done: true,
        })
    }
}

fn truncate_for_llm(text: &str) -> String {
    if text.chars().count() <= MAX_SOURCE_CHARS {
        return text.to_string();
    }
    text.chars().take(MAX_SOURCE_CHARS).collect()
}

fn now_marker() -> String {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|duration| duration.as_secs().to_string())
        .unwrap_or_else(|_| "0".to_string())
}
