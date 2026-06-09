use uuid::Uuid;

use super::super::client::openai_compat::OpenAiCompatClient;
use super::super::error::{AiError, AiResult};
use super::super::model::{
    AgentSettingsRecord, AgentType, AiAgentSettings, AiModel, AiModelListResult, AiProvider,
    AiProviderListResult, CreateAiModelRequest, CreateAiProviderRequest, ProviderTestRequest,
    ProviderTestResult, SummaryAgentConfig, SummaryDetailLevel, TaggingAgentConfig,
    TranslationAgentConfig, TranslationPromptStrategy, UpdateAiModelRequest,
    UpdateAiProviderRequest,
};
use super::super::secrets::SecretStore;
use super::repository::AiRepository;

pub struct AiProviderService {
    repository: AiRepository,
}

pub struct AgentClient {
    pub client: OpenAiCompatClient,
    pub model_name: String,
    pub model_id: Option<String>,
    pub provider_id: Option<String>,
    pub base_url: String,
}

impl AiProviderService {
    pub fn new() -> AiResult<Self> {
        Ok(Self {
            repository: AiRepository::open_default()?,
        })
    }

    pub fn list_providers(&self) -> AiResult<AiProviderListResult> {
        Ok(AiProviderListResult {
            providers: self.repository.list_providers()?,
        })
    }

    pub fn create_provider(&self, request: CreateAiProviderRequest) -> AiResult<AiProvider> {
        let now = now_marker();
        let provider = AiProvider {
            id: Uuid::new_v4().to_string(),
            display_name: request.display_name.trim().to_string(),
            base_url: normalize_base_url(&request.base_url)?,
            is_enabled: true,
            created_at: now.clone(),
            updated_at: now,
        };
        self.repository.insert_provider(&provider)?;
        SecretStore::save_provider_key(&provider.id, &request.api_key)?;
        Ok(provider)
    }

    pub fn update_provider(
        &self,
        provider_id: &str,
        request: UpdateAiProviderRequest,
    ) -> AiResult<AiProvider> {
        let mut provider = self
            .repository
            .get_provider(provider_id)?
            .ok_or_else(|| AiError::NotFound(format!("Provider not found: {provider_id}")))?;

        if let Some(display_name) = request.display_name {
            provider.display_name = display_name.trim().to_string();
        }
        if let Some(base_url) = request.base_url {
            provider.base_url = normalize_base_url(&base_url)?;
        }
        if let Some(is_enabled) = request.is_enabled {
            provider.is_enabled = is_enabled;
        }
        if let Some(api_key) = request.api_key {
            SecretStore::save_provider_key(&provider.id, &api_key)?;
        }
        provider.updated_at = now_marker();
        self.repository.update_provider(&provider)?;
        Ok(provider)
    }

    pub fn delete_provider(&self, provider_id: &str) -> AiResult<()> {
        self.repository.delete_provider(provider_id)?;
        SecretStore::delete_provider_key(provider_id)?;
        Ok(())
    }

    pub fn list_models(&self) -> AiResult<AiModelListResult> {
        Ok(AiModelListResult {
            models: self.repository.list_models()?,
        })
    }

    pub fn create_model(&self, request: CreateAiModelRequest) -> AiResult<AiModel> {
        if self
            .repository
            .get_provider(&request.provider_id)?
            .is_none()
        {
            return Err(AiError::NotFound(format!(
                "Provider not found: {}",
                request.provider_id
            )));
        }
        let now = now_marker();
        let model = AiModel {
            id: Uuid::new_v4().to_string(),
            provider_id: request.provider_id,
            model_name: request.model_name.trim().to_string(),
            is_enabled: true,
            created_at: now.clone(),
            updated_at: now,
        };
        self.repository.insert_model(&model)?;
        Ok(model)
    }

    pub fn update_model(&self, model_id: &str, request: UpdateAiModelRequest) -> AiResult<AiModel> {
        let mut model = self
            .repository
            .get_model(model_id)?
            .ok_or_else(|| AiError::NotFound(format!("Model not found: {model_id}")))?;
        if let Some(model_name) = request.model_name {
            model.model_name = model_name.trim().to_string();
        }
        if let Some(is_enabled) = request.is_enabled {
            model.is_enabled = is_enabled;
        }
        model.updated_at = now_marker();
        self.repository.update_model(&model)?;
        Ok(model)
    }

    pub fn delete_model(&self, model_id: &str) -> AiResult<()> {
        self.repository.delete_model(model_id)?;
        Ok(())
    }

    pub fn test_provider(&self, request: ProviderTestRequest) -> AiResult<ProviderTestResult> {
        let (base_url, api_key, model_name) = resolve_test_credentials(&self.repository, request)?;
        let client = OpenAiCompatClient::new(base_url, api_key);
        client.ping(&model_name)
    }

    pub fn openai_client_for_agent(
        &self,
        agent_type: AgentType,
    ) -> AiResult<(OpenAiCompatClient, String, Option<String>)> {
        let route = self.openai_agent_client(agent_type)?;
        Ok((route.client, route.model_name, route.model_id))
    }

