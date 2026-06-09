use rusqlite::{params, OptionalExtension};

use super::*;

impl FeedRepository {
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

    pub fn list_article_tags(&self, article_id: &str) -> Result<Vec<ArticleTag>, String> {
        let mut statement = self
            .connection
            .prepare(
                "SELECT t.id, t.name, at.source
                FROM article_tags at
                JOIN tags t ON t.id = at.tag_id
                WHERE at.article_id = ?1
                ORDER BY t.name COLLATE NOCASE ASC",
            )
            .map_err(|error| format!("Failed to list article tags: {error}"))?;

        let tags = statement
            .query_map(params![article_id], article_tag_from_row)
            .map_err(|error| format!("Failed to list article tags: {error}"))?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|error| format!("Failed to read article tag row: {error}"))?;

        Ok(tags)
    }

    pub fn save_article_tag(
        &self,
        article_id: &str,
        display_name: &str,
        normalized_name: &str,
        source: &str,
    ) -> Result<(), String> {
        let now = now_marker();
        let tag_id: String = if let Some(existing) = self
            .connection
            .query_row(
                "SELECT id FROM tags WHERE normalized_name = ?1",
                params![normalized_name],
                |row| row.get(0),
            )
            .optional()
            .map_err(|error| format!("Failed to find tag: {error}"))?
        {
            existing
        } else {
            let id = format!("tag-{}", uuid_like_id(display_name));
            self.connection
                .execute(
                    "INSERT INTO tags (id, name, normalized_name, usage_count, created_at)
                    VALUES (?1, ?2, ?3, 0, ?4)",
                    params![id, display_name, normalized_name, now],
                )
                .map_err(|error| format!("Failed to create tag: {error}"))?;
            id
        };

        let inserted = self
            .connection
            .execute(
                "INSERT OR IGNORE INTO article_tags (article_id, tag_id, source, created_at)
                VALUES (?1, ?2, ?3, ?4)",
                params![article_id, tag_id, source, now],
            )
            .map_err(|error| format!("Failed to save article tag: {error}"))?;

        if inserted > 0 {
            self.connection
                .execute(
                    "UPDATE tags SET usage_count = usage_count + 1 WHERE id = ?1",
                    params![tag_id],
                )
                .map_err(|error| format!("Failed to update tag usage: {error}"))?;
        }

        Ok(())
    }

    pub fn delete_article_tag(&self, article_id: &str, tag_id: &str) -> Result<(), String> {
        let deleted = self
            .connection
            .execute(
                "DELETE FROM article_tags WHERE article_id = ?1 AND tag_id = ?2",
                params![article_id, tag_id],
            )
            .map_err(|error| format!("Failed to delete article tag: {error}"))?;

        if deleted > 0 {
            self.connection
                .execute(
                    "UPDATE tags SET usage_count = MAX(usage_count - 1, 0) WHERE id = ?1",
                    params![tag_id],
                )
                .map_err(|error| format!("Failed to update tag usage: {error}"))?;
        }

        Ok(())
    }

    pub fn rename_tag(
        &self,
        tag_id: &str,
        display_name: &str,
        normalized_name: &str,
    ) -> Result<(), String> {
        let updated = self
            .connection
            .execute(
                "UPDATE tags SET name = ?1, normalized_name = ?2 WHERE id = ?3",
                params![display_name, normalized_name, tag_id],
            )
            .map_err(|error| format!("Failed to rename tag: {error}"))?;

        if updated == 0 {
            return Err("Tag not found".to_string());
        }

        Ok(())
    }

    pub fn merge_tags(&self, source_tag_id: &str, target_tag_id: &str) -> Result<(), String> {
        if source_tag_id == target_tag_id {
            return Err("Cannot merge a tag into itself".to_string());
        }

        let source_exists = self.tag_exists(source_tag_id)?;
        let target_exists = self.tag_exists(target_tag_id)?;
        if !source_exists || !target_exists {
            return Err("Tag not found".to_string());
        }

        self.connection
            .execute(
                "INSERT OR IGNORE INTO article_tags (article_id, tag_id, source, created_at)
                SELECT article_id, ?1, source, created_at
                FROM article_tags
                WHERE tag_id = ?2",
                params![target_tag_id, source_tag_id],
            )
            .map_err(|error| format!("Failed to merge tag assignments: {error}"))?;

        self.connection
            .execute("DELETE FROM tags WHERE id = ?1", params![source_tag_id])
            .map_err(|error| format!("Failed to delete merged tag: {error}"))?;
        self.refresh_tag_usage(target_tag_id)?;

        Ok(())
    }

    pub fn delete_tag(&self, tag_id: &str) -> Result<(), String> {
        let deleted = self
            .connection
            .execute("DELETE FROM tags WHERE id = ?1", params![tag_id])
            .map_err(|error| format!("Failed to delete tag: {error}"))?;

        if deleted == 0 {
            return Err("Tag not found".to_string());
        }

        Ok(())
    }

    fn tag_exists(&self, tag_id: &str) -> Result<bool, String> {
        self.connection
            .query_row(
                "SELECT EXISTS(SELECT 1 FROM tags WHERE id = ?1)",
                params![tag_id],
                |row| row.get::<_, i64>(0),
            )
            .map(|exists| exists != 0)
            .map_err(|error| format!("Failed to check tag: {error}"))
    }

    fn refresh_tag_usage(&self, tag_id: &str) -> Result<(), String> {
        self.connection
            .execute(
                "UPDATE tags
                SET usage_count = (
                    SELECT COUNT(*) FROM article_tags WHERE tag_id = ?1
                )
                WHERE id = ?1",
                params![tag_id],
            )
            .map(|_| ())
            .map_err(|error| format!("Failed to refresh tag usage: {error}"))
    }

}
