use rusqlite::{params, OptionalExtension};

use super::*;

impl FeedRepository {
    pub fn get_article_note(&self, article_id: &str) -> Result<Option<ArticleNote>, String> {
        self.connection
            .query_row(
                "SELECT article_id, content, created_at, updated_at
                FROM article_notes
                WHERE article_id = ?1",
                params![article_id],
                article_note_from_row,
            )
            .optional()
            .map_err(|error| format!("Failed to get article note: {error}"))
    }

    pub fn save_article_note(
        &self,
        article_id: &str,
        content: &str,
    ) -> Result<ArticleNote, String> {
        let now = now_marker();
        self.connection
            .execute(
                "INSERT INTO article_notes (article_id, content, created_at, updated_at)
                VALUES (?1, ?2, ?3, ?3)
                ON CONFLICT(article_id) DO UPDATE SET
                    content = excluded.content,
                    updated_at = excluded.updated_at",
                params![article_id, content, now],
            )
            .map_err(|error| format!("Failed to save article note: {error}"))?;

        self.get_article_note(article_id)?
            .ok_or_else(|| "Article note not found after save".to_string())
    }
}
