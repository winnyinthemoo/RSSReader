use uuid::Uuid;

use crate::feeds::FeedRepository;

use super::super::error::{AiError, AiResult};
use super::super::model::{
    AgentType, StartTranslationRequest, TranslationPromptStrategy, TranslationSegmentView,
    TranslationView,
};
use super::super::prompt::{
    chat_messages_from_rendered, translation_parameters, AgentPromptKind, PromptCustomization,
    PromptResolver,
};
use super::super::provider::{AgentClient, AiProviderService, AiRepository};
use super::super::text::{sanitize_translation_output, strip_html_tags};
use super::super::usage::{record_llm_usage, UsageRecordInput};
use super::segmentation::{HtmlSegment, Segmenter};

struct BilingualBuild {
    html: String,
    aligned: bool,
    placed: usize,
    expected: usize,
}

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
        let Some(mut translation) = self
            .repository
            .get_translation(article_id, target_language)?
        else {
            return Ok(None);
        };
        let feeds = FeedRepository::open_default().map_err(|error| AiError::Database(error))?;
        if let Some(article) = feeds.get_article(article_id)? {
            let built = build_bilingual_html(&article.sanitized_html, &translation.segments);
            translation.bilingual_html = Some(built.html);
            translation.bilingual_aligned = built.aligned;
            translation.bilingual_placed = built.placed;
            translation.bilingual_expected = built.expected;
        }
        Ok(Some(translation))
    }

    pub fn start_translation(&self, request: StartTranslationRequest) -> AiResult<TranslationView> {
        self.translate_article(request, |_| {})
    }

    pub fn stream_translation(
        &self,
        request: StartTranslationRequest,
        emit: impl FnMut(&TranslationView),
    ) -> AiResult<TranslationView> {
        self.translate_article(request, emit)
    }

    fn translate_article(
        &self,
        request: StartTranslationRequest,
        mut emit: impl FnMut(&TranslationView),
    ) -> AiResult<TranslationView> {
        let feeds = FeedRepository::open_default().map_err(|error| AiError::Database(error))?;
        let article = feeds.get_article(&request.article_id)?.ok_or_else(|| {
            AiError::NotFound(format!("Article not found: {}", request.article_id))
        })?;

        let provider = AiProviderService::new()?;
        let settings = provider.get_agent_settings(AgentType::Translation)?;
        let strategy = settings
            .translation
            .map(|value| value.prompt_strategy)
            .unwrap_or(TranslationPromptStrategy::Standard);
        let kind = PromptResolver::for_agent(AgentType::Translation, strategy);
        let route = provider.openai_agent_client(AgentType::Translation)?;

        if let Some(selected_text) = request
            .selected_text
            .as_deref()
            .map(str::trim)
            .filter(|text| !text.is_empty())
        {
            let view = translate_selection(
                &route,
                &request.article_id,
                kind,
                &request.target_language,
                selected_text,
            )?;
            emit(&view);
            return Ok(view);
        }

        let segments = Segmenter::from_html(&article.sanitized_html);
        if segments.is_empty() {
            return Err(AiError::InvalidInput(
                "Article has no translatable text segments".to_string(),
            ));
        }

        let translated_title = translate_text(
            &route,
            &request.article_id,
            kind,
            &request.target_language,
            &article.title,
            None,
        )
        .ok()
        .filter(|title| !title.trim().is_empty());

        let now = now_marker();
        let run_id = Uuid::new_v4().to_string();
        self.repository
            .delete_translation_run(&request.article_id, &request.target_language)?;
        self.repository.insert_translation_run(
            &run_id,
            &request.article_id,
            &request.target_language,
            translated_title.as_deref(),
            "running",
            &now,
        )?;

        let mut views = Vec::new();
        let mut previous_plain: Option<String> = None;
        let mut failed_count = 0usize;

        let initial_view = build_translation_view(
            &article.sanitized_html,
            &request.article_id,
            &request.target_language,
            &run_id,
            translated_title.clone(),
            "running",
            &views,
        );
        emit(&initial_view);

        for segment in &segments {
            let segment_result = translate_segment(
                &route,
                &request.article_id,
                kind,
                &request.target_language,
                segment,
                previous_plain.as_deref(),
            );
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

            let partial_view = build_translation_view(
                &article.sanitized_html,
                &request.article_id,
                &request.target_language,
                &run_id,
                translated_title.clone(),
                "running",
                &views,
            );
            emit(&partial_view);

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

        let final_view = build_translation_view(
            &article.sanitized_html,
            &request.article_id,
            &request.target_language,
            &run_id,
            translated_title,
            run_status,
            &views,
        );
        emit(&final_view);

        Ok(final_view)
    }

}

