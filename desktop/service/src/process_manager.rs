use sysinfo::{ProcessRefreshKind, ProcessesToUpdate, RefreshKind, System};
use libreascent_shared::config::DesktopConfig;

pub fn check_and_block_apps(sys: &mut System, config: &DesktopConfig) -> bool {
    if config.blocked_apps.is_empty() {
        return false;
    }

    sys.refresh_processes(ProcessesToUpdate::All, true);
    let mut blocked_any = false;

    for (pid, process) in sys.processes() {
        let exe_name = process.name().to_string_lossy().to_lowercase();
        
        for rule in &config.blocked_apps {
            let rule_exe = rule.executable.to_lowercase();
            let mut matched = exe_name == rule_exe || exe_name == format!("{}.exe", rule_exe);

            if !matched {
                if let Some(path) = process.exe() {
                    let path_str = path.to_string_lossy().to_lowercase();
                    if path_str.contains(&rule_exe) {
                        matched = true;
                    }
                }
            }

            if matched {
                println!("Blocking app: {} (PID: {:?})", exe_name, pid);
                let _ = process.kill();
                blocked_any = true;
            }
        }
    }

    blocked_any
}

pub fn create_system_handle() -> System {
    System::new_with_specifics(RefreshKind::nothing().with_processes(ProcessRefreshKind::everything()))
}
