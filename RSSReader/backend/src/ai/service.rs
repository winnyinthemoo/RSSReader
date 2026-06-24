use super::error::{AiError, AiResult};
use super::model::TranslationPromptStrategy;
use super::model::*;
use super::prompt::{AgentPromptKind, PromptCustomization, PromptResolver};
use super::provider::AiProviderService;
use super::summary::SummaryService;
use super::tagging::TaggingService;
use super::translation::TranslationService;
use super::usage::UsageService;
use super::AgentType;

pub struct AiService {
    provider: AiProviderService,
    summary: SummaryService,
    translation: TranslationService,
    tagging: TaggingService,
    usage: UsageService,
}

impl AiService {
    pub fn new() -> AiResult<Self> {
        Ok(Self {
            provider: AiProviderService::new()?,
            summary: SummaryService::new()?,
            translation: TranslationService::new()?,
            tagging: TaggingService::new()?,
            usage: UsageService::new()?,
        })
    }

    pub fn list_providers(&self) -> AiResult<AiProviderListResult> {
        self.provider.list_providers()
    }

    pub fn create_provider(&self, request: CreateAiProviderRequest) -> AiResult<AiProvider> {
        self.provider.create_provider(request)
    }

    pub fn update_provider(
        &self,
        provider_id: &str,
        request: UpdateAiProviderRequest,
    ) -> AiResult<AiProvider> {
        self.provider.update_provider(provider_id, request)
    }

    pub fn delete_provider(&self, provider_id: &str) -> AiResult<()> {
        self.provider.delete_provider(provider_id)
    }

    pub fn list_models(&self) -> AiResult<AiModelListResult> {
        self.provider.list_models()
    }

    pub fn create_model(&self, request: CreateAiModelRequest) -> AiResult<AiModel> {
        self.provider.create_model(request)
    }

    pub fn update_model(&self, model_id: &str, request: UpdateAiModelRequest) -> AiResult<AiModel> {
        self.provider.update_model(model_id, request)
    }

    pub fn delete_model(&self, model_id: &str) -> AiResult<()> {
        self.provider.delete_model(model_id)
    }

    pub fn test_provider(&self, request: ProviderTestRequest) -> AiResult<ProviderTestResult> {
        self.provider.test_provider(request)
    }

    pub fn get_agent_settings(&self, agent_type: AgentType) -> AiResult<AiAgentSettings> {
        self.provider.get_agent_settings(agent_type)
    }

    pub fn update_agent_settings(&self, settings: AiAgentSettings) -> AiResult<AiAgentSettings> {
        self.provider.update_agent_settings(settings)
    }

    pub fn reveal_prompt(&self, agent_type: AgentType) -> AiResult<PromptRevealResult> {
        let translation_strategy = self
            .provider
            .get_agent_settings(AgentType::Translation)
            .ok()
            .and_then(|settings| settings.translation)
            .map(|config| config.prompt_strategy)
            .unwrap_or(TranslationPromptStrategy::Standard);
        let kind = match agent_type {
            AgentType::Summary => AgentPromptKind::Summary,
            AgentType::Translation => {
                PromptResolver::for_agent(AgentType::Translation, translation_strategy)
            }
            AgentType::Tagging => AgentPromptKind::Tagging,
        };
        let (path, created) = PromptCustomization::reveal_custom_prompt(kind)?;
        Ok(PromptRevealResult {
            path: path.to_string_lossy().to_string(),
            created,
        })
    }

    pub fn get_summary(
        &self,
        request: GetSummaryRequest,
    ) -> AiResult<Option<ArticleSummaryRecord>> {
        self.summary.get_summary(request)
    }

    pub fn start_summary(&self, request: StartSummaryRequest) -> AiResult<SummaryStreamChunk> {
        self.summary.start_summary(request)
    }

    pub fn stream_summary(
        &self,
        request: StartSummaryRequest,
        emit: impl FnMut(&SummaryStreamChunk),
    ) -> AiResult<SummaryStreamChunk> {
        self.summary.stream_summary(request, emit)
    }

    pub fn get_translation(
        &self,
        article_id: &str,
        target_language: &str,
    ) -> AiResult<Option<TranslationView>> {
        self.translation
            .get_translation(article_id, target_language)
    }

    pub fn start_translation(&self, request: StartTranslationRequest) -> AiResult<TranslationView> {
        self.translation.start_translation(request)
    }

    pub fn stream_translation(
        &self,
        request: StartTranslationRequest,
        emit: impl FnMut(&TranslationView),
    ) -> AiResult<TranslationView> {
        self.translation.stream_translation(request, emit)
    }
    pub fn retry_translation_segment(
        &self,
        request: RetryTranslationSegmentRequest,
    ) -> AiResult<TranslationView> {
        self.translation.retry_translation_segment(request)
    }

    pub fn suggest_tags(&self, request: TaggingSuggestRequest) -> AiResult<TaggingSuggestResult> {
        self.tagging.suggest(request)
    }

    pub fn assign_tags(&self, request: AssignTagsRequest) -> AiResult<AssignTagsResult> {
        self.tagging.assign_tags(request)
    }

    pub fn usage_report(
        &self,
        dimension: &str,
        window_days: u32,
        key: Option<&str>,
    ) -> AiResult<UsageReportResult> {
        self.usage.report(dimension, window_days, key)
    }

    pub fn clear_expired_usage(&self, retention_days: u32) -> AiResult<UsageCleanupResult> {
        self.usage.clear_expired(retention_days)
    }

    pub fn clear_all_usage(&self) -> AiResult<UsageCleanupResult> {
        self.usage.clear_all()
    }
}

pub fn agent_type_from_str(value: &str) -> AiResult<AgentType> {
    AgentType::parse(value).ok_or_else(|| AiError::InvalidInput(format!("Unknown agent: {value}")))
}
