use std::path::PathBuf;

use super::super::error::{AiError, AiResult};
use super::super::model::{AgentType, TranslationPromptStrategy};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AgentPromptKind {
    Summary,
    TranslationStandard,
    TranslationHyMt,
    Tagging,
}

impl AgentPromptKind {
    pub fn builtin_content(self) -> &'static str {
        match self {
            Self::Summary => {
                include_str!("../../../../resources/Agent/Prompts/summary.default.yaml")
            }
            Self::TranslationStandard => {
                include_str!("../../../../resources/Agent/Prompts/translation.default.yaml")
            }
            Self::TranslationHyMt => {
                include_str!("../../../../resources/Agent/Prompts/translation.hy-mt.yaml")
            }
            Self::Tagging => {
                include_str!("../../../../resources/Agent/Prompts/tagging.default.yaml")
            }
        }
    }

    pub fn custom_filename(self) -> &'static str {
        match self {
            Self::Summary => "summary.yaml",
            Self::TranslationStandard | Self::TranslationHyMt => "translation.yaml",
            Self::Tagging => "tagging.yaml",
        }
    }
}

pub struct PromptResolver;

impl PromptResolver {
    pub fn for_agent(
        agent_type: AgentType,
        translation_strategy: TranslationPromptStrategy,
    ) -> AgentPromptKind {
        match agent_type {
            AgentType::Summary => AgentPromptKind::Summary,
            AgentType::Translation => match translation_strategy {
                TranslationPromptStrategy::Standard => AgentPromptKind::TranslationStandard,
                TranslationPromptStrategy::HyMtOptimized => AgentPromptKind::TranslationHyMt,
            },
            AgentType::Tagging => AgentPromptKind::Tagging,
        }
    }

    pub fn custom_prompt_path(kind: AgentPromptKind) -> AiResult<PathBuf> {
        Ok(prompts_root()?.join(kind.custom_filename()))
    }
}

pub fn prompts_root() -> AiResult<PathBuf> {
    let base = std::env::var("RSSREADER_DATA_DIR").unwrap_or_else(|_| {
        if cfg!(windows) {
            std::env::var("APPDATA")
                .map(|value| format!("{value}\\RSSReader"))
                .unwrap_or_else(|_| ".".to_string())
        } else {
            std::env::var("HOME")
                .map(|value| format!("{value}/.rssreader"))
                .unwrap_or_else(|_| ".".to_string())
        }
    });
    Ok(PathBuf::from(base).join("Agent").join("Prompts"))
}

pub fn ensure_custom_prompt_file(kind: AgentPromptKind) -> AiResult<(PathBuf, bool)> {
    let root = prompts_root()?;
    std::fs::create_dir_all(&root)
        .map_err(|error| AiError::Prompt(format!("Failed to create prompts dir: {error}")))?;
    let target = root.join(kind.custom_filename());
    if target.exists() {
        return Ok((target, false));
    }
    std::fs::write(&target, kind.builtin_content())
        .map_err(|error| AiError::Prompt(format!("Failed to write custom prompt: {error}")))?;
    Ok((target, true))
}
