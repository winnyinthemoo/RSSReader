use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::time::Duration;

use rssreader_backend::ai::http::try_handle as try_handle_ai;
use rssreader_backend::feeds::{
    article_delete_tag, article_get, article_get_note, article_list, article_list_tags,
    article_mark_favorite, article_mark_read, article_save_note, article_save_tags, feed_add,
    feed_delete, feed_list, feed_refresh, feed_rename, tag_delete, tag_list, tag_merge, tag_rename,
    ArticleDetail, ArticleListFilter, ArticleListItem, ArticleListResult, ArticleNote,
    ArticleTagsResult, FeedListResult, FeedRefreshResult, FeedStatus, FeedSummary,
    FeedWithArticles, TagListResult, TagMatchMode, TagSummary,
};

fn main() -> std::io::Result<()> {
    let address =
        std::env::var("RSSREADER_BACKEND_ADDR").unwrap_or_else(|_| "127.0.0.1:5181".to_string());
    let listener = TcpListener::bind(&address)?;

    println!("Vortex backend dev server listening on http://{address}");

    for stream in listener.incoming() {
        match stream {
            Ok(stream) => handle_connection(stream),
            Err(error) => eprintln!("Connection failed: {error}"),
        }
    }

    Ok(())
}

fn handle_connection(mut stream: TcpStream) {
    let request = match read_http_request(&mut stream) {
        Ok(request) => request,
        Err(error) => {
            eprintln!("{error}");
            return;
        }
    };
    let (head, body) = request.split_once("\r\n\r\n").unwrap_or((&request, ""));
    let mut lines = head.lines();
    let request_line = lines.next().unwrap_or_default();
    let parts = request_line.split_whitespace().collect::<Vec<_>>();

    if parts.len() < 2 {
        write_json(&mut stream, 400, &error_json("Bad request"));
        return;
    }

    let method = parts[0];
    let path = parts[1];

    if method == "OPTIONS" {
        write_empty(&mut stream, 204);
        return;
    }

    if path.starts_with("/api/ai") {
        let handled = try_handle_ai(method, path, body, &mut stream);
        if handled {
            return;
        }
    }

    match (method, path) {
        ("GET", "/api/feeds") => write_json(&mut stream, 200, &feed_list_json(&feed_list())),
        ("GET", "/api/tags") => write_json(&mut stream, 200, &tag_list_json(&tag_list())),
        ("POST", "/api/tags/rename") => {
            let Some(tag_id) = json_string_field(body, "tagId") else {
                write_json(&mut stream, 400, &error_json("Missing tagId"));
                return;
            };
            let Some(name) = json_string_field(body, "name") else {
                write_json(&mut stream, 400, &error_json("Missing name"));
                return;
            };

            match tag_rename(tag_id, name) {
                Ok(result) => write_json(&mut stream, 200, &tag_list_json(&result)),
                Err(message) => write_json(&mut stream, 400, &error_json(&message)),
            }
        }
        ("POST", "/api/tags/merge") => {
            let Some(source_tag_id) = json_string_field(body, "sourceTagId") else {
                write_json(&mut stream, 400, &error_json("Missing sourceTagId"));
                return;
            };
            let Some(target_tag_id) = json_string_field(body, "targetTagId") else {
                write_json(&mut stream, 400, &error_json("Missing targetTagId"));
                return;
            };

            match tag_merge(source_tag_id, target_tag_id) {
                Ok(result) => write_json(&mut stream, 200, &tag_list_json(&result)),
                Err(message) => write_json(&mut stream, 400, &error_json(&message)),
            }
        }
        ("POST", "/api/tags/delete") => {
            let Some(tag_id) = json_string_field(body, "tagId") else {
                write_json(&mut stream, 400, &error_json("Missing tagId"));
                return;
            };

            match tag_delete(tag_id) {
                Ok(result) => write_json(&mut stream, 200, &tag_list_json(&result)),
                Err(message) => write_json(&mut stream, 400, &error_json(&message)),
            }
        }
        ("POST", "/api/feeds") => {
            let Some(url) = json_string_field(body, "url") else {
                write_json(&mut stream, 400, &error_json("Missing url"));
                return;
            };
            let name = json_string_field(body, "name").filter(|name| !name.trim().is_empty());

            match feed_add(url, name) {
                Ok(result) => write_json(&mut stream, 200, &feed_with_articles_json(&result)),
                Err(message) => write_json(&mut stream, 400, &error_json(&message)),
            }
        }
        ("POST", "/api/feeds/refresh") => {
            let Some(feed_id) = json_string_field(body, "feedId") else {
                write_json(&mut stream, 400, &error_json("Missing feedId"));
                return;
            };

            match feed_refresh(feed_id) {
                Ok(result) => write_json(&mut stream, 200, &feed_refresh_json(&result)),
                Err(message) => write_json(&mut stream, 404, &error_json(&message)),
            }
        }
        ("POST", "/api/feeds/rename") => {
            let Some(feed_id) = json_string_field(body, "feedId") else {
                write_json(&mut stream, 400, &error_json("Missing feedId"));
                return;
            };
            let Some(title) = json_string_field(body, "title") else {
                write_json(&mut stream, 400, &error_json("Missing title"));
                return;
            };

            match feed_rename(feed_id, title) {
                Ok(result) => write_json(&mut stream, 200, &feed_list_json(&result)),
                Err(message) => {
                    let status = if message == "Feed not found" { 404 } else { 400 };
                    write_json(&mut stream, status, &error_json(&message));
                }
            }
        }
        ("POST", "/api/feeds/delete") => {
            let Some(feed_id) = json_string_field(body, "feedId") else {
                write_json(&mut stream, 400, &error_json("Missing feedId"));
                return;
            };

            match feed_delete(feed_id) {
                Ok(()) => write_json(&mut stream, 200, "{\"ok\":true}"),
                Err(message) => write_json(&mut stream, 404, &error_json(&message)),
            }
        }
        ("POST", "/api/articles/mark-read") => {
            let Some(article_id) = json_string_field(body, "articleId") else {
                write_json(&mut stream, 400, &error_json("Missing articleId"));
                return;
            };
            let is_read = json_bool_field(body, "isRead").unwrap_or(true);

            match article_mark_read(article_id, is_read) {
                Ok(()) => write_json(&mut stream, 200, "{\"ok\":true}"),
                Err(message) => write_json(&mut stream, 404, &error_json(&message)),
            }
        }
        ("POST", "/api/articles/mark-favorite") => {
            let Some(article_id) = json_string_field(body, "articleId") else {
                write_json(&mut stream, 400, &error_json("Missing articleId"));
                return;
            };
            let is_favorite = json_bool_field(body, "isFavorite").unwrap_or(true);

            match article_mark_favorite(article_id, is_favorite) {
                Ok(()) => write_json(&mut stream, 200, "{\"ok\":true}"),
                Err(message) => write_json(&mut stream, 404, &error_json(&message)),
            }
        }
        ("GET", path) if path.starts_with("/api/articles/") && path.ends_with("/tags") => {
            let article_id = url_decode(
                path.trim_start_matches("/api/articles/")
                    .trim_end_matches("/tags")
                    .trim_end_matches('/'),
            );
            write_json(
                &mut stream,
                200,
                &article_tags_result_json(&article_list_tags(article_id)),
            );
        }
        ("POST", "/api/articles/tags") => {
            let Some(article_id) = json_string_field(body, "articleId") else {
                write_json(&mut stream, 400, &error_json("Missing articleId"));
                return;
            };
            let tags = json_string_array_field(body, "tags");
            let source = json_string_field(body, "source").unwrap_or_else(|| "manual".to_string());

            match article_save_tags(article_id, tags, source) {
                Ok(result) => write_json(&mut stream, 200, &article_tags_result_json(&result)),
                Err(message) => write_json(&mut stream, 400, &error_json(&message)),
            }
        }
        ("POST", "/api/articles/tags/delete") => {
            let Some(article_id) = json_string_field(body, "articleId") else {
                write_json(&mut stream, 400, &error_json("Missing articleId"));
                return;
            };
            let Some(tag_id) = json_string_field(body, "tagId") else {
                write_json(&mut stream, 400, &error_json("Missing tagId"));
                return;
            };

            match article_delete_tag(article_id, tag_id) {
                Ok(()) => write_json(&mut stream, 200, "{\"ok\":true}"),
                Err(message) => write_json(&mut stream, 400, &error_json(&message)),
            }
        }
        ("GET", path) if path.starts_with("/api/articles/") && path.ends_with("/note") => {
            let article_id = url_decode(
                path.trim_start_matches("/api/articles/")
                    .trim_end_matches("/note")
                    .trim_end_matches('/'),
            );
            match article_get_note(article_id) {
                Some(note) => write_json(&mut stream, 200, &article_note_json(&note)),
                None => write_json(&mut stream, 200, "null"),
            }
        }
        ("POST", "/api/articles/note") => {
            let Some(article_id) = json_string_field(body, "articleId") else {
                write_json(&mut stream, 400, &error_json("Missing articleId"));
                return;
            };
            let content = json_string_field(body, "content").unwrap_or_default();

            match article_save_note(article_id, content) {
                Ok(note) => write_json(&mut stream, 200, &article_note_json(&note)),
                Err(message) => write_json(&mut stream, 400, &error_json(&message)),
            }
        }
        ("GET", path) if path.starts_with("/api/articles/") => {
            let article_id = url_decode(path.trim_start_matches("/api/articles/"));
            match article_get(article_id) {
                Ok(article) => write_json(&mut stream, 200, &article_detail_json(&article)),
                Err(message) => write_json(&mut stream, 404, &error_json(&message)),
            }
        }
        ("GET", path) if path.starts_with("/api/articles") => {
            let filter = parse_article_filter(path);
            write_json(
                &mut stream,
                200,
                &article_list_result_json(&article_list(filter)),
            );
        }
        ("GET", path) if path.starts_with("/api/render") => {
            let target_url = parse_query_param(path, "url").unwrap_or_default();
            if target_url.is_empty()
                || !target_url.starts_with("http://") && !target_url.starts_with("https://")
            {
                write_json(&mut stream, 400, &error_json("Missing or invalid url"));
                return;
            }
            // Simple proxy: fetch raw page, inject <base> tag, strip X-Frame-Options.
            // No readability extraction — just show the original page iframe-friendly.
            match fetch_raw_page(&target_url) {
                Some(html) => write_proxied_html(&mut stream, &html),
                None => {
                    let fallback = html_fallback_page(&target_url);
                    write_proxied_html(&mut stream, &fallback);
                }
            }
        }
        _ => write_json(&mut stream, 404, &error_json("Not found")),
    }
}

