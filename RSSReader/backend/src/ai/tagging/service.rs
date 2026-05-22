use crate::feeds::FeedRepository;

use super::normalize::normalize_tag_name;
use super::super::error::{AiError, AiResult};
use super::super::model::{AgentType, AssignTagsRequest, TaggingSuggestRequest, TaggingSuggestResult};
use super::super::prompt::{
    chat_messages_from_rendered, tagging_parameters, AgentPromptKind, PromptCustomization,
};
use super::super::provider::{AiProviderService, AiRepository};
use super::super::text::article_body_for_agents;

pub struct TaggingService {
    repository: AiRepository,
}

impl TaggingService {
    pub fn new() -> AiResult<Self> {
        Ok(Self {
            repository: AiRepository::open_default()?,
        })
    }

    pub fn suggest(&self, request: TaggingSuggestRequest) -> AiResult<TaggingSuggestResult> {
        let feeds = FeedRepository::open_default().map_err(|error| AiError::Database(error))?;
        let article = feeds
            .get_article(&request.article_id)?
            .ok_or_else(|| AiError::NotFound(format!("Article not found: {}", request.article_id)))?;

        let existing_tags = self.repository.list_tag_names()?;
        let existing_tags_json =
            serde_json::to_string(&existing_tags).unwrap_or_else(|_| "[]".to_string());
        let body = article_body_for_agents(&article);
        let parameters = tagging_parameters(&article.title, &body, &existing_tags_json);
        let resolved = PromptCustomization::resolve(AgentPromptKind::Tagging, parameters)?;
        let messages = chat_messages_from_rendered(&resolved.rendered);

        let provider = AiProviderService::new()?;
        let (client, model_name, _) = provider.openai_client_for_agent(AgentType::Tagging)?;
        let raw = client.chat_completion(&model_name, &messages)?;
        let tags = parse_tag_array(&raw)?;

        Ok(TaggingSuggestResult {
            tags,
            fallback_notice: resolved.fallback_notice,
        })
    }

    pub fn assign_tags(&self, request: AssignTagsRequest) -> AiResult<()> {
        if request.tags.is_empty() {
            return Ok(());
        }
        let now = now_marker();
        for tag in &request.tags {
            let display = tag.trim();
            if display.is_empty() {
                continue;
            }
            let normalized = normalize_tag_name(display);
            if normalized.is_empty() {
                continue;
            }
            self.repository.assign_tag(
                &request.article_id,
                display,
                &normalized,
                &request.source,
                &now,
            )?;
        }
        Ok(())
    }
}

fn parse_tag_array(raw: &str) -> AiResult<Vec<String>> {
    let trimmed = raw.trim();
    let json_slice = if trimmed.starts_with('[') {
        trimmed
    } else if let (Some(start), Some(end)) = (trimmed.find('['), trimmed.rfind(']')) {
        &trimmed[start..=end]
    } else {
        return Err(AiError::LlmRequest(
            "Tagging model did not return a JSON array".to_string(),
        ));
    };

    let tags: Vec<String> = serde_json::from_str(json_slice)
        .map_err(|error| AiError::LlmRequest(format!("Invalid tagging JSON: {error}")))?;
    Ok(tags
        .into_iter()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .collect())
}

fn now_marker() -> String {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|duration| duration.as_secs().to_string())
        .unwrap_or_else(|_| "0".to_string())
}
