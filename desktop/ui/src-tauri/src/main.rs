#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use is_elevated::is_elevated;
use libreascent_shared::config::{default_config_path, load_or_create, save, DesktopConfig};
use serde::Serialize;
use std::path::{Path, PathBuf};
use std::process::Command;
use tauri::{Emitter, Manager};
use tokio::net::UdpSocket;
use windows_service::service::{ServiceAccess, ServiceState};
use windows_service::service_manager::{ServiceManager, ServiceManagerAccess};

#[cfg(windows)]
use std::os::windows::process::CommandExt;

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x08000000;

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
    let mut resource_dirs = Vec::new();
    if let Ok(resource_dir) = handle.path().resource_dir() {
        resource_dirs.push(resource_dir);
    }

    let mut path = std::env::current_exe().unwrap();
    path.pop(); // remove current exe name
    resource_dirs.push(path.clone());

    let service_path = resolve_service_path_from_candidates(&resource_dirs, &path, &|candidate| {
        is_runnable_windows_executable(candidate)
    });

    if service_path.extension().and_then(|ext| ext.to_str()) == Some("bin") {
        let copied_service_path = default_config_path()
            .parent()
            .unwrap()
            .join("libreascent-service.exe");
        if let Some(parent) = copied_service_path.parent() {
            let _ = std::fs::create_dir_all(parent);
        }
        return materialize_service_path(
            &service_path,
            &copied_service_path,
            &|source, destination| std::fs::copy(source, destination),
            &|candidate| is_runnable_windows_executable(candidate),
        );
    }

    service_path
}

fn materialize_service_path<C, F>(
    service_path: &Path,
    copied_service_path: &Path,
    copy: &C,
    is_runnable_candidate: &F,
) -> PathBuf
where
    C: Fn(&Path, &Path) -> std::io::Result<u64>,
    F: Fn(&Path) -> bool,
{
    if service_path.extension().and_then(|ext| ext.to_str()) != Some("bin") {
        return service_path.to_path_buf();
    }

    if copy(service_path, copied_service_path).is_ok() || is_runnable_candidate(copied_service_path)
    {
        return copied_service_path.to_path_buf();
    }

    copied_service_path.to_path_buf()
}

fn resolve_service_path_from_candidates<F>(
    resource_dirs: &[PathBuf],
    exe_dir: &Path,
    is_runnable_candidate: &F,
) -> PathBuf
where
    F: Fn(&Path) -> bool,
{
    for resource_dir in resource_dirs {
        let bundled = resource_dir.join("bin").join("libreascent-service.bin");
        if is_runnable_candidate(&bundled) {
            return bundled;
        }
    }

    let side_by_side = exe_dir.join("libreascent-service.exe");
    if is_runnable_candidate(&side_by_side) {
        return side_by_side;
    }

    if is_dev_exe_dir(exe_dir) {
        let dev_service = exe_dir
            .join("..")
            .join("..")
            .join("target")
            .join("debug")
            .join("libreascent-service.exe");
        if is_runnable_candidate(&dev_service) {
            return dev_service;
        }
    }

    side_by_side
}

fn is_runnable_windows_executable(path: &Path) -> bool {
    std::fs::read(path)
        .map(|bytes| has_windows_exe_header(&bytes))
        .unwrap_or(false)
}

fn has_windows_exe_header(bytes: &[u8]) -> bool {
    bytes.starts_with(b"MZ")
}

fn is_dev_exe_dir(exe_dir: &Path) -> bool {
    exe_dir
        .ancestors()
        .any(|path| path.file_name().and_then(|name| name.to_str()) == Some("src-tauri"))
}