fn translate_selection(
    route: &AgentClient,
    article_id: &str,
    kind: AgentPromptKind,
    target_language: &str,
    selected_text: &str,
) -> AiResult<TranslationView> {
    let translated_text = translate_text(
        route,
        article_id,
        kind,
        target_language,
        selected_text,
        None,
    )?;
    let segment = TranslationSegmentView {
        id: Uuid::new_v4().to_string(),
        segment_index: 0,
        segment_tag: "selection".to_string(),
        source_html: selected_text.to_string(),
        translated_text: Some(translated_text.clone()),
        status: "succeeded".to_string(),
    };

    Ok(TranslationView {
        run_id: format!("selection-{}", Uuid::new_v4()),
        article_id: article_id.to_string(),
        target_language: target_language.to_string(),
        translated_title: None,
        status: "selection".to_string(),
        bilingual_html: Some(format!(
            "<div class=\"translation-selection\"><p>{}</p><div class=\"translation-block\" data-segment-index=\"0\">{}</div></div>",
            escape_html(selected_text),
            escape_html(&translated_text)
        )),
        bilingual_aligned: true,
        bilingual_placed: 1,
        bilingual_expected: 1,
        segments: vec![segment],
    })
}

fn build_bilingual_html(article_html: &str, segments: &[TranslationSegmentView]) -> BilingualBuild {
    let html_segments = Segmenter::from_html(article_html);
    let mut ordered = segments.to_vec();
    ordered.sort_by_key(|segment| segment.segment_index);

    if html_segments.is_empty() || ordered.is_empty() {
        return BilingualBuild {
            html: article_html.to_string(),
            aligned: html_segments.len() == ordered.len(),
            placed: 0,
            expected: ordered.len(),
        };
    }

    let mut result = String::with_capacity(article_html.len());
    let mut cursor = 0usize;
    let mut placed = 0usize;

    for (html_segment, translation_segment) in html_segments.iter().zip(ordered.iter()) {
        if html_segment.start < cursor || html_segment.end > article_html.len() {
            continue;
        }

        result.push_str(&article_html[cursor..html_segment.end]);
        if let Some(display_text) = translation_segment
            .translated_text
            .as_deref()
            .map(sanitize_translation_output)
            .filter(|text| !text.trim().is_empty())
        {
            result.push_str("<div class=\"translation-block\" data-segment-index=\"");
            result.push_str(&translation_segment.segment_index.to_string());
            result.push_str("\">");
            result.push_str(&escape_html(&display_text));
            result.push_str("</div>");
            placed += 1;
        }
        cursor = html_segment.end;
    }

    result.push_str(&article_html[cursor..]);

    BilingualBuild {
        html: result,
        aligned: placed == ordered.len(),
        placed,
        expected: ordered.len(),
    }
}

fn build_translation_view(
    article_html: &str,
    article_id: &str,
    target_language: &str,
    run_id: &str,
    translated_title: Option<String>,
    status: &str,
    segments: &[TranslationSegmentView],
) -> TranslationView {
    let built = build_bilingual_html(article_html, segments);
    TranslationView {
        run_id: run_id.to_string(),
        article_id: article_id.to_string(),
        target_language: target_language.to_string(),
        translated_title,
        status: status.to_string(),
        bilingual_html: Some(built.html),
        bilingual_aligned: built.aligned,
        bilingual_placed: built.placed,
        bilingual_expected: built.expected,
        segments: segments.to_vec(),
    }
}

fn escape_html(text: &str) -> String {
    let mut escaped = String::with_capacity(text.len());
    for character in text.chars() {
        match character {
            '&' => escaped.push_str("&amp;"),
            '<' => escaped.push_str("&lt;"),
            '>' => escaped.push_str("&gt;"),
            '"' => escaped.push_str("&quot;"),
            '\'' => escaped.push_str("&#39;"),
            _ => escaped.push(character),
        }
    }
    escaped
}

fn translate_segment(
    route: &AgentClient,
    article_id: &str,
    kind: AgentPromptKind,
    target_language: &str,
    segment: &HtmlSegment,
    previous_plain: Option<&str>,
) -> AiResult<String> {
    let source_plain = strip_html_tags(&segment.source_html);
    translate_text(
        route,
        article_id,
        kind,
        target_language,
        &source_plain,
        previous_plain,
    )
}

fn translate_text(
    route: &AgentClient,
    article_id: &str,
    kind: AgentPromptKind,
    target_language: &str,
    source_plain: &str,
    previous_plain: Option<&str>,
) -> AiResult<String> {
    let parameters = translation_parameters(target_language, source_plain, previous_plain);
    let resolved = PromptCustomization::resolve(kind, parameters)?;
    let messages = chat_messages_from_rendered(&resolved.rendered);
    let started_at = now_marker();
    let completion = route
        .client
        .chat_completion_with_usage(&route.model_name, &messages);
    let finished_at = now_marker();
    let completion = match completion {
        Ok(completion) => {
            record_llm_usage(UsageRecordInput {
                agent_type: AgentType::Translation,
                article_id: Some(article_id),
                provider_id: route.provider_id.as_deref(),
                model_id: route.model_id.as_deref(),
                model_name: &route.model_name,
                base_url: &route.base_url,
                request_status: "succeeded",
                usage: completion.usage.as_ref(),
                started_at: &started_at,
                finished_at: &finished_at,
            });
            completion
        }
        Err(error) => {
            record_llm_usage(UsageRecordInput {
                agent_type: AgentType::Translation,
                article_id: Some(article_id),
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
    let raw = completion.content;
    Ok(sanitize_translation_output(raw.trim()))
}

fn now_marker() -> String {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|duration| duration.as_secs().to_string())
        .unwrap_or_else(|_| "0".to_string())
}