fn read_http_request(stream: &mut TcpStream) -> Result<String, String> {
    let _ = stream.set_read_timeout(Some(Duration::from_secs(5)));
    let mut bytes = Vec::new();
    let mut chunk = [0; 4096];

    loop {
        let bytes_read = stream
            .read(&mut chunk)
            .map_err(|error| format!("Read failed: {error}"))?;
        if bytes_read == 0 {
            break;
        }

        bytes.extend_from_slice(&chunk[..bytes_read]);
        if bytes.len() > 1_048_576 {
            return Err("Read failed: request too large".to_string());
        }

        let Some(header_end) = find_header_end(&bytes) else {
            continue;
        };
        let head = String::from_utf8_lossy(&bytes[..header_end]);
        let body_start = header_end + 4;
        let content_length = content_length_from_head(&head);
        if bytes.len().saturating_sub(body_start) >= content_length {
            break;
        }
    }

    Ok(String::from_utf8_lossy(&bytes).into_owned())
}

fn find_header_end(bytes: &[u8]) -> Option<usize> {
    bytes.windows(4).position(|window| window == b"\r\n\r\n")
}

fn content_length_from_head(head: &str) -> usize {
    head.lines()
        .find_map(|line| {
            let (name, value) = line.split_once(':')?;
            if name.eq_ignore_ascii_case("content-length") {
                value.trim().parse::<usize>().ok()
            } else {
                None
            }
        })
        .unwrap_or(0)
}

