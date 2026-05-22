//! HTML segmentation contract aligned with Mercury (p / ul / ol only).

#[derive(Debug, Clone)]
pub struct HtmlSegment {
    pub index: u32,
    pub tag: String,
    pub source_html: String,
}

pub struct Segmenter;

impl Segmenter {
    pub fn from_html(html: &str) -> Vec<HtmlSegment> {
        let mut segments = Vec::new();
        let lower = html.to_lowercase();
        let mut cursor = 0usize;

        while let Some((tag, start, end)) = find_next_block(&lower, html, cursor) {
            segments.push(HtmlSegment {
                index: segments.len() as u32,
                tag: tag.to_string(),
                source_html: html[start..end].to_string(),
            });
            cursor = end;
        }

        segments
    }
}

fn find_next_block(lower: &str, original: &str, from: usize) -> Option<(&'static str, usize, usize)> {
    let mut best: Option<(&'static str, usize, usize)> = None;

    for tag in ["p", "ul", "ol"] {
        if let Some((start, end)) = find_tag_block(lower, original, tag, from) {
            if best.map(|(_, _, best_end)| start < best_end).unwrap_or(true) {
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
}
