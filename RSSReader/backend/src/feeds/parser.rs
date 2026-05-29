use std::io::Cursor;

use feed_rs::model::{Entry, Feed};
use readability::extractor;
use url::Url;

use super::{ArticleDetail, FeedStatus, FeedSummary};

pub struct ParsedFeed {
    pub feed: FeedSummary,
    pub articles: Vec<ArticleDetail>,
}

pub fn fetch_and_parse_feed(feed_url: &str) -> Result<ParsedFeed, String> {
    let response = reqwest::blocking::get(feed_url)
        .map_err(|error| format!("Failed to request feed: {error}"))?;

    if !response.status().is_success() {
        return Err(format!("Feed request failed with {}", response.status()));
    }

    let bytes = response
        .bytes()
        .map_err(|error| format!("Failed to read feed body: {error}"))?;

    parse_feed_bytes(feed_url, bytes.as_ref())
}

pub fn parse_feed_bytes(feed_url: &str, bytes: &[u8]) -> Result<ParsedFeed, String> {
    let feed = feed_rs::parser::parse(Cursor::new(bytes))
        .map_err(|error| format!("Failed to parse feed: {error}"))?;
    Ok(feed_to_domain(feed_url, feed))
}

fn feed_to_domain(feed_url: &str, feed: Feed) -> ParsedFeed {
    let feed_id = stable_id("feed", feed_url);
    let feed_title = feed
        .title
        .as_ref()
        .map(|title| title.content.trim().to_string())
        .filter(|title| !title.is_empty())
        .unwrap_or_else(|| host_from_url(feed_url));
    let site_url = feed
        .links
        .iter()
        .find(|link| link.rel.as_deref().unwrap_or("alternate") == "alternate")
        .map(|link| link.href.clone())
        .or_else(|| Some(site_url_from_feed_url(feed_url)));
    let description = feed
        .description
        .as_ref()
        .map(|description| description.content.trim().to_string())
        .filter(|description| !description.is_empty());

    let articles = feed
        .entries
        .iter()
        .map(|entry| entry_to_article(entry, &feed_id, &feed_title, feed_url))
        .collect::<Vec<_>>();

    let feed = FeedSummary {
        id: feed_id,
        title: feed_title.clone(),
        source_title: Some(feed_title),
        custom_title: None,
        url: feed_url.to_string(),
        site_url,
        description,
        unread_count: articles.iter().filter(|article| !article.is_read).count(),
        article_count: articles.len(),
        last_fetched_at: Some(now_marker()),
        status: FeedStatus::Active,
        error_message: None,
    };

    ParsedFeed { feed, articles }
}

fn strip_html(raw: &str) -> String {
    let mut text = String::with_capacity(raw.len());
    let mut inside_tag = false;
    for ch in raw.chars() {
        match ch {
            '<' => inside_tag = true,
            '>' => {
                inside_tag = false;
                text.push(' ');
            }
            ch if !inside_tag => text.push(ch),
            _ => {}
        }
    }
    text.split_whitespace().collect::<Vec<_>>().join(" ")
}

fn is_noise_image(tag: &str) -> bool {
    let lower = tag.to_lowercase();
    lower.contains("avatar")
        || lower.contains("gravatar")
        || lower.contains("smilies")
        || lower.contains("emoji")
        || lower.contains("class=\"icon\"")
        || lower.contains("class='icon'")
        || lower.contains("hopedomain.com/badge")
        || lower.contains("/logo.")
}

fn strip_noise_images(html: &str) -> String {
    let mut result = String::with_capacity(html.len());
    let mut pos = 0;
    while let Some(tag_start) = html[pos..].find("<img ") {
        let abs_start = pos + tag_start;
        if let Some(tag_end) = html[abs_start..].find('>') {
            let tag = &html[abs_start..abs_start + tag_end + 1];
            if !is_noise_image(tag) {
                result.push_str(&html[pos..abs_start + tag_end + 1]);
            } else {
                result.push_str(&html[pos..abs_start]);
            }
            pos = abs_start + tag_end + 1;
        } else {
            break;
        }
    }
    result.push_str(&html[pos..]);
    result
}

fn extract_img_tags(html: &str) -> String {
    let mut result = String::new();
    let mut pos = 0;
    while let Some(tag_start) = html[pos..].find("<img ") {
        let abs_start = pos + tag_start;
        if let Some(tag_end) = html[abs_start..].find('>') {
            let tag = &html[abs_start..abs_start + tag_end + 1];
            if !is_noise_image(tag) {
                result.push_str(tag);
            }
            pos = abs_start + tag_end + 1;
        } else {
            break;
        }
    }
    result
}

