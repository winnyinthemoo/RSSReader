use std::time::Duration;

use rusqlite::{params, Connection};
use url::Url;

use crate::database::run_migrations;

use super::{
    ArticleDetail, ArticleListFilter, ArticleListItem, ArticleNote, ArticleTag, FeedStatus,
    FeedSummary, TagMatchMode, TagSummary,
};

mod articles;
mod feeds;
mod notes;
mod tags;

pub struct FeedRepository {
    connection: Connection,
}

impl FeedRepository {
    pub fn open_default() -> Result<Self, String> {
        let path = default_database_path()?;
        let connection = Connection::open(path).map_err(|error| error.to_string())?;
        Self::from_connection(connection)
    }

    pub fn open_in_memory() -> Result<Self, String> {
        let connection = Connection::open_in_memory().map_err(|error| error.to_string())?;
        Self::from_connection(connection)
    }

    fn from_connection(connection: Connection) -> Result<Self, String> {
        connection
            .busy_timeout(Duration::from_secs(5))
            .map_err(|error| error.to_string())?;
        connection
            .execute_batch("PRAGMA foreign_keys = ON;")
            .map_err(|error| format!("Failed to enable foreign keys: {error}"))?;
        run_migrations(&connection)?;
        Ok(Self { connection })
    }
}

fn count_for_feed(
    connection: &Connection,
    expression: &str,
    feed_id: &str,
) -> Result<usize, String> {
    let query = format!("SELECT {expression} FROM articles WHERE feed_id = ?1");
    connection
        .query_row(&query, params![feed_id], |row| row.get::<_, i64>(0))
        .map(|count| count as usize)
        .map_err(|error| format!("Failed to count articles: {error}"))
}

fn feed_from_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<FeedSummary> {
    let status: String = row.get(7)?;
    Ok(FeedSummary {
        id: row.get(0)?,
        title: row.get(1)?,
        source_title: row.get(2)?,
        custom_title: row.get(3)?,
        url: row.get(4)?,
        site_url: row.get(5)?,
        description: row.get(6)?,
        status: feed_status_from_string(&status),
        error_message: row.get(8)?,
        last_fetched_at: row.get(9)?,
        article_count: row.get::<_, i64>(10)? as usize,
        unread_count: row.get::<_, i64>(11)? as usize,
    })
}

fn article_item_from_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<ArticleListItem> {
    Ok(ArticleListItem {
        id: row.get(0)?,
        feed_id: row.get(1)?,
        feed_title: row.get(2)?,
        title: row.get(3)?,
        url: row.get(4)?,
        author: row.get(5)?,
        published_at: row.get(6)?,
        excerpt: row.get(7)?,
        is_read: row.get::<_, i64>(8)? != 0,
        is_favorite: row.get::<_, i64>(9)? != 0,
    })
}

fn article_detail_from_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<ArticleDetail> {
    let raw_url: String = row.get(4)?;
    let feed_url = row.get::<_, String>(11).ok();
    let url = feed_url
        .as_deref()
        .map(|base| resolve_relative_url(&raw_url, base))
        .unwrap_or(raw_url);

    Ok(ArticleDetail {
        id: row.get(0)?,
        feed_id: row.get(1)?,
        feed_title: row.get(2)?,
        title: row.get(3)?,
        url,
        author: row.get(5)?,
        published_at: row.get(6)?,
        excerpt: row.get(7)?,
        is_read: row.get::<_, i64>(8)? != 0,
        is_favorite: row.get::<_, i64>(9)? != 0,
        sanitized_html: row.get(10)?,
    })
}

fn resolve_relative_url(value: &str, base_url: &str) -> String {
    let trimmed = value.trim();
    if trimmed.is_empty() || trimmed.starts_with("http://") || trimmed.starts_with("https://") {
        return trimmed.to_string();
    }
    if trimmed.starts_with("//") {
        return format!("https:{}", trimmed);
    }
    Url::parse(base_url)
        .ok()
        .and_then(|base| base.join(trimmed).ok())
        .map(|url| url.to_string())
        .unwrap_or_else(|| trimmed.to_string())
}
fn tag_summary_from_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<TagSummary> {
    Ok(TagSummary {
        id: row.get(0)?,
        name: row.get(1)?,
        article_count: row.get::<_, i64>(2)? as usize,
    })
}