fn parse_article_filter(path: &str) -> ArticleListFilter {
    let mut filter = ArticleListFilter::default();

    if let Some((_path, query)) = path.split_once('?') {
        for pair in query.split('&') {
            let Some((key, value)) = pair.split_once('=') else {
                continue;
            };

            match key {
                "feedId" if !value.is_empty() => filter.feed_id = Some(url_decode(value)),
                "unreadOnly" => filter.unread_only = value == "true",
                "favoritesOnly" => filter.favorites_only = value == "true",
                "tagId" if !value.is_empty() => filter.tag_id = Some(url_decode(value)),
                "tagIds" if !value.is_empty() => filter.tag_ids.push(url_decode(value)),
                "tagMatch" => {
                    filter.tag_match = if value == "all" {
                        TagMatchMode::All
                    } else {
                        TagMatchMode::Any
                    };
                }
                "searchQuery" if !value.is_empty() => filter.search_query = Some(url_decode(value)),
                _ => {}
            }
        }
    }

    filter
}

const CORS_RESPONSE_HEADERS: &str = "\
Access-Control-Allow-Origin: *\r\n\
Access-Control-Allow-Headers: content-type\r\n\
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS\r\n";

fn write_json(stream: &mut TcpStream, status: u16, body: &str) {
    let status_text = match status {
        200 => "OK",
        204 => "No Content",
        400 => "Bad Request",
        404 => "Not Found",
        _ => "Internal Server Error",
    };
    let response = format!(
        "HTTP/1.1 {status} {status_text}\r\nContent-Type: application/json\r\n{CORS_RESPONSE_HEADERS}Content-Length: {}\r\n\r\n{}",
        body.len(),
        body
    );

    let _ = stream.write_all(response.as_bytes());
}

