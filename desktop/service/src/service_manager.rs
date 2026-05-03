use std::ffi::OsString;
use std::time::Duration;
use tokio::sync::oneshot;
use windows_service::{
    define_windows_service,
    service::{
        ServiceAccess, ServiceControl, ServiceControlAccept, ServiceErrorControl, ServiceExitCode,
        ServiceInfo, ServiceStartType, ServiceState, ServiceStatus, ServiceType,
    },
    service_control_handler::{self, ServiceControlHandlerResult},
    service_manager::{ServiceManager, ServiceManagerAccess},
};

pub const SERVICE_NAME: &str = "LibreAscentService";
pub const SERVICE_DISPLAY_NAME: &str = "LibreAscent Background Service";

define_windows_service!(ffi_service_main, libre_ascent_service_main);

enum ServiceEvent {
    StopRequested,
    DnsProxyStopped,
}

pub fn run_service() -> anyhow::Result<()> {
    windows_service::service_dispatcher::start(SERVICE_NAME, ffi_service_main)?;
    Ok(())
}

fn libre_ascent_service_main(_arguments: Vec<OsString>) {
    if let Err(e) = run_service_loop() {
        crate::dns_manager::log_tamper_event(&format!("Service loop failed: {e}"));
    }
}

fn run_service_loop() -> anyhow::Result<()> {
    crate::dns_manager::log_tamper_event("Service starting...");
    let (tx, mut rx) = tokio::sync::mpsc::channel(1);
    let control_tx = tx.clone();

    let event_handler = move |control_event| -> ServiceControlHandlerResult {
        match control_event {
            ServiceControl::Stop => {
                let _ = control_tx.blocking_send(ServiceEvent::StopRequested);
                ServiceControlHandlerResult::NoError
            }
            ServiceControl::Interrogate => ServiceControlHandlerResult::NoError,
            _ => ServiceControlHandlerResult::NotImplemented,
        }
    };

    let status_handle = service_control_handler::register(SERVICE_NAME, event_handler)?;

    status_handle.set_service_status(ServiceStatus {
        service_type: ServiceType::OWN_PROCESS,
        current_state: ServiceState::Running,
        controls_accepted: ServiceControlAccept::STOP,
        exit_code: ServiceExitCode::Win32(0),
        checkpoint: 0,
        wait_hint: Duration::default(),
        process_id: None,
    })?;

    let rt = tokio::runtime::Runtime::new()?;
    rt.block_on(async {
        let config_path = libreascent_shared::config::default_config_path();
        let (ready_tx, ready_rx) = oneshot::channel();
        let dns_exit_tx = tx.clone();

        let dns_task = tokio::spawn(async move {
            let result = crate::dns::run_local_dns_proxy_with_ready(
                config_path.clone(),
                "127.0.0.1:53",
                Some(ready_tx),
            )
            .await;

            if let Err(e) = result {
                crate::dns_manager::log_tamper_event(&format!("DNS proxy stopped with error: {e}"));
            } else {
                crate::dns_manager::log_tamper_event("DNS proxy stopped gracefully.");
            }
            let _ = dns_exit_tx.send(ServiceEvent::DnsProxyStopped).await;
        });

        let mut enforce_task = None;
        let dns_proxy_ready = matches!(ready_rx.await, Ok(Ok(())));
        if dns_proxy_ready {
            let _ = crate::dns_manager::enforce_system_dns("127.0.0.1");

            enforce_task = Some(tokio::spawn(async move {
                let mut interval = tokio::time::interval(Duration::from_secs(2));
                loop {
                    interval.tick().await;
                    if let Err(e) = crate::dns_manager::enforce_system_dns("127.0.0.1") {
                        crate::dns_manager::log_tamper_event(&format!(
                            "DNS enforcement failed: {e}"
                        ));
                    }
                }
            }));
        } else {
            crate::dns_manager::log_tamper_event(
                "DNS proxy did not start. DNS settings were not changed.",
            );
        }

        // Start App blocker
        let blocker_task = tokio::spawn(async move {
            let mut interval = tokio::time::interval(Duration::from_secs(1));
            let broadcast_socket = tokio::net::UdpSocket::bind("127.0.0.1:0").await.ok();

            loop {
                interval.tick().await;
                let config_path = libreascent_shared::config::default_config_path();
                if let Ok(config) = libreascent_shared::config::load_or_create(&config_path) {
                    let blocked = crate::process_manager::check_and_block_apps(&config);

                    if blocked {
                        if let Some(ref socket) = broadcast_socket {
                            let _ = socket.send_to(b"block:app", "127.0.0.1:13370").await;
                        }
                    }
                }
            }
        });

        // Wait for stop signal or DNS proxy failure. The service must not keep
        // enforcing 127.0.0.1 when the local DNS proxy is gone.
        let event = rx.recv().await;

        // Stop all background tasks before resetting DNS
        if let Some(handle) = enforce_task {
            handle.abort();
        }
        blocker_task.abort();
        dns_task.abort();

        // Reset system DNS on stop, unless Hardcore
        let config_path = libreascent_shared::config::default_config_path();
        let config = libreascent_shared::config::load_or_create(&config_path).ok();
        let is_hardcore = config
            .map(|c| c.control_mode == libreascent_shared::config::ControlMode::Hardcore)
            .unwrap_or(false);

        if !is_hardcore {
            let _ = crate::dns_manager::reset_system_dns();
        } else if matches!(event, Some(ServiceEvent::DnsProxyStopped)) {
            crate::dns_manager::log_tamper_event(
                "DNS proxy stopped in Hardcore mode. DNS NOT reset.",
            );
        } else {
            crate::dns_manager::log_tamper_event(
                "Service stopped in Hardcore mode. DNS NOT reset.",
            );
        }
    });

    status_handle.set_service_status(ServiceStatus {
        service_type: ServiceType::OWN_PROCESS,
        current_state: ServiceState::Stopped,
        controls_accepted: ServiceControlAccept::empty(),
        exit_code: ServiceExitCode::Win32(0),
        checkpoint: 0,
        wait_hint: Duration::default(),
        process_id: None,
    })?;

    Ok(())
}

