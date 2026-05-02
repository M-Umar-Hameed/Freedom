use std::ffi::OsString;
use std::time::Duration;
use std::path::PathBuf;
use windows_service::{
    define_windows_service,
    service::{
        ServiceControl, ServiceControlAccept, ServiceExitCode, ServiceState, ServiceStatus,
        ServiceType, ServiceInfo, ServiceStartType, ServiceErrorControl, ServiceAccess,
        ServiceDependency,
    },
    service_control_handler::{self, ServiceControlHandlerResult},
    service_manager::{ServiceManager, ServiceManagerAccess},
};

pub const SERVICE_NAME: &str = "LibreAscentService";
pub const SERVICE_DISPLAY_NAME: &str = "LibreAscent Background Service";

define_windows_service!(ffi_service_main, libre_ascent_service_main);

pub fn run_service() -> anyhow::Result<()> {
    windows_service::service_dispatcher::start(SERVICE_NAME, ffi_service_main)?;
    Ok(())
}

fn libre_ascent_service_main(_arguments: Vec<OsString>) {
    if let Err(_e) = run_service_loop() {
        // Log error?
    }
}

fn run_service_loop() -> anyhow::Result<()> {
    let (tx, mut rx) = tokio::sync::mpsc::channel(1);

    let event_handler = move |control_event| -> ServiceControlHandlerResult {
        match control_event {
            ServiceControl::Stop => {
                let _ = tx.blocking_send(());
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
        // Set system DNS
        if let Err(_e) = crate::dns_manager::set_system_dns("127.0.0.1") {
            // Log error
        }

        // Start DNS proxy in background
        let config_path = libreascent_shared::config::default_config_path();
        
        tokio::spawn(async move {
            if let Err(_e) = crate::dns::run_local_dns_proxy(config_path.clone(), "127.0.0.1:53").await {
                // Log error
            }
        });

        // Start DNS monitor
        tokio::spawn(async move {
            let mut interval = tokio::time::interval(Duration::from_secs(30));
            loop {
                interval.tick().await;
                match crate::dns_manager::is_dns_set_correctly("127.0.0.1") {
                    Ok(false) => {
                        crate::dns_manager::log_tamper_event("DNS settings tampered. Restoring...");
                        let _ = crate::dns_manager::set_system_dns("127.0.0.1");
                    }
                    Err(_e) => {
                        // Log error
                    }
                    _ => {}
                }
            }
        });

        // Start App blocker
        tokio::spawn(async move {
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

        // Wait for stop signal
        rx.recv().await;

        // Reset system DNS on stop, unless Hardcore
        let config_path = libreascent_shared::config::default_config_path();
        let config = libreascent_shared::config::load_or_create(&config_path).ok();
        let is_hardcore = config.map(|c| c.control_mode == libreascent_shared::config::ControlMode::Hardcore).unwrap_or(false);

        if !is_hardcore {
            let _ = crate::dns_manager::reset_system_dns();
        } else {
            crate::dns_manager::log_tamper_event("Service stopped in Hardcore mode. DNS NOT reset.");
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
    let manager = ServiceManager::local_computer(None::<&str>, ServiceManagerAccess::CONNECT | ServiceManagerAccess::CREATE_SERVICE)?;
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
    let manager = ServiceManager::local_computer(None::<&str>, ServiceManagerAccess::CONNECT)?;
    let service = manager.open_service(SERVICE_NAME, ServiceAccess::QUERY_STATUS | ServiceAccess::DELETE)?;
    service.delete()?;
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
    let service = manager.open_service(SERVICE_NAME, ServiceAccess::STOP | ServiceAccess::QUERY_STATUS)?;
    service.stop()?;
    Ok(())
}
