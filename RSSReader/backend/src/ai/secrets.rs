//! Local API key storage (outside SQLite) via the OS credential store.

use std::fs;
use std::path::{Path, PathBuf};
use std::sync::OnceLock;

use keyring::Entry;

use super::error::{AiError, AiResult};

const KEYRING_SERVICE: &str = "com.rssreader.vortex";
const MIGRATION_MARKER: &str = ".keyring-migrated";
const MIGRATION_MARKER_CONTENT: &str = "migrated-to-keyring-native-v1\n";

static LEGACY_MIGRATION: OnceLock<Result<(), AiError>> = OnceLock::new();

pub struct SecretStore;

impl SecretStore {
    pub fn save_provider_key(provider_id: &str, api_key: &str) -> AiResult<()> {
        ensure_legacy_migrated()?;

        let trimmed = api_key.trim();
        if trimmed.is_empty() {
            return Err(AiError::InvalidInput(
                "API key cannot be empty".to_string(),
            ));
        }

        keyring_entry(provider_id)?
            .set_password(trimmed)
            .map_err(map_keyring_error)?;
        delete_legacy_key_file(provider_id)?;
        Ok(())
    }

    pub fn load_provider_key(provider_id: &str) -> AiResult<Option<String>> {
        ensure_legacy_migrated()?;

        match keyring_entry(provider_id)?.get_password() {
            Ok(value) => Ok(Some(value.trim().to_string())),
            Err(keyring::Error::NoEntry) => load_legacy_provider_key(provider_id),
            Err(error) => Err(map_keyring_error(error)),
        }
    }

    pub fn delete_provider_key(provider_id: &str) -> AiResult<()> {
        ensure_legacy_migrated()?;

        match keyring_entry(provider_id)?.delete_credential() {
            Ok(()) | Err(keyring::Error::NoEntry) => {}
            Err(error) => return Err(map_keyring_error(error)),
        }
        delete_legacy_key_file(provider_id)?;
        Ok(())
    }
}

fn ensure_legacy_migrated() -> AiResult<()> {
    match LEGACY_MIGRATION.get_or_init(migrate_legacy_secrets) {
        Ok(()) => Ok(()),
        Err(error) => Err(error.clone()),
    }
}

fn migrate_legacy_secrets() -> Result<(), AiError> {
    let roots = migration_roots()?;
    if roots.iter().all(|root| migration_marker_valid(root)) {
        return Ok(());
    }

    for root in &roots {
        if !root.exists() {
            continue;
        }

        let entries = fs::read_dir(root).map_err(|error| {
            AiError::Provider(format!("Failed to read legacy secrets dir: {error}"))
        })?;

        for entry in entries {
            let entry = entry.map_err(|error| {
                AiError::Provider(format!("Failed to read legacy secrets entry: {error}"))
            })?;
            let path = entry.path();
            if !path.is_file() {
                continue;
            }

            let Some(provider_id) = legacy_provider_id_from_path(&path) else {
                continue;
            };
            let Some(api_key) = read_legacy_key_file(&path)? else {
                let _ = fs::remove_file(&path);
                continue;
            };

            if keyring_entry(&provider_id)?
                .get_password()
                .ok()
                .as_deref()
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .is_some()
            {
                let _ = fs::remove_file(&path);
                continue;
            }

            keyring_entry(&provider_id)?
                .set_password(&api_key)
                .map_err(map_keyring_error)?;
            let _ = fs::remove_file(&path);
        }

        write_migration_marker(root)?;
    }

    Ok(())
}

fn load_legacy_provider_key(provider_id: &str) -> AiResult<Option<String>> {
    for root in migration_roots()? {
        let path = root.join(format!("{provider_id}.key"));
        let Some(api_key) = read_legacy_key_file(&path)? else {
            continue;
        };

        keyring_entry(provider_id)?
            .set_password(&api_key)
            .map_err(map_keyring_error)?;
        let _ = fs::remove_file(&path);
        return Ok(Some(api_key));
    }

    Ok(None)
}

fn delete_legacy_key_file(provider_id: &str) -> AiResult<()> {
    for root in migration_roots()? {
        let path = root.join(format!("{provider_id}.key"));
        if path.exists() {
            fs::remove_file(&path).map_err(|error| {
                AiError::Provider(format!("Failed to delete legacy API key file: {error}"))
            })?;
        }
    }
    Ok(())
}

fn keyring_entry(provider_id: &str) -> AiResult<Entry> {
    Entry::new(KEYRING_SERVICE, provider_id).map_err(map_keyring_error)
}

fn migration_roots() -> AiResult<Vec<PathBuf>> {
    let mut roots = Vec::new();
    push_unique_path(&mut roots, secrets_root()?);

    if uses_tauri_data_dir() {
        if let Some(legacy_root) = legacy_dev_secrets_root() {
            push_unique_path(&mut roots, legacy_root);
        }
    }

    Ok(roots)
}

