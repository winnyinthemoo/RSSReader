use std::sync::{Mutex, OnceLock};

use super::model::*;
use super::service::{agent_type_from_str, AiService};

static AI_SERVICE: OnceLock<Mutex<AiService>> = OnceLock::new();

pub fn ai_list_providers() -> Result<AiProviderListResult, String> {
    with_service(|service| service.list_providers().map_err(|e| e.into_message()))
}

pub fn ai_create_provider(request: CreateAiProviderRequest) -> Result<AiProvider, String> {
    with_service(|service| {
        service
            .create_provider(request)
            .map_err(|e| e.into_message())
    })
}

pub fn ai_update_provider(
    provider_id: String,
    request: UpdateAiProviderRequest,
) -> Result<AiProvider, String> {
    with_service(|service| {
        service
            .update_provider(&provider_id, request)
            .map_err(|e| e.into_message())
    })
}

pub fn ai_delete_provider(provider_id: String) -> Result<(), String> {
    with_service(|service| {
        service
            .delete_provider(&provider_id)
            .map_err(|e| e.into_message())
    })
}

pub fn ai_list_models() -> Result<AiModelListResult, String> {
    with_service(|service| service.list_models().map_err(|e| e.into_message()))
}

pub fn ai_create_model(request: CreateAiModelRequest) -> Result<AiModel, String> {
    with_service(|service| service.create_model(request).map_err(|e| e.into_message()))
}

pub fn ai_update_model(model_id: String, request: UpdateAiModelRequest) -> Result<AiModel, String> {
    with_service(|service| {
        service
            .update_model(&model_id, request)
            .map_err(|e| e.into_message())
    })
}

pub fn ai_delete_model(model_id: String) -> Result<(), String> {
    with_service(|service| {
        service
            .delete_model(&model_id)
            .map_err(|e| e.into_message())
    })
}

pub fn ai_test_provider(request: ProviderTestRequest) -> Result<ProviderTestResult, String> {
    with_service(|service| service.test_provider(request).map_err(|e| e.into_message()))
}

pub fn ai_get_agent_settings(agent: String) -> Result<AiAgentSettings, String> {
    with_service(|service| {
        let agent_type = agent_type_from_str(&agent).map_err(|e| e.into_message())?;
        service
            .get_agent_settings(agent_type)
            .map_err(|e| e.into_message())
    })
}

pub fn ai_update_agent_settings(settings: AiAgentSettings) -> Result<AiAgentSettings, String> {
    with_service(|service| {
        service
            .update_agent_settings(settings)
            .map_err(|e| e.into_message())
    })
}

pub fn ai_reveal_prompt(agent: String) -> Result<PromptRevealResult, String> {
    with_service(|service| {
        let agent_type = agent_type_from_str(&agent).map_err(|e| e.into_message())?;
        service
            .reveal_prompt(agent_type)
            .map_err(|e| e.into_message())
    })
}

pub fn ai_get_summary(request: GetSummaryRequest) -> Result<Option<ArticleSummaryRecord>, String> {
    with_service(|service| service.get_summary(request).map_err(|e| e.into_message()))
}

pub fn ai_start_summary(request: StartSummaryRequest) -> Result<SummaryStreamChunk, String> {
    with_service(|service| service.start_summary(request).map_err(|e| e.into_message()))
}

pub fn ai_get_translation(
    article_id: String,
    target_language: String,
) -> Result<Option<TranslationView>, String> {
    with_service(|service| {
        service
            .get_translation(&article_id, &target_language)
            .map_err(|e| e.into_message())
    })
}

pub fn ai_start_translation(request: StartTranslationRequest) -> Result<TranslationView, String> {
    with_service(|service| {
        service
            .start_translation(request)
            .map_err(|e| e.into_message())
    })
}

pub fn ai_suggest_tags(request: TaggingSuggestRequest) -> Result<TaggingSuggestResult, String> {
    with_service(|service| service.suggest_tags(request).map_err(|e| e.into_message()))
}

pub fn ai_assign_tags(request: AssignTagsRequest) -> Result<AssignTagsResult, String> {
    with_service(|service| service.assign_tags(request).map_err(|e| e.into_message()))
}

pub fn ai_usage_report(dimension: String, window_days: u32) -> Result<UsageReportResult, String> {
    with_service(|service| {
        service
            .usage_report(&dimension, window_days)
            .map_err(|e| e.into_message())
    })
}

fn with_service<T>(handler: impl FnOnce(&AiService) -> T) -> T {
    let service = AI_SERVICE
        .get_or_init(|| Mutex::new(AiService::new().expect("ai service should initialize")));
    let guard = service
        .lock()
        .expect("ai service lock should not be poisoned");
    handler(&guard)
}
