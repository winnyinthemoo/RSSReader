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
        .map(|link| resolve_url(&link.href, feed_url))
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

pub fn strip_html(raw: &str) -> String {
    plain_text(raw)
}

fn is_noise_image(tag: &str) -> bool {
    let lower = tag.to_lowercase();
    // Path / type patterns
    if lower.contains(".svg")
        || lower.contains("/icp.")
        || lower.contains("/gaba.")
        || lower.contains("/denglu/")
        || lower.contains("cprevious")
        || lower.contains("cnext")
        || lower.contains("/badge")
        || lower.contains("/logo.")
    {
        return true;
    }
    // Legacy keyword patterns
    if lower.contains("avatar")
        || lower.contains("gravatar")
        || lower.contains("smilies")
        || lower.contains("emoji")
        || lower.contains("class=\"icon\"")
        || lower.contains("class='icon'")
    {
        return true;
    }
    // Alt-text keyword patterns (Chinese UI labels)
    if let Some(alt_start) = lower.find("alt=\"") {
        let rest = &lower[alt_start + 5..];
        if let Some(alt_end) = rest.find('"') {
            let alt = &rest[..alt_end];
            if alt.contains("菜单")
                || alt.contains("登录")
                || alt.contains("注册")
                || alt.contains("分享")
                || alt.contains("返回")
                || alt.contains("主题")
                || alt.contains("相关文章")
                || alt.contains("声明")
                || alt.contains("标签")
            {
                return true;
            }
        }
    }
    false
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
        "<section class=body",
        "<section class=\"body\"",
        "<section class='body'",
        "<div class=post-content",
        "<div class=\"post-content\"",
        "<div class='post-content'",
        "<article",
        "class=\"article\"",
        "class=\"article ",
        "class=article",
        "class=\"article-content\"",
        "class=\"article-content ",
        "class=article-content",
        "class=\"post-content\"",
        "class=\"post-content ",
        "class=post-content",
        "class=\"entry-content\"",
        "class=\"entry-content ",
        "class=entry-content",
        "class=\"post-body\"",
        "class=\"post-body ",
        "class=post-body",
        "class=\"content\"",
        "class=\"content ",
        "class=content",
        "class=\"main\"",
        "class=\"main ",
        "class=main",
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
    let end = html.len();
    let mut result = String::with_capacity(end);
    let mut pos = 0;
    while pos < end {
        if let Some(start) = html[pos..].find(&open) {
            let abs_start = pos + start;
            result.push_str(&html[pos..abs_start]);
            let after_open = &html[abs_start..];
            if let Some(tag_end) = after_open.find('>') {
                let inner_start = abs_start + tag_end + 1;
                pos = if let Some(close_pos) = find_closing_tag_end(&html[inner_start..]) {
                    (inner_start + close_pos + close.len()).min(end)
                } else {
                    inner_start.min(end)
                };
            } else {
                pos = (abs_start + open.len()).min(end);
            }
        } else {
            break;
        }
    }
    if pos < end {
        result.push_str(&html[pos..]);
    }
    result
}

fn strip_non_content(html: &str) -> String {
    let mut html = strip_tag(html, "nav");
    html = strip_tag(&html, "footer");
    html = strip_tag(&html, "header");
    html = strip_tag(&html, "aside");
    html
}

