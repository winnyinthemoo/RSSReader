use std::collections::HashSet;

use quick_xml::encoding::Decoder;
use quick_xml::events::{BytesStart, Event};
use quick_xml::Reader;
use rssreader_backend as backend;
use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OpmlImportRequest {
    #[serde(default)]
    pub content: Option<String>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OpmlImportItemResult {
    pub url: String,
    pub title: Option<String>,
    pub status: String,
    pub message: Option<String>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OpmlImportResult {
    pub selected: bool,
    pub total: usize,
    pub imported: usize,
    pub skipped: usize,
    pub failed: usize,
    pub items: Vec<OpmlImportItemResult>,
}

#[derive(Clone, Debug)]
struct OpmlFeedCandidate {
    url: String,
    title: Option<String>,
}

impl OpmlImportResult {
    pub fn not_selected() -> Self {
        Self::from_items(false, Vec::new())
    }

    fn from_items(selected: bool, items: Vec<OpmlImportItemResult>) -> Self {
        Self {
            selected,
            total: items.len(),
            imported: items
                .iter()
                .filter(|item| item.status == "imported")
                .count(),
            skipped: items.iter().filter(|item| item.status == "skipped").count(),
            failed: items.iter().filter(|item| item.status == "failed").count(),
            items,
        }
    }
}

pub fn import_opml_from_content(content: &str) -> Result<OpmlImportResult, String> {
    let candidates = parse_opml_candidates(content)?;
    let mut known_urls = backend::feeds::feed_list()
        .feeds
        .into_iter()
        .map(|feed| normalize_known_feed_url(&feed.url))
        .collect::<HashSet<_>>();
    let mut seen_urls = HashSet::new();
    let mut items = Vec::new();

    for candidate in candidates {
        let Some(url) = normalize_feed_url(&candidate.url) else {
            items.push(import_item_failed(
                candidate.url,
                candidate.title,
                "Feed URL must start with http:// or https://".to_string(),
            ));
            continue;
        };

        if !seen_urls.insert(url.clone()) {
            items.push(import_item_skipped(
                url,
                candidate.title,
                "Duplicate feed in OPML".to_string(),
            ));
            continue;
        }

        if known_urls.contains(&url) {
            items.push(import_item_skipped(
                url,
                candidate.title,
                "Feed already subscribed".to_string(),
            ));
            continue;
        }

        match backend::feeds::feed_add(url.clone(), candidate.title.clone()) {
            Ok(_) => {
                known_urls.insert(url.clone());
                items.push(OpmlImportItemResult {
                    url,
                    title: candidate.title,
                    status: "imported".to_string(),
                    message: None,
                });
            }
            Err(error) => {
                items.push(import_item_failed(url, candidate.title, error));
            }
        }
    }

    Ok(OpmlImportResult::from_items(true, items))
}

fn parse_opml_candidates(content: &str) -> Result<Vec<OpmlFeedCandidate>, String> {
    let mut reader = Reader::from_str(content);
    reader.config_mut().trim_text(true);
    let mut candidates = Vec::new();

    loop {
        match reader.read_event() {
            Ok(Event::Start(start)) | Ok(Event::Empty(start)) => {
                if is_outline(&start) {
                    if let Some(candidate) = candidate_from_outline(&start, reader.decoder())? {
                        candidates.push(candidate);
                    }
                }
            }
            Ok(Event::Eof) => break,
            Ok(_) => {}
            Err(error) => return Err(format!("Invalid OPML file: {error}")),
        }
    }

    Ok(candidates)
}

fn candidate_from_outline(
    start: &BytesStart<'_>,
    decoder: Decoder,
) -> Result<Option<OpmlFeedCandidate>, String> {
    let mut url = None;
    let mut title = None;

    for attribute in start.attributes().with_checks(false) {
        let attribute = attribute.map_err(|error| format!("Invalid OPML attribute: {error}"))?;
        let key = String::from_utf8_lossy(attribute.key.as_ref()).to_ascii_lowercase();
        let value = attribute
            .decode_and_unescape_value(decoder)
            .map_err(|error| format!("Invalid OPML attribute value: {error}"))?
            .trim()
            .to_string();

        match key.as_str() {
            "xmlurl" | "xml_url" | "url" if url.is_none() => {
                url = Some(value);
            }
            "title" | "text" | "description" if title.is_none() && !value.is_empty() => {
                title = Some(value);
            }
            _ => {}
        }
    }

    Ok(url
        .filter(|value| !value.trim().is_empty())
        .map(|url| OpmlFeedCandidate { url, title }))
}

fn is_outline(start: &BytesStart<'_>) -> bool {
    start.local_name().as_ref().eq_ignore_ascii_case(b"outline")
}

fn normalize_feed_url(value: &str) -> Option<String> {
    let trimmed = value.trim();
    if trimmed.starts_with("https://") || trimmed.starts_with("http://") {
        Some(trimmed.trim_end_matches('/').to_string())
    } else {
        None
    }
}

fn normalize_known_feed_url(value: &str) -> String {
    value.trim().trim_end_matches('/').to_string()
}

fn import_item_skipped(
    url: String,
    title: Option<String>,
    message: String,
) -> OpmlImportItemResult {
    OpmlImportItemResult {
        url,
        title,
        status: "skipped".to_string(),
        message: Some(message),
    }
}

fn import_item_failed(url: String, title: Option<String>, message: String) -> OpmlImportItemResult {
    OpmlImportItemResult {
        url,
        title,
        status: "failed".to_string(),
        message: Some(message),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_feed_outlines_from_opml() {
        let content = r#"<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <body>
    <outline text="Tech">
      <outline text="Example Feed" xmlUrl="https://example.com/feed.xml" />
      <outline title="Second Feed" xmlurl="https://example.org/rss" />
    </outline>
  </body>
</opml>"#;

        let candidates = parse_opml_candidates(content).expect("OPML should parse");

        assert_eq!(candidates.len(), 2);
        assert_eq!(candidates[0].url, "https://example.com/feed.xml");
        assert_eq!(candidates[0].title.as_deref(), Some("Example Feed"));
        assert_eq!(candidates[1].url, "https://example.org/rss");
        assert_eq!(candidates[1].title.as_deref(), Some("Second Feed"));
    }

    #[test]
    fn normalizes_only_http_feed_urls() {
        assert_eq!(
            normalize_feed_url(" https://example.com/feed.xml/ "),
            Some("https://example.com/feed.xml".to_string())
        );
        assert_eq!(normalize_feed_url("feed://example.com/rss"), None);
    }
}
