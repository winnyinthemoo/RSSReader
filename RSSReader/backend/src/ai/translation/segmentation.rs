//! HTML segmentation for article translation.
//!
//! Mercury-style readable articles usually contain p / ul / ol blocks. Some RSS
//! entries, however, only expose divs, headings, preformatted text, or plain text.
//! Keep p / ul / ol as the primary contract and fall back only when none exist.

#[derive(Debug, Clone)]
pub struct HtmlSegment {
    pub index: u32,
    pub tag: String,
    pub source_html: String,
    pub start: usize,
    pub end: usize,
}

pub struct Segmenter;

impl Segmenter {
    pub fn from_html(html: &str) -> Vec<HtmlSegment> {
        let primary = collect_tag_segments(html, &["p", "ul", "ol"]);
        if !primary.is_empty() {
            return primary;
        }

        let fallback = collect_tag_segments(
            html,
            &[
                "h1",
                "h2",
                "h3",
                "h4",
                "h5",
                "h6",
                "blockquote",
                "pre",
                "article",
                "section",
                "div",
                "li",
            ],
        );
        if !fallback.is_empty() {
            return split_segments_on_line_breaks(fallback);
        }

        if has_visible_text(html) {
            return split_segments_on_line_breaks(vec![HtmlSegment {
                index: 0,
                tag: "article".to_string(),
                source_html: html.to_string(),
                start: 0,
                end: html.len(),
            }]);
        }

        Vec::new()
    }
}