pub fn install_service() -> anyhow::Result<()> {
    let manager = ServiceManager::local_computer(
        None::<&str>,
        ServiceManagerAccess::CONNECT | ServiceManagerAccess::CREATE_SERVICE,
    )?;
    let exe_path = std::env::current_exe()?;

    let info = ServiceInfo {
        name: OsString::from(SERVICE_NAME),
        display_name: OsString::from(SERVICE_DISPLAY_NAME),
        service_type: ServiceType::OWN_PROCESS,
        start_type: ServiceStartType::AutoStart,
        error_control: ServiceErrorControl::Normal,
        executable_path: exe_path,
        launch_arguments: vec![OsString::from("service-run")],
        dependencies: Vec::new(),
        account_name: None,
        account_password: None,
    };

    let _service = manager.create_service(&info, ServiceAccess::QUERY_STATUS)?;

    Ok(())
}

pub fn uninstall_service() -> anyhow::Result<()> {
    let _ = crate::dns_manager::reset_system_dns();

    let manager = ServiceManager::local_computer(None::<&str>, ServiceManagerAccess::CONNECT)?;
    let service = manager.open_service(
        SERVICE_NAME,
        ServiceAccess::QUERY_STATUS | ServiceAccess::STOP | ServiceAccess::DELETE,
    )?;

    let status = service.query_status()?;
    if status.current_state != ServiceState::Stopped {
        println!("Stopping service before uninstall...");
        let _ = service.stop();
        // Give it a moment to stop
        std::thread::sleep(Duration::from_secs(2));
    }

    service.delete()?;
    let _ = crate::dns_manager::reset_system_dns();
    Ok(())
}

pub fn start_service() -> anyhow::Result<()> {
    let manager = ServiceManager::local_computer(None::<&str>, ServiceManagerAccess::CONNECT)?;
    let service = manager.open_service(SERVICE_NAME, ServiceAccess::START)?;
    service.start(&Vec::<OsString>::new())?;
    Ok(())
}

pub fn stop_service() -> anyhow::Result<()> {
    let manager = ServiceManager::local_computer(None::<&str>, ServiceManagerAccess::CONNECT)?;
    let service = manager.open_service(
        SERVICE_NAME,
        ServiceAccess::STOP | ServiceAccess::QUERY_STATUS,
    )?;
    service.stop()?;
    Ok(())
}
