use sysinfo::System;
use libreascent_shared::config::DesktopConfig;

pub fn check_and_block_apps(config: &DesktopConfig) {
    if config.blocked_apps.is_empty() {
        return;
    }

    let sys = System::new_all();

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
            }
        }
    }
}
