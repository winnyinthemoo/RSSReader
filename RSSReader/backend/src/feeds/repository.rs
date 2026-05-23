use rusqlite::{params, Connection, OptionalExtension};

use crate::database::run_migrations;

use super::{ArticleDetail, ArticleListFilter, ArticleListItem, FeedStatus, FeedSummary, TagSummary};

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
        run_migrations(&connection)?;
        Ok(Self { connection })
    }

    pub fn save_feed(&self, feed: &FeedSummary) -> Result<(), String> {
        let now = now_marker();
        self.connection
            .execute(
                "INSERT INTO feeds (
                    id, title, url, site_url, description, status, error_message,
                    last_fetched_at, created_at, updated_at
                )
                VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?9)
                ON CONFLICT(id) DO UPDATE SET
                    title = excluded.title,
                    url = excluded.url,
                    site_url = excluded.site_url,
                    description = excluded.description,
                    status = excluded.status,
                    error_message = excluded.error_message,
                    last_fetched_at = excluded.last_fetched_at,
                    updated_at = excluded.updated_at",
                params![
                    feed.id,
                    feed.title,
                    feed.url,
                    feed.site_url,
                    feed.description,
                    feed_status_to_string(&feed.status),
                    feed.error_message,
                    feed.last_fetched_at,
                    now,
                ],
            )
            .map_err(|error| format!("Failed to save feed: {error}"))?;
        Ok(())
    }

    pub fn save_article(&self, article: &ArticleDetail) -> Result<(), String> {
        let now = now_marker();
        self.connection
            .execute(
                "INSERT INTO articles (
                    id, feed_id, title, url, author, published_at, excerpt,
                    sanitized_html, is_read, is_favorite, created_at, updated_at
                )
                VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?11)
                ON CONFLICT(id) DO UPDATE SET
                    feed_id = excluded.feed_id,
                    title = excluded.title,
                    url = excluded.url,
                    author = excluded.author,
                    published_at = excluded.published_at,
                    excerpt = excluded.excerpt,
                    sanitized_html = excluded.sanitized_html,
                    updated_at = excluded.updated_at",
                params![
                    article.id,
                    article.feed_id,
                    article.title,
                    article.url,
                    article.author,
                    article.published_at,
                    article.excerpt,
                    article.sanitized_html,
                    bool_to_i64(article.is_read),
                    bool_to_i64(article.is_favorite),
                    now,
                ],
            )
            .map_err(|error| format!("Failed to save article: {error}"))?;
        Ok(())
    }

    pub fn has_article(&self, article_id: &str) -> Result<bool, String> {
        let count = self
            .connection
            .query_row(
                "SELECT COUNT(*) FROM articles WHERE id = ?1",
                params![article_id],
                |row| row.get::<_, i64>(0),
            )
            .map_err(|error| format!("Failed to check article: {error}"))?;
        Ok(count > 0)
    }

    pub fn list_feeds(&self) -> Result<Vec<FeedSummary>, String> {
        let mut statement = self
            .connection
            .prepare(
                "SELECT
                    f.id,
                    f.title,
                    f.url,
                    f.site_url,
                    f.description,
                    f.status,
                    f.error_message,
                    f.last_fetched_at,
                    COUNT(a.id) AS article_count,
                    COALESCE(SUM(CASE WHEN a.is_read = 0 THEN 1 ELSE 0 END), 0) AS unread_count
                FROM feeds f
                LEFT JOIN articles a ON a.feed_id = f.id
                GROUP BY f.id
                ORDER BY f.title COLLATE NOCASE ASC",
            )
            .map_err(|error| format!("Failed to list feeds: {error}"))?;

        let feeds = statement
            .query_map([], feed_from_row)
            .map_err(|error| format!("Failed to list feeds: {error}"))?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|error| format!("Failed to read feed row: {error}"))?;

        Ok(feeds)
    }

    pub fn get_feed(&self, feed_id: &str) -> Result<Option<FeedSummary>, String> {
        self.connection
            .query_row(
                "SELECT
                    f.id,
                    f.title,
                    f.url,
                    f.site_url,
                    f.description,
                    f.status,
                    f.error_message,
                    f.last_fetched_at,
                    COUNT(a.id) AS article_count,
                    COALESCE(SUM(CASE WHEN a.is_read = 0 THEN 1 ELSE 0 END), 0) AS unread_count
                FROM feeds f
                LEFT JOIN articles a ON a.feed_id = f.id
                WHERE f.id = ?1
                GROUP BY f.id",
                params![feed_id],
                feed_from_row,
            )
            .optional()
            .map_err(|error| format!("Failed to get feed: {error}"))
    }

    pub fn get_feed_by_url(&self, url: &str) -> Result<Option<FeedSummary>, String> {
        self.connection
            .query_row(
                "SELECT
                    f.id,
                    f.title,
                    f.url,
                    f.site_url,
                    f.description,
                    f.status,
                    f.error_message,
                    f.last_fetched_at,
                    COUNT(a.id) AS article_count,
                    COALESCE(SUM(CASE WHEN a.is_read = 0 THEN 1 ELSE 0 END), 0) AS unread_count
                FROM feeds f
                LEFT JOIN articles a ON a.feed_id = f.id
                WHERE f.url = ?1
                GROUP BY f.id",
                params![url],
                feed_from_row,
            )
            .optional()
            .map_err(|error| format!("Failed to get feed by URL: {error}"))
    }

    pub fn list_articles(&self, filter: ArticleListFilter) -> Result<Vec<ArticleListItem>, String> {
        let mut query = String::from(
            "SELECT
                a.id,
                a.feed_id,
                f.title AS feed_title,
                a.title,
                a.url,
                a.author,
                a.published_at,
                a.excerpt,
                a.is_read,
                a.is_favorite
            FROM articles a
            JOIN feeds f ON f.id = a.feed_id",
        );
        let mut clauses = Vec::new();
        let mut params = Vec::new();
        if filter.feed_id.is_some() {
            params.push(filter.feed_id.clone().unwrap_or_default());
            clauses.push(format!("a.feed_id = ?{}", params.len()));
        }
        if filter.unread_only {
            clauses.push("a.is_read = 0".to_string());
        }
        if filter.favorites_only {
            clauses.push("a.is_favorite = 1".to_string());
        }
        if filter.tag_id.is_some() {
            params.push(filter.tag_id.clone().unwrap_or_default());
            clauses.push(format!(
                "EXISTS (
                    SELECT 1 FROM article_tags at
                    WHERE at.article_id = a.id AND at.tag_id = ?{}
                )",
                params.len()
            ));
        }
        if !clauses.is_empty() {
            query.push_str(" WHERE ");
            query.push_str(&clauses.join(" AND "));
        }
        query.push_str(" ORDER BY COALESCE(a.published_at, a.created_at) DESC, a.created_at DESC");

        let mut statement = self
            .connection
            .prepare(&query)
            .map_err(|error| format!("Failed to list articles: {error}"))?;

        let rows = if params.is_empty() {
            statement
                .query_map([], article_item_from_row)
                .map_err(|error| format!("Failed to list articles: {error}"))?
                .collect::<Result<Vec<_>, _>>()
        } else {
            statement
                .query_map(rusqlite::params_from_iter(params.iter()), article_item_from_row)
                .map_err(|error| format!("Failed to list articles: {error}"))?
                .collect::<Result<Vec<_>, _>>()
        };

        rows.map_err(|error| format!("Failed to read article row: {error}"))
    }

    pub fn get_article(&self, article_id: &str) -> Result<Option<ArticleDetail>, String> {
        self.connection
            .query_row(
                "SELECT
                    a.id,
                    a.feed_id,
                    f.title AS feed_title,
                    a.title,
                    a.url,
                    a.author,
                    a.published_at,
                    a.excerpt,
                    a.is_read,
                    a.is_favorite,
                    a.sanitized_html
                FROM articles a
                JOIN feeds f ON f.id = a.feed_id
                WHERE a.id = ?1",
                params![article_id],
                article_detail_from_row,
            )
            .optional()
            .map_err(|error| format!("Failed to get article: {error}"))
    }

    pub fn mark_article_read(&self, article_id: &str, is_read: bool) -> Result<(), String> {
        let updated = self
            .connection
            .execute(
                "UPDATE articles SET is_read = ?1, updated_at = ?2 WHERE id = ?3",
                params![bool_to_i64(is_read), now_marker(), article_id],
            )
            .map_err(|error| format!("Failed to mark article read: {error}"))?;

        if updated == 0 {
            return Err("Article not found".to_string());
        }

        Ok(())
    }

    pub fn mark_article_favorite(
        &self,
        article_id: &str,
        is_favorite: bool,
    ) -> Result<(), String> {
        let updated = self
            .connection
            .execute(
                "UPDATE articles SET is_favorite = ?1, updated_at = ?2 WHERE id = ?3",
                params![bool_to_i64(is_favorite), now_marker(), article_id],
            )
            .map_err(|error| format!("Failed to update starred article: {error}"))?;

        if updated == 0 {
            return Err("Article not found".to_string());
        }

        Ok(())
    }

    pub fn list_tags(&self) -> Result<Vec<TagSummary>, String> {
        let mut statement = self
            .connection
            .prepare(
                "SELECT
                    t.id,
                    t.name,
                    COUNT(at.article_id) AS article_count
                FROM tags t
                LEFT JOIN article_tags at ON at.tag_id = t.id
                GROUP BY t.id
                ORDER BY t.name COLLATE NOCASE ASC",
            )
            .map_err(|error| format!("Failed to list tags: {error}"))?;

        let tags = statement
            .query_map([], tag_summary_from_row)
            .map_err(|error| format!("Failed to list tags: {error}"))?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|error| format!("Failed to read tag row: {error}"))?;

        Ok(tags)
    }

    pub fn count_articles_for_feed(&self, feed_id: &str) -> Result<usize, String> {
        count_for_feed(&self.connection, "COUNT(*)", feed_id)
    }

    pub fn count_unread_for_feed(&self, feed_id: &str) -> Result<usize, String> {
        count_for_feed(&self.connection, "COUNT(*)", feed_id)
            .and_then(|_| {
                self.connection
                    .query_row(
                        "SELECT COUNT(*) FROM articles WHERE feed_id = ?1 AND is_read = 0",
                        params![feed_id],
                        |row| row.get::<_, i64>(0),
                    )
                    .map(|count| count as usize)
                    .map_err(|error| format!("Failed to count unread articles: {error}"))
            })
    }

    pub fn delete_feed(&self, feed_id: &str) -> Result<(), String> {
        self.connection
            .execute("DELETE FROM articles WHERE feed_id = ?1", params![feed_id])
            .map_err(|error| format!("Failed to delete articles: {error}"))?;

        let deleted = self
            .connection
            .execute("DELETE FROM feeds WHERE id = ?1", params![feed_id])
            .map_err(|error| format!("Failed to delete feed: {error}"))?;

        if deleted == 0 {
            return Err("Feed not found".to_string());
        }

        Ok(())
    }
}

