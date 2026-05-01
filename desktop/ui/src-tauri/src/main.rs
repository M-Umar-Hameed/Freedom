use libreascent_shared::config::default_config_path;
use serde::Serialize;
use std::process::Command;
use std::path::PathBuf;
use is_elevated::is_elevated;
use windows_service::service::{ServiceAccess, ServiceState};
use windows_service::service_manager::{ServiceManager, ServiceManagerAccess};

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct DesktopStatus {
    service_installed: bool,
    service_running: bool,
    dns_proxy_running: bool,
    config_path: String,
    is_admin: bool,
}

fn get_service_path() -> PathBuf {
    let mut path = std::env::current_exe().unwrap();
    path.pop(); // remove current exe name
    
    let mut service_exe = path.join("libreascent-service.exe");
    if !service_exe.exists() {
        // Try looking in the workspace target dir if in dev
        service_exe = path.join("..").join("..").join("target").join("debug").join("libreascent-service.exe");
    }
    service_exe
}

fn run_service_command(verb: &str) -> Result<(), String> {
    let service_path = get_service_path();
    if !service_path.exists() {
        return Err(format!("Service binary not found at {}", service_path.display()));
    }

    if is_elevated() {
        let status = Command::new(&service_path)
            .arg(verb)
            .status()
            .map_err(|e| e.to_string())?;
        
        if status.success() {
            Ok(())
        } else {
            Err(format!("Command {} failed with exit code {:?}", verb, status.code()))
        }
    } else {
        // Trigger UAC
        let status = runas::Command::new(&service_path)
            .arg(verb)
            .status()
            .map_err(|e| e.to_string())?;

        if status.success() {
            Ok(())
        } else {
            Err(format!("Elevated command {} failed with exit code {:?}", verb, status.code()))
        }
    }
}

#[tauri::command]
fn get_status() -> DesktopStatus {
    let service_name = "LibreAscentService";
    let mut installed = false;
    let mut running = false;

    if let Ok(manager) = ServiceManager::local_computer(
        None::<&str>,
        ServiceManagerAccess::CONNECT,
    ) {
        if let Ok(service) = manager.open_service(
            service_name,
            ServiceAccess::QUERY_STATUS,
        ) {
            installed = true;
            if let Ok(status) = service.query_status() {
                running = status.current_state == ServiceState::Running;
            }
        }
    }

    DesktopStatus {
        service_installed: installed,
        service_running: running,
        dns_proxy_running: running,
        config_path: default_config_path().to_string_lossy().to_string(),
        is_admin: is_elevated(),
    }
}

#[tauri::command]
fn install_service() -> Result<(), String> {
    run_service_command("install")
}

#[tauri::command]
fn uninstall_service() -> Result<(), String> {
    run_service_command("uninstall")
}

#[tauri::command]
fn start_service() -> Result<(), String> {
    run_service_command("start")
}

#[tauri::command]
fn stop_service() -> Result<(), String> {
    run_service_command("stop")
}

#[tauri::command]
fn test_domain(domain: String) -> bool {
    let blocklist = libreascent_shared::config::load_blocklist(&default_config_path());
    blocklist.is_blocked(&domain)
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            get_status,
            test_domain,
            install_service,
            uninstall_service,
            start_service,
            stop_service
        ])
        .run(tauri::generate_context!())
        .expect("failed to run LibreAscent Desktop");
}
