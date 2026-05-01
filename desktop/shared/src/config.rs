use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum ControlMode {
    Flexible,
    Locked,
    Hardcore,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct FrictionConfig {
    pub countdown_seconds: u32,
    pub click_count: u32,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct DesktopConfig {
    pub schema_version: u32,
    pub adult_blocking_enabled: bool,
    pub included_domains: Vec<String>,
    pub excluded_domains: Vec<String>,
    pub keywords: Vec<String>,
    pub blocked_apps: Vec<BlockedAppRule>,
    pub control_mode: ControlMode,
    pub friction: FrictionConfig,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct BlockedAppRule {
    pub name: String,
    pub executable: String,
    pub full_path: Option<String>,
}

pub fn default_config() -> DesktopConfig {
    DesktopConfig {
        schema_version: 1,
        adult_blocking_enabled: true,
        included_domains: Vec::new(),
        excluded_domains: Vec::new(),
        keywords: Vec::new(),
        blocked_apps: Vec::new(),
        control_mode: ControlMode::Flexible,
        friction: FrictionConfig {
            countdown_seconds: 60,
            click_count: 50,
        },
    }
}

pub fn default_config_path() -> PathBuf {
    if let Ok(program_data) = std::env::var("PROGRAMDATA") {
        return PathBuf::from(program_data).join("LibreAscent").join("config.json");
    }

    PathBuf::from("LibreAscent").join("config.json")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_config_uses_schema_version_one() {
        let config = default_config();

        assert_eq!(config.schema_version, 1);
        assert!(config.adult_blocking_enabled);
        assert_eq!(config.control_mode, ControlMode::Flexible);
        assert_eq!(config.friction.countdown_seconds, 60);
        assert_eq!(config.friction.click_count, 50);
    }

    #[test]
    fn default_config_path_ends_with_libreascent_config_json() {
        let path = default_config_path();
        let text = path.to_string_lossy();

        assert!(text.ends_with("LibreAscent\\config.json") || text.ends_with("LibreAscent/config.json"));
    }
}
