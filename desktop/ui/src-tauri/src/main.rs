use libreascent_shared::blocklist::DomainBlocklist;
use libreascent_shared::config::{default_config, default_config_path};
use serde::Serialize;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct DesktopStatus {
    service_installed: bool,
    service_running: bool,
    dns_proxy_running: bool,
    config_path: String,
}

#[tauri::command]
fn get_status() -> DesktopStatus {
    DesktopStatus {
        service_installed: false,
        service_running: false,
        dns_proxy_running: false,
        config_path: default_config_path().to_string_lossy().to_string(),
    }
}

#[tauri::command]
fn test_domain(domain: String) -> bool {
    let config = default_config();
    let blocklist = DomainBlocklist::new(config.included_domains, config.excluded_domains);
    blocklist.is_blocked(&domain)
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![get_status, test_domain])
        .run(tauri::generate_context!())
        .expect("failed to run LibreAscent Desktop");
}
