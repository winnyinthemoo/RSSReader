use std::collections::HashMap;
use std::fs;
use std::path::Path;

use serde::Deserialize;

use super::super::error::{AiError, AiResult};
use super::resolver::AgentPromptKind;

#[derive(Debug, Clone, Deserialize)]
pub struct AgentPromptTemplate {
    #[serde(default)]
    _id: Option<String>,
    #[serde(deserialize_with = "deserialize_version")]
    pub version: u32,
    #[serde(default, alias = "systemTemplate")]
    pub system_template: Option<String>,
    #[serde(alias = "template")]
    pub user_template: String,
    #[serde(default, alias = "defaultParameters")]
    pub default_parameters: Vec<String>,
}

#[derive(Debug, Clone)]
pub struct PromptRenderResult {
    pub system: Option<String>,
    pub user: String,
}

pub struct PromptTemplateStore;

impl AgentPromptTemplate {
    pub fn default_parameters_map(&self) -> HashMap<String, String> {
        parse_default_parameter_entries(&self.default_parameters)
    }
}

impl PromptTemplateStore {
    pub fn load_builtin(kind: AgentPromptKind) -> AiResult<AgentPromptTemplate> {
        Self::parse_yaml(kind.builtin_content())
    }

    pub fn load_custom(path: &Path) -> AiResult<AgentPromptTemplate> {
        let content = fs::read_to_string(path)
            .map_err(|error| AiError::Prompt(format!("Failed to read custom prompt: {error}")))?;
        Self::parse_yaml(&content)
    }

    pub fn parse_yaml(content: &str) -> AiResult<AgentPromptTemplate> {
        serde_yaml::from_str(content).map_err(|error| AiError::Prompt(error.to_string()))
    }

    pub fn render(
        template: &AgentPromptTemplate,
        parameters: &HashMap<String, String>,
    ) -> AiResult<PromptRenderResult> {
        let mut merged = template.default_parameters_map();
        for (key, value) in parameters {
            merged.insert(key.clone(), value.clone());
        }
        Ok(PromptRenderResult {
            system: template
                .system_template
                .as_ref()
                .map(|value| render_template(value, &merged)),
            user: render_template(&template.user_template, &merged),
        })
    }
}

pub fn parse_default_parameter_entries(entries: &[String]) -> HashMap<String, String> {
    let mut map = HashMap::new();
    for entry in entries {
        let trimmed = entry.trim();
        if let Some((key, value)) = trimmed.split_once('=') {
            map.insert(key.trim().to_string(), value.trim().to_string());
        }
    }
    map
}

fn deserialize_version<'de, D>(deserializer: D) -> Result<u32, D::Error>
where
    D: serde::Deserializer<'de>,
{
    #[derive(Deserialize)]
    #[serde(untagged)]
    enum VersionField {
        Number(u32),
        Text(String),
    }

    match VersionField::deserialize(deserializer)? {
        VersionField::Number(value) => Ok(value),
        VersionField::Text(text) => parse_version_label(&text).map_err(serde::de::Error::custom),
    }
}

fn parse_version_label(value: &str) -> Result<u32, String> {
    let digits: String = value.chars().filter(|ch| ch.is_ascii_digit()).collect();
    digits
        .parse()
        .map_err(|_| format!("Invalid prompt version label: {value}"))
}

fn render_template(template: &str, parameters: &HashMap<String, String>) -> String {
    let mut output = template.to_string();
    for (key, value) in parameters {
        let placeholder = format!("{{{{{key}}}}}");
        output = output.replace(&placeholder, value);
    }
    render_conditional_sections(&mut output, parameters);
    output
}

fn render_conditional_sections(output: &mut String, parameters: &HashMap<String, String>) {
    for (key, value) in parameters {
        let open = format!("{{{{#{key}}}}}");
        let close = format!("{{{{/{key}}}}}");
        if value.trim().is_empty() {
            while let Some(start) = output.find(&open) {
                if let Some(end) = output[start..].find(&close) {
                    let end_index = start + end + close.len();
                    output.replace_range(start..end_index, "");
                } else {
                    break;
                }
            }
        } else {
            *output = output.replace(&open, "");
            *output = output.replace(&close, "");
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_mercury_default_parameters() {
        let map = parse_default_parameter_entries(&[
            "shortWordMin=80".to_string(),
            "maxTagCount=5".to_string(),
        ]);
        assert_eq!(map.get("shortWordMin").map(String::as_str), Some("80"));
        assert_eq!(map.get("maxTagCount").map(String::as_str), Some("5"));
    }

    #[test]
    fn translation_conditional_strips_empty_previous_context() {
        let template = AgentPromptTemplate {
            _id: None,
            version: 5,
            system_template: None,
            user_template:
                "A {{#previousSourceText}}ctx{{previousSourceText}} end{{/previousSourceText}} B"
                    .to_string(),
            default_parameters: Vec::new(),
        };
        let mut params = HashMap::new();
        params.insert("previousSourceText".to_string(), String::new());
        let rendered = PromptTemplateStore::render(&template, &params).unwrap();
        assert_eq!(rendered.user.trim(), "A  B");
    }

    #[test]
    fn translation_conditional_keeps_previous_context() {
        let template = AgentPromptTemplate {
            _id: None,
            version: 5,
            system_template: None,
            user_template: "{{#previousSourceText}}prev: {{previousSourceText}}\n{{/previousSourceText}}now: {{sourceText}}".to_string(),
            default_parameters: Vec::new(),
        };
        let mut params = HashMap::new();
        params.insert("previousSourceText".to_string(), "hello".to_string());
        params.insert("sourceText".to_string(), "world".to_string());
        let rendered = PromptTemplateStore::render(&template, &params).unwrap();
        assert!(rendered.user.contains("prev: hello"));
        assert!(rendered.user.contains("now: world"));
        assert!(!rendered.user.contains("{{#"));
    }

    #[test]
    fn builtin_summary_prompt_loads() {
        let template = PromptTemplateStore::load_builtin(AgentPromptKind::Summary).unwrap();
        assert_eq!(template.version, 2);
        assert!(template
            .system_template
            .as_ref()
            .is_some_and(|s| s.contains("DetailLevelContract")));
        assert!(!template.default_parameters.is_empty());
    }
}
