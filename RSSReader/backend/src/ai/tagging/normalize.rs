//! Tag normalization (Mercury tags-v2 write-path gate).

pub fn normalize_tag_name(raw: &str) -> String {
    let trimmed = raw.trim().to_lowercase();
    let mut normalized = String::new();
    let mut last_was_space = false;
    for ch in trimmed.chars() {
        if ch.is_whitespace() || ch == '-' || ch == '_' || ch == '.' {
            if !last_was_space && !normalized.is_empty() {
                normalized.push(' ');
                last_was_space = true;
            }
            continue;
        }
        normalized.push(ch);
        last_was_space = false;
    }
    normalized.trim().to_string()
}

#[cfg(test)]
mod tests {
    use super::normalize_tag_name;

    #[test]
    fn normalizes_case_and_separators() {
        assert_eq!(normalize_tag_name("AI-generated"), "ai generated");
        assert_eq!(normalize_tag_name("  Rust_Lang  "), "rust lang");
    }
}
