//! Local API key storage (outside SQLite).
//!
//! TODO: Replace file-based placeholder with OS keychain (`keyring` crate) before release.

use std::fs;
use std::path::PathBuf;

use super::error::{AiError, AiResult};

pub struct SecretStore;

impl SecretStore {
    pub fn save_provider_key(provider_id: &str, api_key: &str) -> AiResult<()> {
        let path = provider_key_path(provider_id)?;
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)
                .map_err(|error| AiError::Provider(format!("Failed to create secrets dir: {error}")))?;
        }
        fs::write(&path, api_key.trim())
            .map_err(|error| AiError::Provider(format!("Failed to write API key: {error}")))?;
        Ok(())
    }

    pub fn load_provider_key(provider_id: &str) -> AiResult<Option<String>> {
        let path = provider_key_path(provider_id)?;
        if !path.exists() {
            return Ok(None);
        }
        let value = fs::read_to_string(&path)
            .map_err(|error| AiError::Provider(format!("Failed to read API key: {error}")))?;
        Ok(Some(value.trim().to_string()))
    }

    pub fn delete_provider_key(provider_id: &str) -> AiResult<()> {
        let path = provider_key_path(provider_id)?;
        if path.exists() {
            fs::remove_file(&path)
                .map_err(|error| AiError::Provider(format!("Failed to delete API key: {error}")))?;
        }
        Ok(())
    }
}

fn provider_key_path(provider_id: &str) -> AiResult<PathBuf> {
    let root = secrets_root()?;
    Ok(root.join(format!("{provider_id}.key")))
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
