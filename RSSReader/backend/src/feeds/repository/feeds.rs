use rusqlite::{params, OptionalExtension};

use super::*;

impl FeedRepository {
    pub fn save_feed(&self, feed: &FeedSummary) -> Result<(), String> {
        let now = now_marker();
        self.connection
            .execute(
                "INSERT INTO feeds (
                    id, title, source_title, custom_title, url, site_url, description,
                    status, error_message, last_fetched_at, created_at, updated_at
                )
                VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?11)
                ON CONFLICT(id) DO UPDATE SET
                    title = excluded.title,
                    source_title = excluded.source_title,
                    custom_title = excluded.custom_title,
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
                    feed.source_title,
                    feed.custom_title,
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

    pub fn list_feeds(&self) -> Result<Vec<FeedSummary>, String> {
        let mut statement = self
            .connection
            .prepare(
                "SELECT
                    f.id,
                    COALESCE(f.custom_title, f.source_title, f.title) AS title,
                    f.source_title,
                    f.custom_title,
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
                ORDER BY title COLLATE NOCASE ASC",
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
                    COALESCE(f.custom_title, f.source_title, f.title) AS title,
                    f.source_title,
                    f.custom_title,
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
                    COALESCE(f.custom_title, f.source_title, f.title) AS title,
                    f.source_title,
                    f.custom_title,
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

    pub fn count_articles_for_feed(&self, feed_id: &str) -> Result<usize, String> {
        count_for_feed(&self.connection, "COUNT(*)", feed_id)
    }

    pub fn count_unread_for_feed(&self, feed_id: &str) -> Result<usize, String> {
        count_for_feed(&self.connection, "COUNT(*)", feed_id).and_then(|_| {
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

    pub fn feed_article_counts(&self, feed_id: &str) -> Result<(usize, usize), String> {
        self.connection
            .query_row(
                "SELECT
                    COUNT(*) AS article_count,
                    COALESCE(SUM(CASE WHEN is_read = 0 THEN 1 ELSE 0 END), 0) AS unread_count
                FROM articles
                WHERE feed_id = ?1",
                params![feed_id],
                |row| {
                    Ok((
                        row.get::<_, i64>(0)? as usize,
                        row.get::<_, i64>(1)? as usize,
                    ))
                },
            )
            .map_err(|error| format!("Failed to count feed articles: {error}"))
    }

    pub fn rename_feed(&self, feed_id: &str, title: &str) -> Result<(), String> {
        let now = now_marker();
        let updated = self
            .connection
            .execute(
                "UPDATE feeds
                SET custom_title = ?2,
                    updated_at = ?3
                WHERE id = ?1",
                params![feed_id, title, now],
            )
            .map_err(|error| format!("Failed to rename feed: {error}"))?;

        if updated == 0 {
            return Err("Feed not found".to_string());
        }

        Ok(())
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
