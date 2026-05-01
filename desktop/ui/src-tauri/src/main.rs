use libreascent_shared::config::default_config_path;
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
    let blocklist = libreascent_shared::config::load_blocklist(&default_config_path());
    blocklist.is_blocked(&domain)
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![get_status, test_domain])
        .run(tauri::generate_context!())
        .expect("failed to run LibreAscent Desktop");
}
