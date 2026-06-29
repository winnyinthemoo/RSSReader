use reqwest::header::{HeaderMap, ACCEPT, ACCEPT_LANGUAGE, CACHE_CONTROL, PRAGMA, USER_AGENT};
use serde::Serialize;
use std::time::Duration;
use url::Url;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OriginalPageRenderResult {
    pub url: String,
    pub html: String,
    pub fetched: bool,
    pub message: Option<String>,
}

pub fn render_original_page(url: &str) -> Result<OriginalPageRenderResult, String> {
    let target_url = validate_http_url(url)?;

    match fetch_raw_page(target_url.as_str()) {
        Ok(html) => Ok(OriginalPageRenderResult {
            url: target_url.to_string(),
            html: prepare_original_page_html(&target_url, html),
            fetched: true,
            message: None,
        }),
        Err(message) => Ok(OriginalPageRenderResult {
            url: target_url.to_string(),
            html: original_page_fallback_html(target_url.as_str(), &message),
            fetched: false,
            message: Some(message),
        }),
    }
}

pub fn original_page_fallback_html(target_url: &str, message: &str) -> String {
    let escaped_url = escape_html(target_url);
    let escaped_message = escape_html(message);

    format!(
        r#"<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<base href="{escaped_url}">
<style>
body{{margin:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#333;background:#fff;}}
.msg{{display:grid;place-content:center;min-height:100vh;padding:40px 28px;text-align:center;box-sizing:border-box;}}
.box{{max-width:520px;margin:0 auto;}}
h2{{margin:0 0 8px;font-size:1.08rem;font-weight:650;}}
p{{margin:0 0 14px;color:#666;font-size:.9rem;line-height:1.55;}}
a{{color:#1a73e8;text-decoration:none;font-weight:650;}}
a:hover{{text-decoration:underline;}}
</style>
</head>
<body>
<main class="msg">
<div class="box">
<h2>Unable to load original page</h2>
<p>{escaped_message}</p>
<p><a href="{escaped_url}" target="_blank" rel="noreferrer">Open original page in a browser</a></p>
</div>
</main>
</body>
</html>"#
    )
}

fn validate_http_url(value: &str) -> Result<Url, String> {
    let url = Url::parse(value.trim()).map_err(|_| "Original page URL is invalid.".to_string())?;
    match url.scheme() {
        "http" | "https" => Ok(url),
        _ => Err("Original page URL must start with http:// or https://.".to_string()),
    }
}

fn fetch_raw_page(url: &str) -> Result<String, String> {
    let mut headers = HeaderMap::new();
    headers.insert(USER_AGENT, "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36".parse().unwrap());
    headers.insert(ACCEPT, "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8".parse().unwrap());
    headers.insert(ACCEPT_LANGUAGE, "zh-CN,zh;q=0.9,en;q=0.8".parse().unwrap());
    headers.insert(CACHE_CONTROL, "no-cache".parse().unwrap());
    headers.insert(PRAGMA, "no-cache".parse().unwrap());
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
        .timeout(Duration::from_secs(15))
        .redirect(reqwest::redirect::Policy::limited(8))
        .default_headers(headers)
        .build()
        .map_err(|error| format!("Failed to create page proxy client: {error}"))?;

    let response = client
        .get(url)
        .send()
        .map_err(|error| format!("Remote page request failed: {error}"))?;

    if !response.status().is_success() {
        return Err(format!("Remote page returned HTTP {}.", response.status()));
    }

    response
        .text()
        .map_err(|error| format!("Failed to read remote page HTML: {error}"))
}

fn prepare_original_page_html(target_url: &Url, html: String) -> String {
    let base_tag = format!(
        r#"<base href="{}" target="_blank">"#,
        escape_html(target_url.as_str())
    );
    let mut result = inject_head_markup(html, &base_tag);

    result = result.replace(
        "src=\"data:image/gif;base64",
        "old_src=\"data:image/gif;base64",
    );
    result = result.replace(
        "src=\"data:image/png;base64",
        "old_src=\"data:image/png;base64",
    );
    result = result.replace("data-srcset", "srcset");
    result = result.replace("data-src", "src");
    result
}

fn inject_head_markup(mut html: String, markup: &str) -> String {
    let lowercase = html.to_ascii_lowercase();
    if let Some(head_start) = lowercase.find("<head") {
        if let Some(head_end) = lowercase[head_start..].find('>') {
            html.insert_str(head_start + head_end + 1, markup);
            return html;
        }
    }

    format!("<head>{markup}</head>{html}")
}

fn escape_html(value: &str) -> String {
    value
        .replace('&', "&amp;")
        .replace('"', "&quot;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
}