fn collect_tag_segments(html: &str, tags: &[&'static str]) -> Vec<HtmlSegment> {
    let mut segments = Vec::new();
    let lower = html.to_ascii_lowercase();
    let mut cursor = 0usize;

    while let Some((tag, start, end)) = find_next_block(&lower, html, cursor, tags) {
        let source_html = html[start..end].to_string();
        if has_visible_text(&source_html) {
            segments.push(HtmlSegment {
                index: segments.len() as u32,
                tag: tag.to_string(),
                source_html,
                start,
                end,
            });
        }
        cursor = end;
    }

    segments
}

fn split_segments_on_line_breaks(segments: Vec<HtmlSegment>) -> Vec<HtmlSegment> {
    let mut output = Vec::new();
    for segment in segments {
        let parts = split_segment_on_line_breaks(&segment);
        if parts.len() <= 1 {
            output.push(segment);
        } else {
            output.extend(parts);
        }
    }

    for (index, segment) in output.iter_mut().enumerate() {
        segment.index = index as u32;
    }
    output
}

fn split_segment_on_line_breaks(segment: &HtmlSegment) -> Vec<HtmlSegment> {
    let mut parts = Vec::new();
    let mut cursor = 0usize;
    let html = segment.source_html.as_str();
    let lower = html.to_ascii_lowercase();

    while cursor < html.len() {
        let next_break = find_next_line_break(&lower, html, cursor);
        let Some((break_start, break_end)) = next_break else {
            break;
        };

        push_line_part(&mut parts, segment, cursor, break_end, break_start);
        cursor = break_end;
    }

    if cursor < html.len() {
        push_line_part(&mut parts, segment, cursor, html.len(), html.len());
    }

    if parts.len() > 1 {
        parts
    } else {
        Vec::new()
    }
}

fn push_line_part(
    parts: &mut Vec<HtmlSegment>,
    original: &HtmlSegment,
    start: usize,
    end: usize,
    text_end: usize,
) {
    if text_end <= start || !has_visible_text(&original.source_html[start..text_end]) {
        return;
    }
    parts.push(HtmlSegment {
        index: 0,
        tag: original.tag.clone(),
        source_html: original.source_html[start..end].to_string(),
        start: original.start + start,
        end: original.start + end,
    });
}

fn find_next_line_break(lower: &str, original: &str, from: usize) -> Option<(usize, usize)> {
    let br_index = lower[from..].find("<br").map(|index| index + from);
    let newline_index = original[from..].find('\n').map(|index| index + from);

    match (br_index, newline_index) {
        (Some(br), Some(newline)) if br < newline => find_br_end(lower, br).or(Some((br, br + 1))),
        (Some(_), Some(newline)) => Some((newline, newline + 1)),
        (Some(br), None) => find_br_end(lower, br).or(Some((br, br + 1))),
        (None, Some(newline)) => Some((newline, newline + 1)),
        (None, None) => None,
    }
}

fn find_br_end(lower: &str, br_index: usize) -> Option<(usize, usize)> {
    let end = lower[br_index..].find('>')? + br_index + 1;
    Some((br_index, end))
}

fn find_next_block(
    lower: &str,
    original: &str,
    from: usize,
    tags: &[&'static str],
) -> Option<(&'static str, usize, usize)> {
    let mut best: Option<(&'static str, usize, usize)> = None;

    for tag in tags {
        if let Some((start, end)) = find_tag_block(lower, original, tag, from) {
            if best
                .map(|(_, _, best_end)| start < best_end)
                .unwrap_or(true)
            {
                best = Some((tag, start, end));
            }
        }
    }

    best
}

fn find_tag_block(lower: &str, _original: &str, tag: &str, from: usize) -> Option<(usize, usize)> {
    let open_needle = format!("<{tag}");
    let close_needle = format!("</{tag}>");

    let open_index = lower[from..].find(&open_needle)? + from;
    let open_end = lower[open_index..].find('>')? + open_index + 1;
    let close_index = lower[open_end..].find(&close_needle)? + open_end;
    let close_end = close_index + close_needle.len();
    Some((open_index, close_end))
}

fn has_visible_text(html: &str) -> bool {
    let mut in_tag = false;
    for character in html.chars() {
        match character {
            '<' => in_tag = true,
            '>' => in_tag = false,
            _ if !in_tag && !character.is_whitespace() => return true,
            _ => {}
        }
    }

    false
}

#[cfg(test)]
mod tests {
    use super::Segmenter;

    #[test]
    fn extracts_paragraph_and_list_blocks_in_order() {
        let html = "<div><p>One</p><ul><li>A</li></ul><ol><li>B</li></ol></div>";
        let segments = Segmenter::from_html(html);
        assert_eq!(segments.len(), 3);
        assert_eq!(segments[0].tag, "p");
        assert_eq!(segments[1].tag, "ul");
        assert_eq!(segments[2].tag, "ol");
    }

    #[test]
    fn falls_back_to_div_when_article_has_no_paragraphs() {
        let html = "<div><strong>Only div content</strong></div>";
        let segments = Segmenter::from_html(html);
        assert_eq!(segments.len(), 1);
        assert_eq!(segments[0].tag, "div");
        assert_eq!(segments[0].source_html, html);
    }

    #[test]
    fn falls_back_to_plain_text() {
        let segments = Segmenter::from_html("Plain RSS body");
        assert_eq!(segments.len(), 1);
        assert_eq!(segments[0].tag, "article");
        assert_eq!(segments[0].source_html, "Plain RSS body");
    }

    #[test]
    fn splits_fallback_block_on_br_tags() {
        let html = "<div>First line<br>Second line<br />Third line</div>";
        let segments = Segmenter::from_html(html);
        assert_eq!(segments.len(), 3);
        assert_eq!(segments[0].source_html, "<div>First line<br>");
        assert_eq!(segments[1].source_html, "Second line<br />");
        assert_eq!(segments[2].source_html, "Third line</div>");
    }

    #[test]
    fn splits_plain_text_on_newlines() {
        let segments = Segmenter::from_html("First line\nSecond line\n\nThird line");
        assert_eq!(segments.len(), 3);
        assert_eq!(segments[0].source_html, "First line\n");
        assert_eq!(segments[1].source_html, "Second line\n");
        assert_eq!(segments[2].source_html, "Third line");
    }

    #[test]
    fn ignores_empty_markup() {
        let segments = Segmenter::from_html("<div>   </div>");
        assert!(segments.is_empty());
    }
}