fn article_tag_from_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<ArticleTag> {
    Ok(ArticleTag {
        id: row.get(0)?,
        name: row.get(1)?,
        source: row.get(2)?,
    })
}

fn article_note_from_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<ArticleNote> {
    Ok(ArticleNote {
        article_id: row.get(0)?,
        content: row.get(1)?,
        created_at: row.get(2)?,
        updated_at: row.get(3)?,
    })
}

fn feed_status_to_string(status: &FeedStatus) -> &'static str {
    match status {
        FeedStatus::Active => "active",
        FeedStatus::Error => "error",
    }
}

fn feed_status_from_string(value: &str) -> FeedStatus {
    match value {
        "error" => FeedStatus::Error,
        _ => FeedStatus::Active,
    }
}

fn bool_to_i64(value: bool) -> i64 {
    if value {
        1
    } else {
        0
    }
}

fn normalized_search_query(value: &Option<String>) -> Option<String> {
    value
        .as_deref()
        .map(str::trim)
        .filter(|query| !query.is_empty())
        .map(str::to_string)
}

fn escape_like(value: &str) -> String {
    let mut escaped = String::with_capacity(value.len());
    for ch in value.chars() {
        match ch {
            '\\' | '%' | '_' => {
                escaped.push('\\');
                escaped.push(ch);
            }
            _ => escaped.push(ch),
        }
    }
    escaped
}

fn now_marker() -> String {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|duration| duration.as_secs().to_string())
        .unwrap_or_else(|_| "0".to_string())
}

fn uuid_like_id(value: &str) -> String {
    let mut hash: u64 = 0xcbf29ce484222325;
    for byte in value.as_bytes() {
        hash ^= u64::from(*byte);
        hash = hash.wrapping_mul(0x100000001b3);
    }
    format!("{hash:x}")
}

fn default_database_path() -> Result<std::path::PathBuf, String> {
    if let Ok(path) = std::env::var("RSSREADER_DB_PATH") {
        return Ok(path.into());
    }

    let mut path = std::env::current_dir()
        .map_err(|error| format!("Failed to resolve current directory: {error}"))?;
    path.push("vortex.sqlite3");
    Ok(path)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_feed(custom_title: Option<&str>) -> FeedSummary {
        FeedSummary {
            id: "feed-custom-title".to_string(),
            title: custom_title.unwrap_or("Bloomberg AI").to_string(),
            source_title: Some("Bloomberg AI".to_string()),
            custom_title: custom_title.map(str::to_string),
            url: "https://example.com/rss.xml".to_string(),
            site_url: Some("https://example.com".to_string()),
            description: None,
            unread_count: 0,
            article_count: 0,
            last_fetched_at: Some("1".to_string()),
            status: FeedStatus::Active,
            error_message: None,
        }
    }

    #[test]
    fn save_feed_returns_custom_title_after_source_title_update() {
        let repository = FeedRepository::open_in_memory().expect("repository opens");
        repository
            .save_feed(&sample_feed(Some("ai绉戞妧")))
            .expect("custom feed saves");

        let mut refreshed = sample_feed(Some("ai绉戞妧"));
        refreshed.source_title = Some("Bloomberg AI".to_string());
        refreshed.title = "ai绉戞妧".to_string();
        repository
            .save_feed(&refreshed)
            .expect("refreshed feed saves");

        let feed = repository
            .get_feed("feed-custom-title")
            .expect("feed query succeeds")
            .expect("feed exists");

        assert_eq!(feed.title, "ai绉戞妧");
        assert_eq!(feed.custom_title.as_deref(), Some("ai绉戞妧"));
        assert_eq!(feed.source_title.as_deref(), Some("Bloomberg AI"));
    }
}