pub fn try_fetch_full_content(article_url: &str) -> Option<String> {
    // Short timeout — if the page is slow, we'd rather show RSS content quickly.
    let client = reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(8))
        .user_agent(
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 \
             (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 VortexRSSReader/0.1",
        )
        .build()
        .ok()?;
    let response = client.get(article_url).send().ok()?;
    if !response.status().is_success() {
        return None;
    }
    let html = response.text().ok()?;
    let url = Url::parse(article_url).ok()?;
    let cleaned = strip_non_content(&html);
    let focused = narrow_to_content(&cleaned);
    let mut content = extractor::extract(&mut focused.as_bytes(), &url)
        .ok()
        .map(|product| product.content.trim().to_string())
        .unwrap_or_else(|| focused.trim().to_string());
    if content.is_empty() {
        return None;
    }
    // Quality check: if readability extracted fewer than 100 plain-text characters,
    // the result is likely garbage (JS SPA shell, CSS-only layout, etc.).
    // Fall back to the RSS summary/description instead.
    if plain_text(&content).chars().count() < 100 {
        let focused_plain_len = plain_text(focused).chars().count();
        if focused_plain_len < 100 {
            return None;
        }
        content = focused.trim().to_string();
    }
    if !content.contains("<img") {
        let page_images = extract_img_tags(&html);
        if !page_images.is_empty() {
            content = format!("{page_images}{content}");
        }
    }
    content = strip_noise_images(&content);
    // Strip orphaned <figcaption> left behind when its parent <img> was filtered out.
    content = strip_tag(&content, "figcaption");
    // Inject hero/banner background-image as <img> (missed by readability
    // since it lives in <header> which strip_non_content removes).
    if let Some(hero_tag) = extract_hero_banner_img(&html, article_url) {
        if !content.contains(&hero_tag) {
            content = format!("{}{}", hero_tag, content);
        }
    }
    // Expose lazy-loaded images:
    // 1. Strip the base64 placeholder src (common lazyload pattern) so
    //    browsers don't pick it over the real data-src.
    // 2. Rewrite data-src -> src so the real URL becomes visible.
    content = content.replace(
        "src=\"data:image/gif;base64",
        "old_src=\"data:image/gif;base64",
    );
    content = content.replace(
        "src=\"data:image/png;base64",
        "old_src=\"data:image/png;base64",
    );
    content = content.replace("data-src", "src");
    Some(content)
}

/// Called on-demand (or from background thread) to enrich RSS-short content
/// with readability-extracted full text.  Returns ammonia-cleaned HTML.
pub fn enrich_rss_content(article_url: &str, rss_html: &str) -> String {
    let feed_images = extract_img_tags(rss_html);
    let rss_plain_len = strip_html(rss_html).chars().count();
    let rss_cleaned = strip_noise_images(&strip_tag(rss_html, "figcaption"));

    let enriched = if rss_plain_len < 2000 {
        match try_fetch_full_content(article_url) {
            Some(fetched) => {
                let fetched_plain_len = strip_html(&fetched).chars().count();
                if fetched_plain_len >= rss_plain_len {
                    if feed_images.is_empty() {
                        fetched
                    } else {
                        format!("{feed_images}{fetched}")
                    }
                } else {
                    rss_cleaned.clone()
                }
            }
            None => rss_cleaned.clone(),
        }
    } else {
        rss_cleaned.clone()
    };

    ammonia::clean(&enriched)
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
        .map(|title| deduplicate_title(&strip_html(title.content.trim())))
        .filter(|title| !title.is_empty())
        .unwrap_or_else(|| "Untitled article".to_string());
    let entry_id = entry.id.trim();
    let raw_article_url = entry
        .links
        .first()
        .map(|link| link.href.clone())
        .unwrap_or_else(|| fallback_article_url(feed_url, entry_id, &title));
    let article_url = resolve_url(&raw_article_url, feed_url);
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

    // Feed-add: store only RSS raw content — no readability fetch.
    // Background enrichment happens after the feed is saved.
    let sanitized_html = ammonia::clean(&strip_noise_images(&strip_tag(&raw_html, "figcaption")));
    let excerpt = entry
        .summary
        .as_ref()
        .map(|summary| plain_excerpt(&summary.content))
        .filter(|summary| !summary.is_empty())
        .unwrap_or_else(|| plain_excerpt(&sanitized_html));

    let source_id = if entry.links.is_empty() && !entry_id.is_empty() {
        entry_id
    } else {
        raw_article_url.as_str()
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
    let compact = plain_text(html);
    compact.chars().take(180).collect()
}

fn now_marker() -> String {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|duration| duration.as_secs().to_string())
        .unwrap_or_else(|_| "0".to_string())
}

/// Extract plain text from HTML: strip all tags and collapse whitespace.
fn plain_text(html: &str) -> String {
    let mut text = String::with_capacity(html.len());
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
    text.split_whitespace().collect::<Vec<_>>().join(" ")
}