fn uses_tauri_data_dir() -> bool {
    std::env::var("RSSREADER_DATA_DIR")
        .map(|value| value.contains("com.rssreader.vortex"))
        .unwrap_or(false)
}

fn legacy_dev_secrets_root() -> Option<PathBuf> {
    if cfg!(windows) {
        std::env::var("APPDATA")
            .ok()
            .map(|value| PathBuf::from(value).join("RSSReader").join("secrets"))
    } else {
        std::env::var("HOME")
            .ok()
            .map(|value| PathBuf::from(value).join(".rssreader").join("secrets"))
    }
}

fn push_unique_path(roots: &mut Vec<PathBuf>, path: PathBuf) {
    if !roots.iter().any(|existing| existing == &path) {
        roots.push(path);
    }
}

fn read_legacy_key_file(path: &Path) -> AiResult<Option<String>> {
    if !path.exists() {
        return Ok(None);
    }

    let value = fs::read_to_string(path)
        .map_err(|error| AiError::Provider(format!("Failed to read legacy API key: {error}")))?;
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return Ok(None);
    }
    Ok(Some(trimmed.to_string()))
}

fn legacy_provider_id_from_path(path: &Path) -> Option<String> {
    let file_name = path.file_name()?.to_str()?;
    if !file_name.ends_with(".key") {
        return None;
    }
    let provider_id = file_name.trim_end_matches(".key");
    if provider_id.is_empty() || provider_id.starts_with('.') {
        return None;
    }
    Some(provider_id.to_string())
}

fn migration_marker_path(root: &Path) -> PathBuf {
    root.join(MIGRATION_MARKER)
}

fn migration_marker_valid(root: &Path) -> bool {
    fs::read_to_string(migration_marker_path(root))
        .ok()
        .as_deref()
        == Some(MIGRATION_MARKER_CONTENT)
}

fn write_migration_marker(root: &Path) -> AiResult<()> {
    if let Some(parent) = root.parent() {
        fs::create_dir_all(parent).map_err(|error| {
            AiError::Provider(format!("Failed to create secrets dir: {error}"))
        })?;
    }
    fs::create_dir_all(root).map_err(|error| {
        AiError::Provider(format!("Failed to create secrets dir: {error}"))
    })?;
    fs::write(migration_marker_path(root), MIGRATION_MARKER_CONTENT).map_err(|error| {
        AiError::Provider(format!("Failed to write keyring migration marker: {error}"))
    })?;
    Ok(())
}

fn secrets_root() -> AiResult<PathBuf> {
    let base = std::env::var("RSSREADER_DATA_DIR").unwrap_or_else(|_| {
        if cfg!(windows) {
            std::env::var("APPDATA")
                .map(|value| format!("{value}\\RSSReader"))
                .unwrap_or_else(|_| ".".to_string())
        } else {
            std::env::var("HOME")
                .map(|value| format!("{value}/.rssreader"))
                .unwrap_or_else(|_| ".".to_string())
        }
    });
    Ok(PathBuf::from(base).join("secrets"))
}

fn map_keyring_error(error: keyring::Error) -> AiError {
    AiError::Provider(format!("Keyring error: {error}"))
}

#[cfg(test)]
mod tests {
    use super::{
        legacy_provider_id_from_path, SecretStore, MIGRATION_MARKER, MIGRATION_MARKER_CONTENT,
    };

    #[test]
    fn legacy_provider_id_from_path_accepts_uuid_key_files() {
        let path = std::path::Path::new("secrets").join("8f1c2f3a-4b5d-6e7f-8a9b-0c1d2e3f4a5b.key");
        assert_eq!(
            legacy_provider_id_from_path(&path).as_deref(),
            Some("8f1c2f3a-4b5d-6e7f-8a9b-0c1d2e3f4a5b")
        );
    }

    #[test]
    fn legacy_provider_id_from_path_ignores_marker_and_non_key_files() {
        let marker = std::path::Path::new("secrets").join(MIGRATION_MARKER);
        let txt = std::path::Path::new("secrets").join("notes.txt");
        assert!(legacy_provider_id_from_path(&marker).is_none());
        assert!(legacy_provider_id_from_path(&txt).is_none());
    }

    #[test]
    fn migration_marker_requires_native_version() {
        assert_eq!(MIGRATION_MARKER_CONTENT, "migrated-to-keyring-native-v1\n");
    }

    #[test]
    fn keyring_roundtrip_persists_provider_key() {
        let provider_id = format!("test-provider-{}", uuid::Uuid::new_v4());
        let api_key = format!("sk-test-{}", uuid::Uuid::new_v4());

        SecretStore::save_provider_key(&provider_id, &api_key).expect("save provider key");
        let loaded = SecretStore::load_provider_key(&provider_id)
            .expect("load provider key")
            .expect("provider key should exist");
        assert_eq!(loaded, api_key);

        SecretStore::delete_provider_key(&provider_id).expect("delete provider key");
        assert!(SecretStore::load_provider_key(&provider_id)
            .expect("reload provider key")
            .is_none());
    }
}
