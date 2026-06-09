use std::collections::HashSet;

use rusqlite::{params, OptionalExtension};

use super::*;

impl FeedRepository {
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

    pub fn save_articles_for_refresh(
        &self,
        feed_title: &str,
        articles: &[ArticleDetail],
    ) -> Result<Vec<ArticleListItem>, String> {
        if articles.is_empty() {
            return Ok(Vec::new());
        }

        let article_ids = articles
            .iter()
            .map(|article| article.id.clone())
            .collect::<Vec<_>>();
        let existing_article_ids = self.existing_article_ids(&article_ids)?;
        let mut new_articles = Vec::new();
        for article in articles {
            if !existing_article_ids.contains(&article.id) {
                let mut item = article.list_item();
                item.feed_title = feed_title.to_string();
                new_articles.push(item);
            }
        }

        let transaction = self
            .connection
            .unchecked_transaction()
            .map_err(|error| format!("Failed to start article refresh transaction: {error}"))?;
        {
            let mut statement = transaction
                .prepare(
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
                )
                .map_err(|error| format!("Failed to prepare article refresh upsert: {error}"))?;

            for article in articles {
                let now = now_marker();
                statement
                    .execute(params![
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
                    ])
                    .map_err(|error| format!("Failed to save refreshed article: {error}"))?;
            }
        }
        transaction
            .commit()
            .map_err(|error| format!("Failed to commit article refresh transaction: {error}"))?;

        Ok(new_articles)
    }

    /// Update only the sanitized_html field (used for on-demand content enrichment).
    pub fn update_article_content(
        &self,
        article_id: &str,
        sanitized_html: &str,
    ) -> Result<(), String> {
        self.connection
            .execute(
                "UPDATE articles SET sanitized_html = ?1, updated_at = ?2 WHERE id = ?3",
                params![sanitized_html, now_marker(), article_id],
            )
            .map_err(|error| format!("Failed to update article content: {error}"))?;
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

    pub fn list_articles(&self, filter: ArticleListFilter) -> Result<Vec<ArticleListItem>, String> {
        let mut query = String::from(
            "SELECT
                a.id,
                a.feed_id,
                COALESCE(f.custom_title, f.source_title, f.title) AS feed_title,
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
        let mut selected_tag_ids = if filter.tag_ids.is_empty() {
            filter.tag_id.iter().cloned().collect::<Vec<_>>()
        } else {
            filter.tag_ids.clone()
        };
        selected_tag_ids.retain(|tag_id| !tag_id.trim().is_empty());
        selected_tag_ids.sort();
        selected_tag_ids.dedup();
        if !selected_tag_ids.is_empty() {
            let tag_count = selected_tag_ids.len();
            let param_start = params.len();
            let placeholders = selected_tag_ids
                .iter()
                .enumerate()
                .map(|(index, _)| format!("?{}", param_start + index + 1))
                .collect::<Vec<_>>()
                .join(", ");
            params.extend(selected_tag_ids.iter().cloned());
            match filter.tag_match {
                TagMatchMode::All => {
                    clauses.push(format!(
                        "a.id IN (
                            SELECT at.article_id
                            FROM article_tags at
                            WHERE at.tag_id IN ({placeholders})
                            GROUP BY at.article_id
                            HAVING COUNT(DISTINCT at.tag_id) = {tag_count}
                        )"
                    ));
                }
                TagMatchMode::Any => {
                    clauses.push(format!(
                        "EXISTS (
                            SELECT 1 FROM article_tags at
                            WHERE at.article_id = a.id AND at.tag_id IN ({placeholders})
                        )"
                    ));
                }
            }
        }
        if let Some(search_query) = normalized_search_query(&filter.search_query) {
            let search_pattern = format!("%{}%", escape_like(&search_query));
            params.push(search_pattern.clone());
            let title_param = params.len();
            params.push(search_pattern.clone());
            let author_param = params.len();
            params.push(search_pattern.clone());
            let excerpt_param = params.len();
            params.push(search_pattern.clone());
            let content_param = params.len();
            params.push(search_pattern);
            let translation_param = params.len();
            clauses.push(format!(
                "(a.title LIKE ?{title_param} ESCAPE '\\'
                    OR COALESCE(a.author, '') LIKE ?{author_param} ESCAPE '\\'
                    OR a.excerpt LIKE ?{excerpt_param} ESCAPE '\\'
                    OR a.sanitized_html LIKE ?{content_param} ESCAPE '\\'
                    OR EXISTS (
                        SELECT 1
                        FROM article_translation_runs atr
                        LEFT JOIN article_translation_segments ats ON ats.run_id = atr.id
                        WHERE atr.article_id = a.id
                            AND (
                                COALESCE(atr.translated_title, '') LIKE ?{translation_param} ESCAPE '\\'
                                OR COALESCE(ats.translated_text, '') LIKE ?{translation_param} ESCAPE '\\'
                            )
                    ))"
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
                .query_map(
                    rusqlite::params_from_iter(params.iter()),
                    article_item_from_row,
                )
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
                    COALESCE(f.custom_title, f.source_title, f.title) AS feed_title,
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

    pub fn mark_article_favorite(&self, article_id: &str, is_favorite: bool) -> Result<(), String> {
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

    fn existing_article_ids(&self, article_ids: &[String]) -> Result<HashSet<String>, String> {
        if article_ids.is_empty() {
            return Ok(HashSet::new());
        }

        let mut existing_article_ids = HashSet::new();
        for chunk in article_ids.chunks(900) {
            let placeholders = (1..=chunk.len())
                .map(|index| format!("?{index}"))
                .collect::<Vec<_>>()
                .join(", ");
            let query = format!("SELECT id FROM articles WHERE id IN ({placeholders})");
            let mut statement = self
                .connection
                .prepare(&query)
                .map_err(|error| format!("Failed to prepare existing article lookup: {error}"))?;
            let rows = statement
                .query_map(rusqlite::params_from_iter(chunk.iter()), |row| row.get::<_, String>(0))
                .map_err(|error| format!("Failed to query existing articles: {error}"))?;

            for row in rows {
                existing_article_ids.insert(
                    row.map_err(|error| format!("Failed to read existing article id: {error}"))?,
                );
            }
        }

        Ok(existing_article_ids)
    }
}

