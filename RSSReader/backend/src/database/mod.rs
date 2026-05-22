use rusqlite::Connection;

pub const MIGRATION_0001: &str =
    include_str!("../../../db/migrations/0001_create_feeds_and_articles.sql");
pub const MIGRATION_0002: &str =
    include_str!("../../../db/migrations/0002_ai_providers_models.sql");
pub const MIGRATION_0003: &str = include_str!("../../../db/migrations/0003_tags.sql");
pub const MIGRATION_0004: &str =
    include_str!("../../../db/migrations/0004_ai_results_usage.sql");

/// Legacy alias used by feed repository.
pub const INITIAL_MIGRATION: &str = MIGRATION_0001;

const ALL_MIGRATIONS: &[&str] = &[
    MIGRATION_0001,
    MIGRATION_0002,
    MIGRATION_0003,
    MIGRATION_0004,
];

pub fn run_migrations(connection: &Connection) -> Result<(), String> {
    for (index, sql) in ALL_MIGRATIONS.iter().enumerate() {
        connection
            .execute_batch(sql)
            .map_err(|error| format!("Failed to run migration {}: {error}", index + 1))?;
    }
    Ok(())
}
