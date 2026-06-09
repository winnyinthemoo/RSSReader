use std::collections::HashMap;

use super::super::model::SummaryDetailLevel;

pub fn language_display_name(code: &str) -> String {
    match code.trim().to_lowercase().as_str() {
        "zh" | "zh-cn" | "zh-hans" | "zh_cn" => "Simplified Chinese".to_string(),
        "zh-tw" | "zh-hant" => "Traditional Chinese".to_string(),
        "en" | "en-us" => "English".to_string(),
        "ja" => "Japanese".to_string(),
        "ko" => "Korean".to_string(),
        "fr" => "French".to_string(),
        "de" => "German".to_string(),
        "es" => "Spanish".to_string(),
        "it" => "Italian".to_string(),
        "pt" | "pt-br" | "pt-pt" => "Portuguese".to_string(),
        "ru" => "Russian".to_string(),
        "ar" => "Arabic".to_string(),
        "hi" => "Hindi".to_string(),
        "id" => "Indonesian".to_string(),
        "vi" => "Vietnamese".to_string(),
        "th" => "Thai".to_string(),
        "tr" => "Turkish".to_string(),
        other => other.to_string(),
    }
}

pub fn detail_level_label(level: SummaryDetailLevel) -> &'static str {
    match level {
        SummaryDetailLevel::Short => "short",
        SummaryDetailLevel::Medium => "medium",
        SummaryDetailLevel::Detailed => "detailed",
    }
}

pub fn summary_parameters(
    target_language: &str,
    detail_level: SummaryDetailLevel,
    source_text: &str,
) -> HashMap<String, String> {
    let mut map = HashMap::new();
    map.insert(
        "targetLanguageDisplayName".to_string(),
        language_display_name(target_language),
    );
    map.insert(
        "detailLevel".to_string(),
        detail_level_label(detail_level).to_string(),
    );
    map.insert("sourceText".to_string(), source_text.to_string());
    map
}

pub fn translation_parameters(
    target_language: &str,
    source_text: &str,
    previous_source_text: Option<&str>,
) -> HashMap<String, String> {
    let mut map = HashMap::new();
    map.insert(
        "targetLanguageDisplayName".to_string(),
        language_display_name(target_language),
    );
    map.insert("sourceText".to_string(), source_text.to_string());
    map.insert(
        "previousSourceText".to_string(),
        previous_source_text.unwrap_or("").to_string(),
    );
    map
}

pub fn tagging_parameters(
    title: &str,
    body: &str,
    existing_tags_json: &str,
) -> HashMap<String, String> {
    let mut map = HashMap::new();
    map.insert("title".to_string(), title.to_string());
    map.insert("body".to_string(), body.to_string());
    map.insert("bodyKind".to_string(), "article excerpt".to_string());
    map.insert("maxTagCount".to_string(), "5".to_string());
    map.insert("maxNewTagCount".to_string(), "3".to_string());
    map.insert(
        "existingTagsJson".to_string(),
        existing_tags_json.to_string(),
    );
    map
}