fn write_empty(stream: &mut TcpStream, status: u16) {
    let response =
        format!("HTTP/1.1 {status} No Content\r\n{CORS_RESPONSE_HEADERS}Content-Length: 0\r\n\r\n");

    let _ = stream.write_all(response.as_bytes());
}

fn feed_list_json(result: &FeedListResult) -> String {
    format!(
        "{{\"feeds\":[{}]}}",
        result
            .feeds
            .iter()
            .map(feed_json)
            .collect::<Vec<_>>()
            .join(",")
    )
}

fn tag_list_json(result: &TagListResult) -> String {
    format!(
        "{{\"tags\":[{}]}}",
        result
            .tags
            .iter()
            .map(tag_json)
            .collect::<Vec<_>>()
            .join(",")
    )
}

fn feed_with_articles_json(result: &FeedWithArticles) -> String {
    format!(
        "{{\"feed\":{},\"articles\":[{}]}}",
        feed_json(&result.feed),
        result
            .articles
            .iter()
            .map(article_item_json)
            .collect::<Vec<_>>()
            .join(",")
    )
}

fn feed_refresh_json(result: &FeedRefreshResult) -> String {
    format!(
        "{{\"feed\":{},\"newArticles\":[{}]}}",
        feed_json(&result.feed),
        result
            .new_articles
            .iter()
            .map(article_item_json)
            .collect::<Vec<_>>()
            .join(",")
    )
}

fn article_list_result_json(result: &ArticleListResult) -> String {
    format!(
        "{{\"articles\":[{}]}}",
        result
            .articles
            .iter()
            .map(article_item_json)
            .collect::<Vec<_>>()
            .join(",")
    )
}

fn feed_json(feed: &FeedSummary) -> String {
    format!(
        "{{\"id\":{},\"title\":{},\"url\":{},\"siteUrl\":{},\"description\":{},\"unreadCount\":{},\"articleCount\":{},\"lastFetchedAt\":{},\"status\":{},\"errorMessage\":{}}}",
        json_string(&feed.id),
        json_string(&feed.title),
        json_string(&feed.url),
        json_option(&feed.site_url),
        json_option(&feed.description),
        feed.unread_count,
        feed.article_count,
        json_option(&feed.last_fetched_at),
        json_string(match feed.status {
            FeedStatus::Active => "active",
            FeedStatus::Error => "error",
        }),
        json_option(&feed.error_message)
    )
}