    pub fn openai_agent_client(&self, agent_type: AgentType) -> AiResult<AgentClient> {
        let settings = self.get_agent_settings(agent_type)?;
        let model_id = settings
            .primary_model_id
            .ok_or_else(|| AiError::Configuration("Primary model is not configured".to_string()))?;
        let model = self
            .repository
            .get_model(&model_id)?
            .ok_or_else(|| AiError::NotFound(format!("Model not found: {model_id}")))?;
        if !model.is_enabled {
            return Err(AiError::Configuration(
                "Primary model is disabled".to_string(),
            ));
        }
        let provider = self
            .repository
            .get_provider(&model.provider_id)?
            .ok_or_else(|| {
                AiError::NotFound(format!("Provider not found: {}", model.provider_id))
            })?;
        if !provider.is_enabled {
            return Err(AiError::Configuration("Provider is disabled".to_string()));
        }
        let api_key = SecretStore::load_provider_key(&provider.id)?.ok_or_else(|| {
            AiError::Configuration("API key not configured for provider".to_string())
        })?;
        Ok(AgentClient {
            client: OpenAiCompatClient::new(provider.base_url.clone(), api_key),
            model_name: model.model_name,
            model_id: Some(model.id),
            provider_id: Some(provider.id),
            base_url: provider.base_url,
        })
    }

    pub fn get_agent_settings(&self, agent_type: AgentType) -> AiResult<AiAgentSettings> {
        let record = self.repository.get_agent_settings(agent_type)?;
        Ok(record_to_agent_settings(agent_type, record))
    }

    pub fn update_agent_settings(&self, settings: AiAgentSettings) -> AiResult<AiAgentSettings> {
        let record = agent_settings_to_record(&settings);
        self.repository
            .upsert_agent_settings(settings.agent_type, &record, &now_marker())?;
        Ok(settings)
    }
}

fn record_to_agent_settings(agent_type: AgentType, record: AgentSettingsRecord) -> AiAgentSettings {
    let summary = record
        .config
        .get("summary")
        .and_then(|value| serde_json::from_value::<SummaryAgentConfig>(value.clone()).ok());
    let translation = record
        .config
        .get("translation")
        .and_then(|value| serde_json::from_value::<TranslationAgentConfig>(value.clone()).ok());
    let tagging = record
        .config
        .get("tagging")
        .and_then(|value| serde_json::from_value::<TaggingAgentConfig>(value.clone()).ok());

    AiAgentSettings {
        agent_type,
        primary_model_id: record.primary_model_id,
        fallback_model_id: record.fallback_model_id,
        summary: summary.or_else(|| {
            if agent_type == AgentType::Summary {
                Some(default_summary_config())
            } else {
                None
            }
        }),
        translation: translation.or_else(|| {
            if agent_type == AgentType::Translation {
                Some(default_translation_config())
            } else {
                None
            }
        }),
        tagging: tagging.or_else(|| {
            if agent_type == AgentType::Tagging {
                Some(TaggingAgentConfig {})
            } else {
                None
            }
        }),
    }
}

fn agent_settings_to_record(settings: &AiAgentSettings) -> AgentSettingsRecord {
    let mut config = serde_json::Map::new();
    if let Some(summary) = &settings.summary {
        config.insert(
            "summary".to_string(),
            serde_json::to_value(summary).unwrap(),
        );
    }
    if let Some(translation) = &settings.translation {
        config.insert(
            "translation".to_string(),
            serde_json::to_value(translation).unwrap(),
        );
    }
    if let Some(tagging) = &settings.tagging {
        config.insert(
            "tagging".to_string(),
            serde_json::to_value(tagging).unwrap(),
        );
    }

    AgentSettingsRecord {
        primary_model_id: settings.primary_model_id.clone(),
        fallback_model_id: settings.fallback_model_id.clone(),
        config: serde_json::Value::Object(config),
    }
}

fn default_summary_config() -> SummaryAgentConfig {
    SummaryAgentConfig {
        default_target_language: "zh-Hans".to_string(),
        default_detail_level: SummaryDetailLevel::Medium,
    }
}

fn default_translation_config() -> TranslationAgentConfig {
    TranslationAgentConfig {
        default_target_language: "zh-Hans".to_string(),
        concurrency: 3,
        prompt_strategy: TranslationPromptStrategy::Standard,
    }
}

fn resolve_test_credentials(
    repository: &AiRepository,
    request: ProviderTestRequest,
) -> AiResult<(String, String, String)> {
    if let Some(provider_id) = request.provider_id {
        let provider = repository
            .get_provider(&provider_id)?
            .ok_or_else(|| AiError::NotFound(format!("Provider not found: {provider_id}")))?;
        let api_key = SecretStore::load_provider_key(&provider_id)?
            .ok_or_else(|| AiError::Configuration("API key not configured".to_string()))?;
        let model_name = request
            .model_name
            .unwrap_or_else(|| "gpt-4o-mini".to_string());
        return Ok((provider.base_url, api_key, model_name));
    }

    let base_url = request
        .base_url
        .ok_or_else(|| AiError::InvalidInput("base_url is required".to_string()))?;
    let api_key = request
        .api_key
        .ok_or_else(|| AiError::InvalidInput("api_key is required".to_string()))?;
    let model_name = request
        .model_name
        .unwrap_or_else(|| "gpt-4o-mini".to_string());
    Ok((normalize_base_url(&base_url)?, api_key, model_name))
}

fn normalize_base_url(base_url: &str) -> AiResult<String> {
    let trimmed = base_url.trim().trim_end_matches('/');
    if trimmed.is_empty() {
        return Err(AiError::InvalidInput(
            "base_url cannot be empty".to_string(),
        ));
    }
    Ok(trimmed.to_string())
}

fn now_marker() -> String {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|duration| duration.as_secs().to_string())
        .unwrap_or_else(|_| "0".to_string())
}