/// Some RSS feeds embed HTML in <title>, e.g.
///   "foo</span>"><span>foo</span>"
/// strip_html collapses both into "foo foo". Keep only the first occurrence.
fn deduplicate_title(raw: &str) -> String {
    let t = raw.trim();
    // Pattern: "title \" title" — strip_html collapses HTML-embedded title
    // from malformed RSS feeds into "text \" text".
    if let Some(pos) = t.find(" \"") {
        let first = t[..pos].trim();
        let second = t[pos + 2..].trim();
        if first == second {
            return first.to_string();
        }
    }
    t.to_string()
}

/// Scan raw HTML for a hero/banner background-image and return an
/// absolute <img> tag.  This catches CSS background-images that readability
/// misses because they live in <header> (stripped by strip_non_content).
fn extract_hero_banner_img(raw_html: &str, article_url: &str) -> Option<String> {
    // Find a hero/banner container
    let lower = raw_html.to_lowercase();
    let hero_start = lower.find("hero").or_else(|| lower.find("banner"))?;
    let window_start = if hero_start > 2000 {
        hero_start - 2000
    } else {
        0
    };
    let window = &raw_html[window_start..hero_start + 500];

    // Check for <img> inside the window first
    if let Some(s) = window.find("<img") {
        let tag = &window[s..];
        if let Some(src_start) = tag.find("src=\"") {
            let after = &tag[src_start + 5..];
            if let Some(src_end) = after.find('\"') {
                let mut src = after[..src_end].to_string();
                src = resolve_url(&src, article_url);
                if !src.is_empty() {
                    return Some(format!("<img src=\"{}\">", src));
                }
            }
        }
    }

    // Fallback: CSS background-image: url(...)
    if let Some(bg) = window.find("background-image") {
        let after_bg = &window[bg..];
        if let Some(url_start) = after_bg.find("url(") {
            let after_paren = &after_bg[url_start + 4..];
            if let Some(url_end) = after_paren.find(')') {
                let mut url = after_paren[..url_end].trim().to_string();
                url = url.trim_matches('\"').trim_matches('\'').to_string();
                url = resolve_url(&url, article_url);
                if !url.is_empty() {
                    return Some(format!("<img src=\"{}\">", url));
                }
            }
        }
    }

    None
}

/// Resolve a potentially relative URL against the article base URL.
fn resolve_url(url: &str, article_url: &str) -> String {
    let trimmed = url.trim();
    if trimmed.is_empty() {
        return String::new();
    }
    if trimmed.starts_with("http://") || trimmed.starts_with("https://") {
        return trimmed.to_string();
    }
    if trimmed.starts_with("//") {
        return format!("https:{}", trimmed);
    }
    if let Ok(base) = Url::parse(article_url) {
        if let Ok(resolved) = base.join(trimmed) {
            return resolved.to_string();
        }
    }
    trimmed.to_string()
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
    fn parse_feed_resolves_relative_feed_and_article_links() {
        let xml = br#"
            <rss version="2.0">
              <channel>
                <title>Relative Link Feed</title>
                <link>/</link>
                <item>
                  <title>Relative Article</title>
                  <guid>/posts/relative/</guid>
                  <link>/posts/relative/</link>
                  <description>Relative body</description>
                </item>
              </channel>
            </rss>
        "#;

        let parsed = parse_feed_bytes("https://example.com/index.xml", xml).expect("feed parses");

        assert_eq!(
            parsed.feed.site_url.as_deref(),
            Some("https://example.com/")
        );
        assert_eq!(
            parsed.articles[0].url,
            "https://example.com/posts/relative/"
        );
        assert_eq!(
            parsed.articles[0].id,
            stable_id(
                "article",
                &format!("{}:{}", parsed.feed.id, "/posts/relative/")
            )
        );
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

    #[test]
    fn narrow_to_content_prefers_unquoted_body_section() {
        let html = r#"
            <main>
              <article>
                <div class=post-content>
                  <section class=body><p>Main body</p><img src=/image.jpg></section>
                  <section class=comments><p>Comment body</p></section>
                </div>
              </article>
            </main>
        "#;

        let focused = narrow_to_content(html);

        assert!(focused.contains("Main body"));
        assert!(!focused.contains("Comment body"));
    }
}