fn tag_json(tag: &TagSummary) -> String {
    format!(
        "{{\"id\":{},\"name\":{},\"articleCount\":{}}}",
        json_string(&tag.id),
        json_string(&tag.name),
        tag.article_count
    )
}

fn article_tags_result_json(result: &ArticleTagsResult) -> String {
    format!(
        "{{\"tags\":[{}]}}",
        result
            .tags
            .iter()
            .map(|tag| {
                format!(
                    "{{\"id\":{},\"name\":{},\"source\":{}}}",
                    json_string(&tag.id),
                    json_string(&tag.name),
                    json_string(&tag.source)
                )
            })
            .collect::<Vec<_>>()
            .join(",")
    )
}

fn article_note_json(note: &ArticleNote) -> String {
    format!(
        "{{\"articleId\":{},\"content\":{},\"createdAt\":{},\"updatedAt\":{}}}",
        json_string(&note.article_id),
        json_string(&note.content),
        json_string(&note.created_at),
        json_string(&note.updated_at)
    )
}

fn article_item_json(article: &ArticleListItem) -> String {
    format!(
        "{{\"id\":{},\"feedId\":{},\"feedTitle\":{},\"title\":{},\"url\":{},\"author\":{},\"publishedAt\":{},\"excerpt\":{},\"isRead\":{},\"isFavorite\":{}}}",
        json_string(&article.id),
        json_string(&article.feed_id),
        json_string(&article.feed_title),
        json_string(&article.title),
        json_string(&article.url),
        json_option(&article.author),
        json_option(&article.published_at),
        json_string(&article.excerpt),
        article.is_read,
        article.is_favorite
    )
}

fn article_detail_json(article: &ArticleDetail) -> String {
    format!(
        "{{\"id\":{},\"feedId\":{},\"feedTitle\":{},\"title\":{},\"url\":{},\"author\":{},\"publishedAt\":{},\"excerpt\":{},\"isRead\":{},\"isFavorite\":{},\"sanitizedHtml\":{}}}",
        json_string(&article.id),
        json_string(&article.feed_id),
        json_string(&article.feed_title),
        json_string(&article.title),
        json_string(&article.url),
        json_option(&article.author),
        json_option(&article.published_at),
        json_string(&article.excerpt),
        article.is_read,
        article.is_favorite,
        json_string(&article.sanitized_html)
    )
}

fn error_json(message: &str) -> String {
    format!("{{\"message\":{}}}", json_string(message))
}

fn json_option(value: &Option<String>) -> String {
    value
        .as_ref()
        .map(|value| json_string(value))
        .unwrap_or_else(|| "null".to_string())
}

fn json_string(value: &str) -> String {
    let mut output = String::with_capacity(value.len() + 2);
    output.push('"');
    for ch in value.chars() {
        match ch {
            '"' => output.push_str("\\\""),
            '\\' => output.push_str("\\\\"),
            '\n' => output.push_str("\\n"),
            '\r' => output.push_str("\\r"),
            '\t' => output.push_str("\\t"),
            '\u{08}' => output.push_str("\\b"),
            '\u{0c}' => output.push_str("\\f"),
            ch if ch.is_control() => output.push_str(&format!("\\u{:04x}", ch as u32)),
            ch => output.push(ch),
        }
    }
    output.push('"');
    output
}

fn json_string_field(body: &str, field: &str) -> Option<String> {
    let needle = format!("\"{field}\"");
    let start = body.find(&needle)?;
    let after_field = &body[start + needle.len()..];
    let colon = after_field.find(':')?;
    let after_colon = after_field[colon + 1..].trim_start();
    let mut chars = after_colon.chars();
    if chars.next()? != '"' {
        return None;
    }

    let mut value = String::new();
    let mut escaped = false;
    for ch in chars {
        if escaped {
            match ch {
                '"' => value.push('"'),
                '\\' => value.push('\\'),
                'n' => value.push('\n'),
                'r' => value.push('\r'),
                't' => value.push('\t'),
                other => value.push(other),
            }
            escaped = false;
        } else if ch == '\\' {
            escaped = true;
        } else if ch == '"' {
            return Some(value);
        } else {
            value.push(ch);
        }
    }

    None
}

