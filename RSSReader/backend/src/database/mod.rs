use rusqlite::Connection;

pub const MIGRATION_0001: &str =
    include_str!("../../../db/migrations/0001_create_feeds_and_articles.sql");
pub const MIGRATION_0002: &str =
    include_str!("../../../db/migrations/0002_ai_providers_models.sql");
pub const MIGRATION_0003: &str = include_str!("../../../db/migrations/0003_tags.sql");
pub const MIGRATION_0004: &str = include_str!("../../../db/migrations/0004_ai_results_usage.sql");
pub const MIGRATION_0005: &str = include_str!("../../../db/migrations/0005_article_notes.sql");
pub const MIGRATION_0006: &str =
    include_str!("../../../db/migrations/0006_feed_display_titles.sql");
pub const MIGRATION_0007: &str = include_str!("../../../db/migrations/0007_translation_title.sql");
pub const MIGRATION_0008: &str =
    include_str!("../../../db/migrations/0008_article_list_performance_indexes.sql");

/// Legacy alias used by feed repository.
pub const INITIAL_MIGRATION: &str = MIGRATION_0001;

const ALL_MIGRATIONS: &[&str] = &[
    MIGRATION_0001,
    MIGRATION_0002,
    MIGRATION_0003,
    MIGRATION_0004,
    MIGRATION_0005,
    MIGRATION_0006,
    MIGRATION_0007,
    MIGRATION_0008,
];

pub fn run_migrations(connection: &Connection) -> Result<(), String> {
    connection
        .execute_batch(
            "CREATE TABLE IF NOT EXISTS schema_migrations (
                version INTEGER PRIMARY KEY,
                applied_at TEXT NOT NULL
            );",
        )
        .map_err(|error| format!("Failed to initialize migration table: {error}"))?;

    for (index, sql) in ALL_MIGRATIONS.iter().enumerate() {
        let version = (index + 1) as i64;
        let already_applied = connection
            .query_row(
                "SELECT EXISTS(SELECT 1 FROM schema_migrations WHERE version = ?1)",
                [version],
                |row| row.get::<_, i64>(0),
            )
            .map_err(|error| format!("Failed to check migration {version}: {error}"))?
            != 0;

        if already_applied {
            continue;
        }

        connection
            .execute_batch(sql)
            .map_err(|error| format!("Failed to run migration {version}: {error}"))?;
        connection
            .execute(
                "INSERT INTO schema_migrations (version, applied_at)
                VALUES (?1, strftime('%s','now'))",
                [version],
            )
            .map_err(|error| format!("Failed to record migration {version}: {error}"))?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use rusqlite::Connection;

    use super::run_migrations;

    #[test]
    fn migrations_create_translation_title_column() {
        let connection = Connection::open_in_memory().expect("open in-memory database");
        run_migrations(&connection).expect("migrations run");

        let mut stmt = connection
            .prepare("PRAGMA table_info(article_translation_runs)")
            .expect("read table info");
        let columns = stmt
            .query_map([], |row| row.get::<_, String>(1))
            .expect("map columns")
            .collect::<Result<Vec<_>, _>>()
            .expect("collect columns");

        assert!(columns.iter().any(|column| column == "translated_title"));
    }

    #[test]
    fn migrations_create_article_list_performance_indexes() {
        let connection = Connection::open_in_memory().expect("open in-memory database");
        run_migrations(&connection).expect("migrations run");

        let mut stmt = connection
            .prepare("PRAGMA index_list(articles)")
            .expect("read article indexes");
        let indexes = stmt
            .query_map([], |row| row.get::<_, String>(1))
            .expect("map indexes")
            .collect::<Result<Vec<_>, _>>()
            .expect("collect indexes");

        assert!(indexes
            .iter()
            .any(|index| index == "idx_articles_feed_read_published"));
        assert!(indexes
            .iter()
            .any(|index| index == "idx_articles_favorite_published"));
        assert!(indexes
            .iter()
            .any(|index| index == "idx_articles_read_published"));
    }
}
