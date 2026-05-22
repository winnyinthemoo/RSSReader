use uuid::Uuid;

use crate::feeds::FeedRepository;

use super::super::client::openai_compat::OpenAiCompatClient;
use super::super::error::{AiError, AiResult};
use super::super::model::{
    AgentType, StartTranslationRequest, TranslationPromptStrategy, TranslationSegmentView,
    TranslationView,
};
use super::super::prompt::{
    chat_messages_from_rendered, translation_parameters, AgentPromptKind, PromptCustomization,
    PromptResolver,
};
use super::super::provider::{AiProviderService, AiRepository};
use super::super::text::{sanitize_translation_output, strip_html_tags};
use super::segmentation::{HtmlSegment, Segmenter};

pub struct TranslationService {
    repository: AiRepository,
}

impl TranslationService {
    pub fn new() -> AiResult<Self> {
        Ok(Self {
            repository: AiRepository::open_default()?,
        })
    }

    pub fn get_translation(
        &self,
        article_id: &str,
        target_language: &str,
    ) -> AiResult<Option<TranslationView>> {
        self.repository.get_translation(article_id, target_language)
    }

    pub fn start_translation(&self, request: StartTranslationRequest) -> AiResult<TranslationView> {
        let feeds = FeedRepository::open_default().map_err(|error| AiError::Database(error))?;
        let article = feeds
            .get_article(&request.article_id)?
            .ok_or_else(|| AiError::NotFound(format!("Article not found: {}", request.article_id)))?;

        let segments = Segmenter::from_html(&article.sanitized_html);
        if segments.is_empty() {
            return Err(AiError::InvalidInput(
                "Article has no translatable p/ul/ol segments".to_string(),
            ));
        }

        let provider = AiProviderService::new()?;
        let settings = provider.get_agent_settings(AgentType::Translation)?;
        let strategy = settings
            .translation
            .map(|value| value.prompt_strategy)
            .unwrap_or(TranslationPromptStrategy::Standard);
        let kind = PromptResolver::for_agent(AgentType::Translation, strategy);
        let (client, model_name, _model_id) = provider.openai_client_for_agent(AgentType::Translation)?;

        let now = now_marker();
        let run_id = Uuid::new_v4().to_string();
        self.repository.delete_translation_run(
            &request.article_id,
            &request.target_language,
        )?;
        self.repository.insert_translation_run(
            &run_id,
            &request.article_id,
            &request.target_language,
            "running",
            &now,
        )?;

        let mut views = Vec::new();
        let mut previous_plain: Option<String> = None;
        let mut failed_count = 0usize;

        for segment in &segments {
            let segment_result =
                translate_segment(&client, &model_name, kind, &request.target_language, segment, previous_plain.as_deref());
            let (translated_text, status) = match segment_result {
                Ok(text) => (Some(text), "succeeded"),
                Err(error) => {
                    failed_count += 1;
                    (Some(format!("[Translation failed: {error}]")), "failed")
                }
            };

            let segment_id = Uuid::new_v4().to_string();
            self.repository.insert_translation_segment(
                &segment_id,
                &run_id,
                segment.index as i32,
                &segment.tag,
                &segment.source_html,
                translated_text.as_deref(),
                status,
            )?;

            views.push(TranslationSegmentView {
                id: segment_id,
                segment_index: segment.index as i32,
                segment_tag: segment.tag.clone(),
                source_html: segment.source_html.clone(),
                translated_text,
                status: status.to_string(),
            });

            previous_plain = Some(strip_html_tags(&segment.source_html));
        }

        let run_status = if failed_count == 0 {
            "completed"
        } else if failed_count < segments.len() {
            "partial"
        } else {
            "failed"
        };
        let finished_at = now_marker();
        self.repository
            .update_translation_run_status(&run_id, run_status, &finished_at)?;

        Ok(TranslationView {
            run_id,
            article_id: request.article_id,
            target_language: request.target_language,
            status: run_status.to_string(),
            segments: views,
        })
    }

    pub fn retry_segment(&self, _segment_id: &str) -> AiResult<TranslationView> {
        Err(AiError::NotImplemented("translation segment retry"))
    }
}

fn translate_segment(
    client: &OpenAiCompatClient,
    model_name: &str,
    kind: AgentPromptKind,
    target_language: &str,
    segment: &HtmlSegment,
    previous_plain: Option<&str>,
) -> AiResult<String> {
    let source_plain = strip_html_tags(&segment.source_html);
    let parameters = translation_parameters(
        target_language,
        &source_plain,
        previous_plain,
    );
    let resolved = PromptCustomization::resolve(kind, parameters)?;
    let messages = chat_messages_from_rendered(&resolved.rendered);
    let raw = client.chat_completion(model_name, &messages)?;
    Ok(sanitize_translation_output(raw.trim()))
}

fn now_marker() -> String {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|duration| duration.as_secs().to_string())
        .unwrap_or_else(|_| "0".to_string())
}
