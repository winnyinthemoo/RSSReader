use crate::feeds::ArticleDetail;

pub fn article_body_for_agents(article: &ArticleDetail) -> String {
    if !article.excerpt.trim().is_empty() {
        return article.excerpt.trim().to_string();
    }
    strip_html_tags(&article.sanitized_html)
}

pub fn strip_html_tags(html: &str) -> String {
    let mut output = String::new();
    let mut in_tag = false;
    for ch in html.chars() {
        match ch {
            '<' => in_tag = true,
            '>' => in_tag = false,
            _ if !in_tag => {
                if ch.is_whitespace() {
                    if !output.ends_with(' ') && !output.is_empty() {
                        output.push(' ');
                    }
                } else {
                    output.push(ch);
                }
            }
            _ => {}
        }
    }
    output.trim().to_string()
}

/// Plain text for display/storage after LLM translation (no HTML/URLs).
pub fn sanitize_translation_output(raw: &str) -> String {
    let stripped = strip_html_tags(raw);
    let without_urls = strip_http_urls(&stripped);
    collapse_whitespace(&without_urls)
}

fn strip_http_urls(text: &str) -> String {
    let mut output = String::new();
    let mut chars = text.chars().peekable();
    while let Some(ch) = chars.next() {
        if ch == 'h' || ch == 'H' {
            let rest: String = std::iter::once(ch).chain(chars.clone()).collect();
            let lower = rest.to_lowercase();
            if lower.starts_with("http://") || lower.starts_with("https://") {
                while let Some(next) = chars.next() {
                    if next.is_whitespace() {
                        output.push(next);
                        break;
                    }
                }
                continue;
            }
        }
        output.push(ch);
    }
    output.trim().to_string()
}

fn collapse_whitespace(text: &str) -> String {
    text.split_whitespace().collect::<Vec<_>>().join(" ")
}

#[cfg(test)]
mod tests {
    use super::{sanitize_translation_output, strip_html_tags};

    #[test]
    fn strip_html_removes_tags_and_keeps_text() {
        let html = "<p>Hello <a href=\"https://x.com\">link</a> world</p>";
        assert_eq!(strip_html_tags(html), "Hello link world");
    }

    #[test]
    fn sanitize_translation_strips_html_and_urls() {
        let raw = "<p>深耕<a href=\"https://bloomberg.com/x\">美国市场</a> https://bloomberg.com/y</p>";
        assert_eq!(
            sanitize_translation_output(raw),
            "深耕美国市场"
        );
    }
}
