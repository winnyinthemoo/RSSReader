use crate::feeds::FeedRepository;

use super::super::error::{AiError, AiResult};
use super::super::model::{
    AgentType, AssignTagsRequest, AssignTagsResult, TaggingSuggestRequest, TaggingSuggestResult,
};
use super::super::prompt::{
    chat_messages_from_rendered, tagging_parameters, AgentPromptKind, PromptCustomization,
};
use super::super::provider::{AiProviderService, AiRepository};
use super::super::text::article_body_for_agents;
use super::super::usage::{record_llm_usage, UsageRecordInput};
use super::normalize::normalize_tag_name;

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
        let article = feeds.get_article(&request.article_id)?.ok_or_else(|| {
            AiError::NotFound(format!("Article not found: {}", request.article_id))
        })?;

        let existing_tags = self.repository.list_tag_names()?;
        let existing_tags_json =
            serde_json::to_string(&existing_tags).unwrap_or_else(|_| "[]".to_string());
        let body = article_body_for_agents(&article);
        let parameters = tagging_parameters(&article.title, &body, &existing_tags_json);
        let resolved = PromptCustomization::resolve(AgentPromptKind::Tagging, parameters)?;
        let messages = chat_messages_from_rendered(&resolved.rendered);

        let provider = AiProviderService::new()?;
        let route = provider.openai_agent_client(AgentType::Tagging)?;
        let started_at = now_marker();
        let completion = route
            .client
            .chat_completion_with_usage(&route.model_name, &messages);
        let finished_at = now_marker();
        let raw = match completion {
            Ok(completion) => {
                record_llm_usage(UsageRecordInput {
                    agent_type: AgentType::Tagging,
                    article_id: Some(&request.article_id),
                    provider_id: route.provider_id.as_deref(),
                    model_id: route.model_id.as_deref(),
                    model_name: &route.model_name,
                    base_url: &route.base_url,
                    request_status: "succeeded",
                    usage: completion.usage.as_ref(),
                    started_at: &started_at,
                    finished_at: &finished_at,
                });
                completion.content
            }
            Err(error) => {
                record_llm_usage(UsageRecordInput {
                    agent_type: AgentType::Tagging,
                    article_id: Some(&request.article_id),
                    provider_id: route.provider_id.as_deref(),
                    model_id: route.model_id.as_deref(),
                    model_name: &route.model_name,
                    base_url: &route.base_url,
                    request_status: "failed",
                    usage: None,
                    started_at: &started_at,
                    finished_at: &finished_at,
                });
                return Err(error);
            }
        };
        let tags = normalize_tag_suggestions(parse_tag_array(&raw)?);

        Ok(TaggingSuggestResult {
            tags,
            fallback_notice: resolved.fallback_notice,
        })
    }

    pub fn assign_tags(&self, request: AssignTagsRequest) -> AiResult<AssignTagsResult> {
        if request.tags.is_empty() {
            return Ok(list_article_tags(&request.article_id)?);
        }
        let now = now_marker();
        for tag in normalize_tag_suggestions(request.tags) {
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
        list_article_tags(&request.article_id)
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

fn normalize_tag_suggestions(tags: Vec<String>) -> Vec<String> {
    let mut normalized_tags = Vec::new();
    let mut seen = std::collections::HashSet::new();

    for tag in tags {
        let display = tag.trim();
        if display.is_empty() || display.chars().count() > 40 {
            continue;
        }
        if !display.chars().all(|ch| {
            ch.is_alphanumeric() || ch.is_whitespace() || matches!(ch, '-' | '_' | '&' | '/')
        }) {
            continue;
        }

        let normalized = normalize_tag_name(display);
        if normalized.is_empty() || !seen.insert(normalized) {
            continue;
        }

        normalized_tags.push(display.to_string());
        if normalized_tags.len() >= 5 {
            break;
        }
    }

    normalized_tags
}

fn list_article_tags(article_id: &str) -> AiResult<AssignTagsResult> {
    let feeds = FeedRepository::open_default().map_err(|error| AiError::Database(error))?;
    Ok(AssignTagsResult {
        tags: feeds.list_article_tags(article_id)?,
    })
}

fn now_marker() -> String {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|duration| duration.as_secs().to_string())
        .unwrap_or_else(|_| "0".to_string())
}
