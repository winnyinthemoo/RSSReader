use std::collections::HashMap;
use std::path::PathBuf;

use super::resolver::{ensure_custom_prompt_file, AgentPromptKind};
use super::template_store::{AgentPromptTemplate, PromptRenderResult, PromptTemplateStore};
use super::super::error::AiResult;

pub struct PromptCustomization;

#[derive(Debug, Clone)]
pub struct ResolvedPrompt {
    pub template: AgentPromptTemplate,
    pub rendered: PromptRenderResult,
    pub fallback_notice: Option<String>,
    pub used_custom: bool,
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
                            template: builtin,
                            rendered,
                            fallback_notice: Some(
                                "Custom prompt version mismatch; using builtin template.".to_string(),
                            ),
                            used_custom: false,
                        });
                    }
                    let rendered = PromptTemplateStore::render(&template, &parameters)?;
                    return Ok(ResolvedPrompt {
                        template,
                        rendered,
                        fallback_notice: None,
                        used_custom: true,
                    });
                }
                Err(error) => {
                    let template = PromptTemplateStore::load_builtin(kind)?;
                    let rendered = PromptTemplateStore::render(&template, &parameters)?;
                    return Ok(ResolvedPrompt {
                        template,
                        rendered,
                        fallback_notice: Some(format!(
                            "Invalid custom prompt ({}); using builtin template.",
                            error
                        )),
                        used_custom: false,
                    });
                }
            }
        }

        let template = PromptTemplateStore::load_builtin(kind)?;
        let rendered = PromptTemplateStore::render(&template, &parameters)?;
        Ok(ResolvedPrompt {
            template,
            rendered,
            fallback_notice: None,
            used_custom: false,
        })
    }

    pub fn reveal_custom_prompt(kind: AgentPromptKind) -> AiResult<(PathBuf, bool)> {
        let (path, created) = ensure_custom_prompt_file(kind)?;
        Ok((path, created))
    }
}
