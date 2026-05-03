use libreascent_shared::config::{default_config_path, DesktopConfig, load_or_create, save};
use serde::Serialize;
use std::process::Command;
use std::path::PathBuf;
use is_elevated::is_elevated;
use windows_service::service::{ServiceAccess, ServiceState};
use windows_service::service_manager::{ServiceManager, ServiceManagerAccess};
use tauri::{Emitter, Manager};
use tokio::net::UdpSocket;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct DesktopStatus {
    service_installed: bool,
    service_running: bool,
    dns_proxy_running: bool,
    dns_controlled: bool,
    config_path: String,
    is_admin: bool,
}

fn check_dns_control() -> bool {
    let output = Command::new("netsh")
        .args(&["interface", "ipv4", "show", "dnsservers"])
        .output();
    
    if let Ok(output) = output {
        let stdout = String::from_utf8_lossy(&output.stdout);
        stdout.contains("127.0.0.1")
    } else {
        false
    }
}

fn get_service_path(handle: &tauri::AppHandle) -> PathBuf {
    if let Ok(resource_dir) = handle.path().resource_dir() {
        let bundled = resource_dir.join("bin").join("libreascent-service.bin");
        if bundled.exists() {
            let service_path = default_config_path()
                .parent()
                .unwrap()
                .join("libreascent-service.exe");
            if let Some(parent) = service_path.parent() {
                let _ = std::fs::create_dir_all(parent);
            }
            if std::fs::copy(&bundled, &service_path).is_ok() {
                return service_path;
            }
        }
    }

    let mut path = std::env::current_exe().unwrap();
    path.pop(); // remove current exe name
    
    let mut service_exe = path.join("libreascent-service.exe");
    if !service_exe.exists() {
        // Try looking in the workspace target dir if in dev
        service_exe = path.join("..").join("..").join("target").join("debug").join("libreascent-service.exe");
    }
    service_exe
}

fn service_state() -> (bool, bool) {
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

    (installed, running)
}

fn run_service_command(handle: &tauri::AppHandle, verb: &str) -> Result<(), String> {
    let service_path = get_service_path(handle);
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
    let (installed, running) = service_state();

    DesktopStatus {
        service_installed: installed,
        service_running: running,
        dns_proxy_running: running,
        dns_controlled: check_dns_control(),
        config_path: default_config_path().to_string_lossy().to_string(),
        is_admin: is_elevated(),
    }
}

#[tauri::command]
fn get_config() -> Result<DesktopConfig, String> {
    load_or_create(&default_config_path()).map_err(|e| e.to_string())
}

#[tauri::command]
fn update_config(config: DesktopConfig) -> Result<(), String> {
    save(&default_config_path(), &config).map_err(|e| e.to_string())
}

#[tauri::command]
fn install_service(handle: tauri::AppHandle) -> Result<(), String> {
    run_service_command(&handle, "install")
}

#[tauri::command]
fn uninstall_service(handle: tauri::AppHandle) -> Result<(), String> {
    run_service_command(&handle, "uninstall")
}

#[tauri::command]
fn start_service(handle: tauri::AppHandle) -> Result<(), String> {
    run_service_command(&handle, "start")
}

#[tauri::command]
fn stop_service(handle: tauri::AppHandle) -> Result<(), String> {
    run_service_command(&handle, "stop")
}

#[tauri::command]
fn enable_dns_protection(handle: tauri::AppHandle) -> Result<(), String> {
    let (_, running) = service_state();
    if !running {
        return Err("Start the service before enabling DNS protection.".to_string());
    }

    run_service_command(&handle, "set-dns")
}

#[tauri::command]
fn reset_dns(handle: tauri::AppHandle) -> Result<(), String> {
    run_service_command(&handle, "reset-dns")
}

#[tauri::command]
fn repair_service(handle: tauri::AppHandle) -> Result<(), String> {
    let _ = run_service_command(&handle, "stop");
    let _ = run_service_command(&handle, "uninstall");
    run_service_command(&handle, "install")?;
    run_service_command(&handle, "start")
}

#[tauri::command]
fn test_domain(domain: String) -> bool {
    let blocklist = libreascent_shared::config::load_blocklist(&default_config_path());
    blocklist.is_blocked(&domain)
}

#[tauri::command]
fn show_overlay(handle: tauri::AppHandle) {
    if let Some(window) = handle.get_webview_window("overlay") {
        let _ = window.show();
        let _ = window.set_focus();
    }
}

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                let socket_res: Result<UdpSocket, std::io::Error> = UdpSocket::bind("127.0.0.1:13370").await;
                if let Ok(socket) = socket_res {
                    let mut buffer = [0u8; 1024];
                    loop {
                        if let Ok((size, _)) = socket.recv_from(&mut buffer).await {
                            let msg = String::from_utf8_lossy(&buffer[..size]);
                            if msg.starts_with("block:") {
                                let _ = handle.emit("block-event", msg);
                                // Show overlay window automatically
                                if let Some(window) = handle.get_webview_window("overlay") {
                                    let _ = window.show();
                                    let _ = window.set_focus();
                                }
                            }
                        }
                    }
                }
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_status,
            test_domain,
            install_service,
            uninstall_service,
            start_service,
            stop_service,
            enable_dns_protection,
            reset_dns,
            repair_service,
            get_config,
            update_config,
            show_overlay
        ])
        .run(tauri::generate_context!())
        .expect("failed to run LibreAscent Desktop");
}
