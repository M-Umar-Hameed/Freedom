use anyhow::{Context, Result};
use libreascent_shared::config::{default_config, DesktopConfig};
use std::fs;
use std::path::Path;

pub fn load_or_create(path: &Path) -> Result<DesktopConfig> {
    if path.exists() {
        let text = fs::read_to_string(path)
            .with_context(|| format!("failed to read config {}", path.display()))?;
        let config = serde_json::from_str(&text)
            .with_context(|| format!("failed to parse config {}", path.display()))?;
        return Ok(config);
    }

    let config = default_config();
    save(path, &config)?;
    Ok(config)
}

pub fn save(path: &Path, config: &DesktopConfig) -> Result<()> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .with_context(|| format!("failed to create config directory {}", parent.display()))?;
    }

    let text = serde_json::to_string_pretty(config).context("failed to serialize config")?;
    fs::write(path, text).with_context(|| format!("failed to write config {}", path.display()))?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    #[test]
    fn creates_default_config_when_missing() {
        let path = temp_path("missing-config.json");

        let config = load_or_create(&path).expect("config should be created");

        assert_eq!(config.schema_version, 1);
        assert!(path.exists());
        let _ = fs::remove_file(path);
    }

    #[test]
    fn loads_existing_config() {
        let path = temp_path("existing-config.json");
        let mut config = default_config();
        config.included_domains = vec!["example.com".to_string()];
        save(&path, &config).expect("config should save");

        let loaded = load_or_create(&path).expect("config should load");

        assert_eq!(loaded.included_domains, vec!["example.com"]);
        let _ = fs::remove_file(path);
    }

    fn temp_path(name: &str) -> std::path::PathBuf {
        let suffix = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("clock should work")
            .as_nanos();
        std::env::temp_dir().join(format!("libreascent-{suffix}-{name}"))
    }
}