fn json_bool_field(body: &str, field: &str) -> Option<bool> {
    let needle = format!("\"{field}\"");
    let start = body.find(&needle)?;
    let after_field = &body[start + needle.len()..];
    let colon = after_field.find(':')?;
    let after_colon = after_field[colon + 1..].trim_start();

    if after_colon.starts_with("true") {
        Some(true)
    } else if after_colon.starts_with("false") {
        Some(false)
    } else {
        None
    }
}

fn json_string_array_field(body: &str, field: &str) -> Vec<String> {
    let needle = format!("\"{field}\"");
    let Some(start) = body.find(&needle) else {
        return Vec::new();
    };
    let after_field = &body[start + needle.len()..];
    let Some(colon) = after_field.find(':') else {
        return Vec::new();
    };
    let after_colon = after_field[colon + 1..].trim_start();
    let Some(array_start) = after_colon.find('[') else {
        return Vec::new();
    };
    let after_array_start = &after_colon[array_start + 1..];

    let mut values = Vec::new();
    let mut value = String::new();
    let mut escaped = false;
    let mut in_string = false;

    for ch in after_array_start.chars() {
        if in_string {
            if escaped {
                match ch {
                    '"' => value.push('"'),
                    '\\' => value.push('\\'),
                    'n' => value.push('\n'),
                    'r' => value.push('\r'),
                    't' => value.push('\t'),
                    other => value.push(other),
                }
                escaped = false;
            } else if ch == '\\' {
                escaped = true;
            } else if ch == '"' {
                values.push(value.clone());
                value.clear();
                in_string = false;
            } else {
                value.push(ch);
            }
        } else if ch == '"' {
            in_string = true;
        } else if ch == ']' {
            break;
        }
    }

    values
}

fn url_decode(value: &str) -> String {
    let mut bytes = Vec::with_capacity(value.len());
    let raw_bytes = value.as_bytes();
    let mut index = 0;

    while index < raw_bytes.len() {
        match raw_bytes[index] {
            b'%' if index + 2 < raw_bytes.len() => {
                let high = raw_bytes[index + 1] as char;
                let low = raw_bytes[index + 2] as char;
                if let Ok(byte) = u8::from_str_radix(&format!("{high}{low}"), 16) {
                    bytes.push(byte);
                    index += 3;
                    continue;
                }
                bytes.push(raw_bytes[index]);
                index += 1;
            }
            b'+' => {
                bytes.push(b' ');
                index += 1;
            }
            byte => {
                bytes.push(byte);
                index += 1;
            }
        }
    }

    String::from_utf8_lossy(&bytes).into_owned()
}

/// Extract a single query parameter value from a path like "/path?key=value&..."
fn parse_query_param(path: &str, name: &str) -> Option<String> {
    let (_, query) = path.split_once('?')?;
    for pair in query.split('&') {
        let (key, value) = pair.split_once('=')?;
        if key == name && !value.is_empty() {
            return Some(url_decode(value));
        }
    }
    None
}

