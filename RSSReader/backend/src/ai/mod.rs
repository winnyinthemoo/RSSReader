mod client;
mod commands;
pub mod error;
pub mod http;
mod model;
mod prompt;
mod provider;
mod runtime;
mod secrets;
mod service;
mod summary;
mod tagging;
mod text;
mod translation;
mod usage;

pub use commands::{
    ai_assign_tags, ai_create_model, ai_create_provider, ai_delete_model, ai_delete_provider,
    ai_get_agent_settings, ai_get_summary, ai_get_translation, ai_list_models, ai_list_providers,
    ai_reveal_prompt, ai_start_summary, ai_start_translation, ai_start_translation_stream,
    ai_suggest_tags, ai_test_provider, ai_update_agent_settings, ai_update_model,
    ai_update_provider, ai_usage_report,
};
pub use error::{AiError, AiResult};
pub use model::*;
pub use service::AiService;
