use super::super::error::{AiError, AiResult};
use super::super::provider::AiRepository;
use super::super::secrets::SecretStore;

#[derive(Debug, Clone)]
pub struct ModelRoute {
    pub provider_id: String,
    pub model_id: String,
    pub model_name: String,
    pub base_url: String,
    pub api_key: String,
}

pub struct ModelRouter;

impl ModelRouter {
    pub fn resolve_primary(
        repository: &AiRepository,
        primary_model_id: Option<String>,
    ) -> AiResult<ModelRoute> {
        let model_id = primary_model_id
            .ok_or_else(|| AiError::Configuration("Primary model is not configured".to_string()))?;
        Self::resolve_model(repository, &model_id)
    }

    pub fn resolve_fallback(
        repository: &AiRepository,
        fallback_model_id: Option<String>,
    ) -> AiResult<Option<ModelRoute>> {
        let Some(model_id) = fallback_model_id else {
            return Ok(None);
        };
        Ok(Some(Self::resolve_model(repository, &model_id)?))
    }

    fn resolve_model(repository: &AiRepository, model_id: &str) -> AiResult<ModelRoute> {
        let model = repository
            .get_model(model_id)?
            .ok_or_else(|| AiError::NotFound(format!("Model not found: {model_id}")))?;
        if !model.is_enabled {
            return Err(AiError::Configuration(format!(
                "Model is disabled: {}",
                model.model_name
            )));
        }
        let provider = repository
            .get_provider(&model.provider_id)?
            .ok_or_else(|| {
                AiError::NotFound(format!("Provider not found: {}", model.provider_id))
            })?;
        if !provider.is_enabled {
            return Err(AiError::Configuration(format!(
                "Provider is disabled: {}",
                provider.display_name
            )));
        }
        let api_key = SecretStore::load_provider_key(&provider.id)?
            .ok_or_else(|| AiError::Configuration("API key not configured".to_string()))?;
        Ok(ModelRoute {
            provider_id: provider.id,
            model_id: model.id,
            model_name: model.model_name,
            base_url: provider.base_url,
            api_key,
        })
    }
}