fn run_hidden_command(service_path: &Path, verb: &str) -> Result<std::process::ExitStatus, String> {
    let mut command = Command::new(service_path);
    command.arg(verb);

    #[cfg(windows)]
    command.creation_flags(CREATE_NO_WINDOW);

    command.status().map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn resolves_installed_resource_next_to_exe_before_dev_fallback() {
        let exe_dir = PathBuf::from(r"C:\Program Files\LibreAscent Desktop");
        let resource_dirs = vec![exe_dir.clone()];
        let dev_target =
            PathBuf::from(r"F:\Github\LibreAscent\desktop\target\debug\libreascent-service.exe");
        let exists = |path: &std::path::Path| {
            path == exe_dir.join("bin").join("libreascent-service.bin")
                || path == dev_target.as_path()
        };

        let path = resolve_service_path_from_candidates(&resource_dirs, &exe_dir, &exists);

        assert_eq!(path, exe_dir.join("bin").join("libreascent-service.bin"));
    }

    #[test]
    fn installed_app_does_not_return_relative_workspace_debug_path() {
        let exe_dir = PathBuf::from(r"C:\Program Files\LibreAscent Desktop");
        let resource_dirs = Vec::new();
        let exists = |_path: &std::path::Path| false;

        let path = resolve_service_path_from_candidates(&resource_dirs, &exe_dir, &exists);

        assert_ne!(
            path,
            exe_dir
                .join("..")
                .join("..")
                .join("target")
                .join("debug")
                .join("libreascent-service.exe")
        );
    }

    #[test]
    fn rejects_placeholder_service_resource() {
        assert!(!has_windows_exe_header(
            b"Placeholder for Tauri resource checks in debug builds."
        ));
    }

    #[test]
    fn accepts_windows_executable_resource() {
        assert!(has_windows_exe_header(b"MZ"));
    }

    #[test]
    fn uses_existing_copied_service_when_bundled_copy_fails() {
        let bundled =
            PathBuf::from(r"C:\Program Files\LibreAscent Desktop\bin\libreascent-service.bin");
        let copied =
            PathBuf::from(r"C:\Users\Admin\AppData\Roaming\LibreAscent\libreascent-service.exe");
        let copy = |_source: &Path, _destination: &Path| {
            Err(std::io::Error::new(
                std::io::ErrorKind::PermissionDenied,
                "service exe is locked",
            ))
        };
        let is_runnable = |path: &Path| path == copied.as_path();

        let path = materialize_service_path(&bundled, &copied, &copy, &is_runnable);

        assert_eq!(path, copied);
    }
}

fn service_state() -> (bool, bool) {
    let service_name = "LibreAscentService";
    let mut installed = false;
    let mut running = false;

    if let Ok(manager) = ServiceManager::local_computer(None::<&str>, ServiceManagerAccess::CONNECT)
    {
        if let Ok(service) = manager.open_service(service_name, ServiceAccess::QUERY_STATUS) {
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
        return Err(format!(
            "Service binary not found at {}",
            service_path.display()
        ));
    }

    if is_elevated() {
        let status = run_hidden_command(&service_path, verb)?;

        if status.success() {
            Ok(())
        } else {
            Err(format!(
                "Command {} failed with exit code {:?}",
                verb,
                status.code()
            ))
        }
    } else {
        // Trigger UAC
        let status = runas::Command::new(&service_path)
            .arg(verb)
            .show(false)
            .status()
            .map_err(|e| e.to_string())?;

        if status.success() {
            Ok(())
        } else {
            Err(format!(
                "Elevated command {} failed with exit code {:?}",
                verb,
                status.code()
            ))
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

#[tauri::command]
fn hide_overlay(handle: tauri::AppHandle) {
    if let Some(window) = handle.get_webview_window("overlay") {
        let _ = window.hide();
    }
}

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            let handle = app.handle().clone();
            std::thread::spawn(move || {
                let rt = tokio::runtime::Builder::new_current_thread()
                    .enable_all()
                    .build()
                    .unwrap();
                
                rt.block_on(async move {
                    let socket_res = UdpSocket::bind("127.0.0.1:13370").await;
                    if let Ok(socket) = socket_res {
                        let mut buffer = [0u8; 1024];
                        loop {
                            if let Ok((size, _)) = socket.recv_from(&mut buffer).await {
                                let msg = String::from_utf8_lossy(&buffer[..size]);
                                if msg.starts_with("block:") {
                                    let _ = handle.emit("block-event", msg);
                                    if let Some(window) = handle.get_webview_window("overlay") {
                                        let _ = window.show();
                                        let _ = window.set_focus();
                                    }
                                }
                            }
                        }
                    }
                });
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
            show_overlay,
            hide_overlay
        ])
        .run(tauri::generate_context!())
        .expect("failed to run LibreAscent Desktop");
}