fn narrow_to_content(html: &str) -> &str {
    for marker in [
        "<article",
        "class=\"article\"",
        "class=\"article ",
        "class=\"post-content\"",
        "class=\"post-content ",
        "class=\"entry-content\"",
        "class=\"entry-content ",
        "class=\"post-body\"",
        "class=\"post-body ",
    ] {
        if let Some(start) = html.find(marker) {
            let after_open = &html[start..];
            if let Some(tag_close) = after_open.find('>') {
                let inner_start = start + tag_close + 1;
                let rest = &html[inner_start..];
                if let Some(end) = find_closing_tag_end(rest) {
                    return &html[inner_start..inner_start + end];
                }
            }
            break;
        }
    }
    html
}

fn is_void_element(tag: &str) -> bool {
    matches!(
        tag,
        "area"
            | "base"
            | "br"
            | "col"
            | "embed"
            | "hr"
            | "img"
            | "input"
            | "link"
            | "meta"
            | "param"
            | "source"
            | "track"
            | "wbr"
    )
}

fn find_closing_tag_end(html: &str) -> Option<usize> {
    let mut depth: i32 = 1;
    let bytes = html.as_bytes();
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'<' {
            if i + 1 < bytes.len() && bytes[i + 1] == b'/' {
                depth -= 1;
                if depth == 0 {
                    return Some(i);
                }
            } else if i + 1 < bytes.len() && bytes[i + 1].is_ascii_alphabetic() {
                let tag_start = i + 1;
                let tag_end = bytes[tag_start..]
                    .iter()
                    .position(|&b| b == b' ' || b == b'>')
                    .map(|p| tag_start + p)
                    .unwrap_or(tag_start);
                let tag_name = std::str::from_utf8(&bytes[tag_start..tag_end]).unwrap_or("");
                if !is_void_element(tag_name) {
                    depth += 1;
                }
            }
        }
        i += 1;
    }
    None
}

fn strip_tag(html: &str, tag_name: &str) -> String {
    let open = format!("<{}", tag_name);
    let close = format!("</{}>", tag_name);
    let mut result = String::with_capacity(html.len());
    let mut pos = 0;
    while let Some(start) = html[pos..].find(&open) {
        let abs_start = pos + start;
        // push everything before this tag
        result.push_str(&html[pos..abs_start]);
        // skip this tag and all its content
        let after_open = &html[abs_start..];
        if let Some(tag_end) = after_open.find('>') {
            let inner_start = abs_start + tag_end + 1;
            if let Some(close_pos) = find_closing_tag_end(&html[inner_start..]) {
                pos = inner_start + close_pos + close.len();
            } else {
                pos = inner_start;
            }
        } else {
            pos = abs_start + open.len();
        }
    }
    result.push_str(&html[pos..]);
    result
}

fn strip_non_content(html: &str) -> String {
    let mut html = strip_tag(html, "nav");
    html = strip_tag(&html, "footer");
    html = strip_tag(&html, "header");
    html = strip_tag(&html, "aside");
    html
}

fn try_fetch_full_content(article_url: &str) -> Option<String> {
    let response = reqwest::blocking::get(article_url).ok()?;
    if !response.status().is_success() {
        return None;
    }
    let html = response.text().ok()?;
    let url = Url::parse(article_url).ok()?;
    let cleaned = strip_non_content(&html);
    let focused = narrow_to_content(&cleaned);
    let product = extractor::extract(&mut focused.as_bytes(), &url).ok()?;
    let mut content = product.content.trim().to_string();
    if content.is_empty() {
        return None;
    }
    if !content.contains("<img") {
        let page_images = extract_img_tags(&html);
        if !page_images.is_empty() {
            content = format!("{page_images}{content}");
        }
    }
    content = strip_noise_images(&content);
    Some(content)
}

