use std::process::Command;
use anyhow::{Result, Context, anyhow};
use std::fs::OpenOptions;
use std::io::Write;
use chrono::Local;

pub fn set_system_dns(addr: &str) -> Result<()> {
    let interfaces = get_connected_interfaces()?;
    for interface in interfaces {
        println!("Setting DNS for interface {} to {}", interface, addr);
        let status = Command::new("netsh")
            .args(&["interface", "ipv4", "set", "dnsservers", &format!("name=\"{}\"", interface), "static", addr, "primary"])
            .status()
            .with_context(|| format!("failed to set DNS for {}", interface))?;
        
        if !status.success() {
            return Err(anyhow!("netsh failed with exit code {:?} for {}", status.code(), interface));
        }
    }
    Ok(())
}

pub fn log_tamper_event(message: &str) {
    let path = libreascent_shared::config::default_config_path().parent().unwrap().join("tamper.log");
    if let Ok(mut file) = OpenOptions::new().create(true).append(true).open(path) {
        let now = Local::now();
        let _ = writeln!(file, "[{}] {}", now.format("%Y-%m-%d %H:%M:%S"), message);
    }
}

pub fn reset_system_dns() -> Result<()> {
    // Try netsh first
    if let Ok(interfaces) = get_connected_interfaces() {
        for interface in interfaces {
            let _ = Command::new("netsh")
                .args(&["interface", "ipv4", "set", "dnsservers", &format!("name=\"{}\"", interface), "dhcp"])
                .status();
        }
    }

    // Always follow up with a broad PowerShell reset as a fallback/safety measure
    // This requires admin, same as netsh
    let _ = Command::new("powershell")
        .args(&["-NoProfile", "-Command", "Get-NetAdapter | where {$_.Status -eq 'Up'} | Set-DnsClientServerAddress -ResetServerAddresses"])
        .status();

    Ok(())
}

pub fn is_dns_set_correctly(addr: &str) -> Result<bool> {
    let output = Command::new("netsh")
        .args(&["interface", "ipv4", "show", "dnsservers"])
        .output()
        .context("failed to show DNS servers")?;
    
    let stdout = String::from_utf8_lossy(&output.stdout);
    // Simple check: for each 'Configuration for interface "..."', 
    // if the next few lines contain "Statically Configured DNS Servers:" 
    // it should match our addr.
    // Actually, let's just check if our addr appears at all in the output for now.
    // In Phase 3, we want to ensure ALL connected interfaces point to us.
    
    let connected = get_connected_interfaces()?;
    for interface in connected {
        if !stdout.contains(&format!("Configuration for interface \"{}\"", interface)) {
            continue;
        }
        // Very basic check: address should be in the output
        if !stdout.contains(addr) {
            return Ok(false);
        }
    }

    Ok(true)
}

fn get_connected_interfaces() -> Result<Vec<String>> {
    let output = Command::new("netsh")
        .args(&["interface", "ipv4", "show", "interfaces"])
        .output()
        .context("failed to list interfaces")?;
    
    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut interfaces = Vec::new();

    for line in stdout.lines() {
        if line.contains("connected") {
            // Format is usually:  Idx  Met   MTU   State        Name
            //                    ---  ---  -----  -----------  ---------
            //                     13   25   1500  connected    Ethernet
            let parts: Vec<&str> = line.split_whitespace().collect();
            if parts.len() >= 5 {
                // Join the rest as name might have spaces
                let name = parts[4..].join(" ");
                interfaces.push(name);
            }
        }
    }

    Ok(interfaces)
}
