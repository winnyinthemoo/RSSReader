use std::collections::HashMap;
use std::path::PathBuf;

use super::super::error::AiResult;
use super::resolver::{ensure_custom_prompt_file, AgentPromptKind};
use super::template_store::{PromptRenderResult, PromptTemplateStore};

pub struct PromptCustomization;

#[derive(Debug, Clone)]
pub struct ResolvedPrompt {
    pub rendered: PromptRenderResult,
    pub fallback_notice: Option<String>,
}

impl PromptCustomization {
    pub fn resolve(
        kind: AgentPromptKind,
        parameters: HashMap<String, String>,
    ) -> AiResult<ResolvedPrompt> {
        let custom_path = super::resolver::PromptResolver::custom_prompt_path(kind)?;
        if custom_path.exists() {
            match PromptTemplateStore::load_custom(&custom_path) {
                Ok(template) => {
                    let builtin = PromptTemplateStore::load_builtin(kind)?;
                    if template.version != builtin.version {
                        let rendered = PromptTemplateStore::render(&builtin, &parameters)?;
                        return Ok(ResolvedPrompt {
                            rendered,
                            fallback_notice: Some(
                                "Custom prompt version mismatch; using builtin template."
                                    .to_string(),
                            ),
                        });
                    }
                    let rendered = PromptTemplateStore::render(&template, &parameters)?;
                    return Ok(ResolvedPrompt {
                        rendered,
                        fallback_notice: None,
                    });
                }
                Err(error) => {
                    let template = PromptTemplateStore::load_builtin(kind)?;
                    let rendered = PromptTemplateStore::render(&template, &parameters)?;
                    return Ok(ResolvedPrompt {
                        rendered,
                        fallback_notice: Some(format!(
                            "Invalid custom prompt ({}); using builtin template.",
                            error
                        )),
                    });
                }
            }
        }

        let template = PromptTemplateStore::load_builtin(kind)?;
        let rendered = PromptTemplateStore::render(&template, &parameters)?;
        Ok(ResolvedPrompt {
            rendered,
            fallback_notice: None,
        })
    }

    pub fn reveal_custom_prompt(kind: AgentPromptKind) -> AiResult<(PathBuf, bool)> {
        let (path, created) = ensure_custom_prompt_file(kind)?;
        Ok((path, created))
    }
}