fn entry_to_article(
    entry: &Entry,
    feed_id: &str,
    feed_title: &str,
    feed_url: &str,
) -> ArticleDetail {
    let title = entry
        .title
        .as_ref()
        .map(|title| strip_html(title.content.trim()))
        .filter(|title| !title.is_empty())
        .unwrap_or_else(|| "Untitled article".to_string());
    let entry_id = entry.id.trim();
    let article_url = entry
        .links
        .first()
        .map(|link| link.href.clone())
        .unwrap_or_else(|| fallback_article_url(feed_url, entry_id, &title));
    let author = entry.authors.first().map(|author| author.name.clone());
    let published_at = entry
        .published
        .or(entry.updated)
        .map(|date| date.to_rfc3339());
    let raw_html = entry
        .content
        .as_ref()
        .and_then(|content| content.body.clone())
        .or_else(|| {
            entry
                .summary
                .as_ref()
                .map(|summary| summary.content.clone())
        })
        .unwrap_or_else(|| title.clone());

    let needs_full_fetch = strip_html(&raw_html).chars().count() < 2000;

    let raw_html = if needs_full_fetch {
        let feed_images = extract_img_tags(&raw_html);
        let full_text = try_fetch_full_content(&article_url).unwrap_or(raw_html);
        if feed_images.is_empty() {
            full_text
        } else {
            format!("{feed_images}{full_text}")
        }
    } else {
        raw_html
    };
    let raw_html = strip_noise_images(&raw_html);
    let sanitized_html = ammonia::clean(&raw_html);
    let excerpt = entry
        .summary
        .as_ref()
        .map(|summary| plain_excerpt(&summary.content))
        .filter(|summary| !summary.is_empty())
        .unwrap_or_else(|| plain_excerpt(&sanitized_html));

    let source_id = if entry.links.is_empty() && !entry_id.is_empty() {
        entry_id
    } else {
        article_url.as_str()
    };

    ArticleDetail {
        id: stable_id("article", &format!("{feed_id}:{source_id}")),
        feed_id: feed_id.to_string(),
        feed_title: feed_title.to_string(),
        title,
        url: article_url,
        author,
        published_at,
        excerpt,
        is_read: false,
        is_favorite: false,
        sanitized_html,
    }
}

fn fallback_article_url(feed_url: &str, entry_id: &str, title: &str) -> String {
    if entry_id.starts_with("https://") || entry_id.starts_with("http://") {
        return entry_id.to_string();
    }

    let fallback = if entry_id.is_empty() { title } else { entry_id };
    format!("{feed_url}#{}", stable_id("entry", fallback))
}

fn plain_excerpt(html: &str) -> String {
    let mut text = String::new();
    let mut inside_tag = false;

    for ch in html.chars() {
        match ch {
            '<' => inside_tag = true,
            '>' => {
                inside_tag = false;
                text.push(' ');
            }
            ch if !inside_tag => text.push(ch),
            _ => {}
        }
    }

    let compact = text.split_whitespace().collect::<Vec<_>>().join(" ");
    compact.chars().take(180).collect()
}

fn now_marker() -> String {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|duration| duration.as_secs().to_string())
        .unwrap_or_else(|_| "0".to_string())
}

pub fn stable_id(prefix: &str, value: &str) -> String {
    let hash = value.bytes().fold(5381_u64, |acc, byte| {
        acc.wrapping_mul(33).wrapping_add(byte as u64)
    });
    format!("{prefix}-{hash:x}")
}

pub fn host_from_url(url: &str) -> String {
    url.trim_start_matches("https://")
        .trim_start_matches("http://")
        .split('/')
        .next()
        .unwrap_or("Unknown Feed")
        .to_string()
}

fn site_url_from_feed_url(url: &str) -> String {
    let scheme = if url.starts_with("https://") {
        "https://"
    } else {
        "http://"
    };
    format!("{}{}", scheme, host_from_url(url))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_rss_feed() {
        let xml = br#"
            <rss version="2.0">
              <channel>
                <title>Vortex Test Feed</title>
                <link>https://example.com</link>
                <description>Example feed</description>
                <item>
                  <title>Hello RSS</title>
                  <guid>hello-rss</guid>
                  <link>https://example.com/hello</link>
                  <description><![CDATA[<p>Hello <strong>world</strong></p>]]></description>
                  <pubDate>Fri, 22 May 2026 12:00:00 GMT</pubDate>
                </item>
              </channel>
            </rss>
        "#;

        let parsed = parse_feed_bytes("https://example.com/rss.xml", xml).expect("feed parses");

        assert_eq!(parsed.feed.title, "Vortex Test Feed");
        assert_eq!(parsed.articles.len(), 1);
        assert_eq!(parsed.articles[0].title, "Hello RSS");
    }

    #[test]
    fn parse_feed_without_article_links_uses_distinct_fallback_urls() {
        let xml = br#"
            <rss version="2.0">
              <channel>
                <title>No Link Feed</title>
                <link>https://example.com</link>
                <item>
                  <title>First</title>
                  <guid>first-item</guid>
                  <description>First body</description>
                </item>
                <item>
                  <title>Second</title>
                  <guid>second-item</guid>
                  <description>Second body</description>
                </item>
              </channel>
            </rss>
        "#;

        let parsed = parse_feed_bytes("https://example.com/rss.xml", xml).expect("feed parses");

        assert_eq!(parsed.articles.len(), 2);
        assert_ne!(parsed.articles[0].url, parsed.articles[1].url);
    }
}