fn count_for_feed(connection: &Connection, expression: &str, feed_id: &str) -> Result<usize, String> {
    let query = format!("SELECT {expression} FROM articles WHERE feed_id = ?1");
    connection
        .query_row(&query, params![feed_id], |row| row.get::<_, i64>(0))
        .map(|count| count as usize)
        .map_err(|error| format!("Failed to count articles: {error}"))
}

fn feed_from_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<FeedSummary> {
    let status: String = row.get(5)?;
    Ok(FeedSummary {
        id: row.get(0)?,
        title: row.get(1)?,
        url: row.get(2)?,
        site_url: row.get(3)?,
        description: row.get(4)?,
        status: feed_status_from_string(&status),
        error_message: row.get(6)?,
        last_fetched_at: row.get(7)?,
        article_count: row.get::<_, i64>(8)? as usize,
        unread_count: row.get::<_, i64>(9)? as usize,
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
    Ok(ArticleDetail {
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
        sanitized_html: row.get(10)?,
    })
}

fn tag_summary_from_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<TagSummary> {
    Ok(TagSummary {
        id: row.get(0)?,
        name: row.get(1)?,
        article_count: row.get::<_, i64>(2)? as usize,
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

fn now_marker() -> String {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|duration| duration.as_secs().to_string())
        .unwrap_or_else(|_| "0".to_string())
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