/// Fetch raw HTML from a remote URL, used as proxy fallback for iframe.
/// Sends full browser headers to bypass anti-bot protections.
fn fetch_raw_page(url: &str) -> Option<String> {
    use reqwest::header::*;
    use std::time::Duration;
    let mut headers = HeaderMap::new();
    headers.insert(USER_AGENT, "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36".parse().unwrap());
    headers.insert(ACCEPT, "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8".parse().unwrap());
    headers.insert(ACCEPT_LANGUAGE, "zh-CN,zh;q=0.9,en;q=0.8".parse().unwrap());
    headers.insert(
        "sec-ch-ua",
        "\"Not_A Brand\";v=\"8\", \"Chromium\";v=\"120\", \"Google Chrome\";v=\"120\""
            .parse()
            .unwrap(),
    );
    headers.insert("sec-ch-ua-mobile", "?0".parse().unwrap());
    headers.insert("sec-ch-ua-platform", "\"Windows\"".parse().unwrap());
    headers.insert("sec-fetch-dest", "document".parse().unwrap());
    headers.insert("sec-fetch-mode", "navigate".parse().unwrap());
    headers.insert("sec-fetch-site", "none".parse().unwrap());
    let client = reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(12))
        .default_headers(headers)
        .build()
        .ok()?;
    let response = client.get(url).send().ok()?;
    if !response.status().is_success() {
        return None;
    }
    let html = response.text().ok()?;

    // Inject a <base> tag after <head> so relative asset paths resolve.
    let base_url = url.trim_end_matches(|c: char| c == '/' || c == '?');
    let base_tag = format!("<base href=\"{}/\">", base_url.trim_end_matches('/'));
    let mut result = html;
    if let Some(pos) = result.find("<head>") {
        result.insert_str(pos + 6, &base_tag);
    } else if let Some(pos) = result.find("<HEAD>") {
        result.insert_str(pos + 6, &base_tag);
    }
    // Expose lazy-loaded images:
    // 1. Strip the base64 placeholder src so browsers don't pick it.
    // 2. Rewrite data-src -> src so the real URL becomes visible.
    result = result.replace(
        "src=\"data:image/gif;base64",
        "old_src=\"data:image/gif;base64",
    );
    result = result.replace(
        "src=\"data:image/png;base64",
        "old_src=\"data:image/png;base64",
    );
    result = result.replace("data-src", "src");
    Some(result)
}

/// Generate a minimal error page so the iframe shows something useful
/// rather than a JSON parse error when the remote page can't be fetched.
fn html_fallback_page(target_url: &str) -> String {
    let escaped = target_url
        .replace('&', "&amp;")
        .replace('"', "&quot;")
        .replace('<', "&lt;")
        .replace('>', "&gt;");
    format!(
        r#"<!DOCTYPE html>
<html><head><meta charset="utf-8"><base href="{0}">
<style>body{{font-family:-apple-system,sans-serif;padding:40px 28px;color:#333;}}
a{{color:#1a73e8;}}
.msg{{max-width:480px;margin:0 auto;text-align:center;}}
h2{{font-size:1.1rem;font-weight:600;margin:0 0 8px;}}
p{{font-size:.9rem;line-height:1.5;margin:0 0 16px;color:#666;}}
</style></head><body>
<div class="msg">
<h2>Unable to load original page</h2>
<p>The remote server did not respond. This may be a network issue or the site may be blocked on the current network.</p>
<p><a href="{0}" target="_blank" rel="noreferrer">Open original page in a new tab</a></p>
</div></body></html>"#,
        escaped
    )
}

/// Write an HTML response with headers that allow cross-origin embedding.
fn write_proxied_html(stream: &mut TcpStream, html: &str) {
    let body = html.as_bytes();
    let response = format!(
        "HTTP/1.1 200 OK\r\n\
         Content-Type: text/html; charset=utf-8\r\n\
         Content-Length: {}\r\n\
         Access-Control-Allow-Origin: *\r\n\
         X-Frame-Options: ALLOWALL\r\n\
         \r\n",
        body.len(),
    );
    let _ = stream.write_all(response.as_bytes());
    let _ = stream.write_all(body);
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn url_decode_handles_utf8_query_values() {
        assert_eq!(url_decode("%E4%B8%AD%E5%9B%BD+AI"), "中国 AI");
    }

    #[test]
    fn parse_article_filter_reads_search_query() {
        let filter = parse_article_filter("/api/articles?feedId=feed-1&searchQuery=AI+policy");

        assert_eq!(filter.feed_id.as_deref(), Some("feed-1"));
        assert_eq!(filter.search_query.as_deref(), Some("AI policy"));
    }
}
