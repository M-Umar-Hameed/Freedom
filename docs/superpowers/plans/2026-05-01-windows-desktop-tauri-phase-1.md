# Windows Desktop Tauri Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first Windows desktop slice: a Tauri UI, shared Rust config/blocklist logic, a service-capable agent binary, and a DNS proxy that blocks configured domains.

**Architecture:** Add a `desktop/` Rust workspace beside the existing Expo app. The Tauri UI talks to shared Rust code for status/config first, while the service-capable agent owns DNS blocking and can later become a real installed Windows service. This phase keeps enforcement testable without requiring service installation on every test run.

**Tech Stack:** Rust workspace, Tauri 2, Tokio, Serde, hickory-proto for DNS packet parsing/building, Windows-compatible filesystem paths, existing `npm`/Git workflow.

---

## File Structure

- Create `desktop/Cargo.toml`: Rust workspace root.
- Create `desktop/shared/Cargo.toml`: shared crate manifest.
- Create `desktop/shared/src/lib.rs`: exports shared modules.
- Create `desktop/shared/src/config.rs`: versioned desktop config model and default paths.
- Create `desktop/shared/src/blocklist.rs`: domain normalization and suffix matching.
- Create `desktop/shared/src/schedule.rs`: schedule evaluator matching the mobile app concepts.
- Create `desktop/agent/Cargo.toml`: agent/service-capable binary manifest.
- Create `desktop/agent/src/main.rs`: CLI entry point for `run-dns` and `check-domain`.
- Create `desktop/agent/src/dns.rs`: async UDP DNS proxy.
- Create `desktop/agent/src/config_loader.rs`: config load/save helpers using `ProgramData/LibreAscent`.
- Create `desktop/ui/package.json`: Tauri UI package scripts.
- Create `desktop/ui/src-tauri/Cargo.toml`: Tauri Rust backend manifest.
- Create `desktop/ui/src-tauri/tauri.conf.json`: Tauri config.
- Create `desktop/ui/src-tauri/src/main.rs`: Tauri commands for status/config/domain test.
- Create `desktop/ui/src/main.tsx`: React entry.
- Create `desktop/ui/src/App.tsx`: first status/settings UI.
- Create `desktop/ui/src/styles.css`: desktop UI styles.

## Task 1: Rust Workspace And Shared Config

**Files:**

- Create: `desktop/Cargo.toml`
- Create: `desktop/shared/Cargo.toml`
- Create: `desktop/shared/src/lib.rs`
- Create: `desktop/shared/src/config.rs`

- [ ] **Step 1: Create the failing config tests**

Create `desktop/shared/src/config.rs` with tests first:

```rust
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum ControlMode {
    Flexible,
    Locked,
    Hardcore,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct FrictionConfig {
    pub countdown_seconds: u32,
    pub click_count: u32,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct DesktopConfig {
    pub schema_version: u32,
    pub adult_blocking_enabled: bool,
    pub included_domains: Vec<String>,
    pub excluded_domains: Vec<String>,
    pub keywords: Vec<String>,
    pub blocked_apps: Vec<BlockedAppRule>,
    pub control_mode: ControlMode,
    pub friction: FrictionConfig,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct BlockedAppRule {
    pub name: String,
    pub executable: String,
    pub full_path: Option<String>,
}

pub fn default_config() -> DesktopConfig {
    DesktopConfig {
        schema_version: 1,
        adult_blocking_enabled: true,
        included_domains: Vec::new(),
        excluded_domains: Vec::new(),
        keywords: Vec::new(),
        blocked_apps: Vec::new(),
        control_mode: ControlMode::Flexible,
        friction: FrictionConfig {
            countdown_seconds: 60,
            click_count: 50,
        },
    }
}

pub fn default_config_path() -> PathBuf {
    if let Ok(program_data) = std::env::var("PROGRAMDATA") {
        return PathBuf::from(program_data).join("LibreAscent").join("config.json");
    }

    PathBuf::from("LibreAscent").join("config.json")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_config_uses_schema_version_one() {
        let config = default_config();

        assert_eq!(config.schema_version, 1);
        assert!(config.adult_blocking_enabled);
        assert_eq!(config.control_mode, ControlMode::Flexible);
        assert_eq!(config.friction.countdown_seconds, 60);
        assert_eq!(config.friction.click_count, 50);
    }

    #[test]
    fn default_config_path_ends_with_libreascent_config_json() {
        let path = default_config_path();
        let text = path.to_string_lossy();

        assert!(text.ends_with("LibreAscent\\config.json") || text.ends_with("LibreAscent/config.json"));
    }
}
```

- [ ] **Step 2: Create workspace manifests**

Create `desktop/Cargo.toml`:

```toml
[workspace]
members = ["shared", "agent", "ui/src-tauri"]
resolver = "2"

[workspace.package]
edition = "2021"
license = "GPL-3.0"
repository = "https://github.com/M-Umar-Hameed/LibreAscent"
```

Create `desktop/shared/Cargo.toml`:

```toml
[package]
name = "libreascent-shared"
version = "0.1.0"
edition.workspace = true
license.workspace = true
repository.workspace = true

[dependencies]
serde = { version = "1", features = ["derive"] }
serde_json = "1"
```

Create `desktop/shared/src/lib.rs`:

```rust
pub mod blocklist;
pub mod config;
pub mod schedule;
```

Create minimal modules so the crate compiles during this task:

`desktop/shared/src/blocklist.rs`

```rust
pub fn normalize_domain(input: &str) -> Option<String> {
    let trimmed = input.trim().trim_end_matches('.').to_ascii_lowercase();

    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed)
    }
}
```

`desktop/shared/src/schedule.rs`

```rust
pub fn always_active() -> bool {
    true
}
```

- [ ] **Step 3: Run config tests**

Run:

```powershell
cargo test -p libreascent-shared config
```

Expected: PASS for `default_config_uses_schema_version_one` and `default_config_path_ends_with_libreascent_config_json`.

- [ ] **Step 4: Commit**

```powershell
git add desktop/Cargo.toml desktop/shared
git commit -m "feat(desktop): add shared config model"
```

## Task 2: Domain Blocklist Matching

**Files:**

- Modify: `desktop/shared/src/blocklist.rs`

- [ ] **Step 1: Replace minimal blocklist module with failing tests and implementation skeleton**

Update `desktop/shared/src/blocklist.rs`:

```rust
use std::collections::HashSet;

#[derive(Debug, Clone, Default)]
pub struct DomainBlocklist {
    blocked: HashSet<String>,
    allowed: HashSet<String>,
}

impl DomainBlocklist {
    pub fn new(blocked: impl IntoIterator<Item = String>, allowed: impl IntoIterator<Item = String>) -> Self {
        let blocked = blocked
            .into_iter()
            .filter_map(|domain| normalize_domain(&domain))
            .collect();
        let allowed = allowed
            .into_iter()
            .filter_map(|domain| normalize_domain(&domain))
            .collect();

        Self { blocked, allowed }
    }

    pub fn is_blocked(&self, domain: &str) -> bool {
        let Some(normalized) = normalize_domain(domain) else {
            return false;
        };

        if matches_domain_set(&normalized, &self.allowed) {
            return false;
        }

        matches_domain_set(&normalized, &self.blocked)
    }
}

pub fn normalize_domain(input: &str) -> Option<String> {
    let domain = input
        .trim()
        .trim_start_matches("http://")
        .trim_start_matches("https://")
        .trim_end_matches('.')
        .to_ascii_lowercase();

    let host = domain.split('/').next().unwrap_or("").trim();

    if host.is_empty() || host.contains(' ') {
        None
    } else {
        Some(host.to_string())
    }
}

fn matches_domain_set(domain: &str, set: &HashSet<String>) -> bool {
    if set.contains(domain) {
        return true;
    }

    let mut remainder = domain;
    while let Some((_, parent)) = remainder.split_once('.') {
        if set.contains(parent) {
            return true;
        }
        remainder = parent;
    }

    false
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalizes_domains() {
        assert_eq!(normalize_domain(" HTTPS://Sub.Example.COM/path "), Some("sub.example.com".to_string()));
        assert_eq!(normalize_domain("example.com."), Some("example.com".to_string()));
        assert_eq!(normalize_domain("bad domain.com"), None);
    }

    #[test]
    fn blocks_exact_and_subdomains() {
        let blocklist = DomainBlocklist::new(vec!["example.com".to_string()], Vec::<String>::new());

        assert!(blocklist.is_blocked("example.com"));
        assert!(blocklist.is_blocked("www.example.com"));
        assert!(blocklist.is_blocked("deep.www.example.com"));
        assert!(!blocklist.is_blocked("example.org"));
    }

    #[test]
    fn allowlist_wins_over_blocklist() {
        let blocklist = DomainBlocklist::new(
            vec!["example.com".to_string()],
            vec!["safe.example.com".to_string()],
        );

        assert!(blocklist.is_blocked("example.com"));
        assert!(!blocklist.is_blocked("safe.example.com"));
        assert!(!blocklist.is_blocked("cdn.safe.example.com"));
    }
}
```

- [ ] **Step 2: Run blocklist tests**

Run:

```powershell
cargo test -p libreascent-shared blocklist
```

Expected: PASS for normalization, exact/suffix block, and allowlist precedence.

- [ ] **Step 3: Commit**

```powershell
git add desktop/shared/src/blocklist.rs
git commit -m "feat(desktop): add domain blocklist matching"
```

## Task 3: Schedule Evaluation

**Files:**

- Modify: `desktop/shared/src/schedule.rs`

- [ ] **Step 1: Replace minimal schedule module with tests and evaluator**

Update `desktop/shared/src/schedule.rs`:

```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ScheduleWindow {
    pub day: u8,
    pub start_minutes: u16,
    pub end_minutes: u16,
}

pub fn is_active(windows: &[ScheduleWindow], day: u8, minute_of_day: u16) -> bool {
    windows.iter().any(|window| window_matches(window, day, minute_of_day))
}

fn window_matches(window: &ScheduleWindow, day: u8, minute_of_day: u16) -> bool {
    if window.start_minutes == window.end_minutes {
        return window.day == day;
    }

    if window.start_minutes < window.end_minutes {
        return window.day == day
            && minute_of_day >= window.start_minutes
            && minute_of_day < window.end_minutes;
    }

    let next_day = (window.day + 1) % 7;

    (window.day == day && minute_of_day >= window.start_minutes)
        || (next_day == day && minute_of_day < window.end_minutes)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn same_day_window_matches_inside_range() {
        let windows = vec![ScheduleWindow {
            day: 1,
            start_minutes: 9 * 60,
            end_minutes: 17 * 60,
        }];

        assert!(is_active(&windows, 1, 10 * 60));
        assert!(!is_active(&windows, 1, 8 * 60));
        assert!(!is_active(&windows, 1, 17 * 60));
        assert!(!is_active(&windows, 2, 10 * 60));
    }

    #[test]
    fn overnight_window_matches_next_day() {
        let windows = vec![ScheduleWindow {
            day: 5,
            start_minutes: 22 * 60,
            end_minutes: 6 * 60,
        }];

        assert!(is_active(&windows, 5, 23 * 60));
        assert!(is_active(&windows, 6, 5 * 60));
        assert!(!is_active(&windows, 6, 7 * 60));
    }

    #[test]
    fn equal_start_and_end_means_full_day() {
        let windows = vec![ScheduleWindow {
            day: 3,
            start_minutes: 0,
            end_minutes: 0,
        }];

        assert!(is_active(&windows, 3, 0));
        assert!(is_active(&windows, 3, 23 * 60));
        assert!(!is_active(&windows, 4, 12 * 60));
    }
}
```

- [ ] **Step 2: Run schedule tests**

Run:

```powershell
cargo test -p libreascent-shared schedule
```

Expected: PASS for same-day, overnight, and full-day schedule behavior.

- [ ] **Step 3: Commit**

```powershell
git add desktop/shared/src/schedule.rs
git commit -m "feat(desktop): add schedule evaluation"
```

## Task 4: Agent Config Loader And Domain Check CLI

**Files:**

- Create: `desktop/agent/Cargo.toml`
- Create: `desktop/agent/src/config_loader.rs`
- Create: `desktop/agent/src/main.rs`
- Create: `desktop/agent/src/dns.rs`

- [ ] **Step 1: Create agent manifest**

Create `desktop/agent/Cargo.toml`:

```toml
[package]
name = "libreascent-agent"
version = "0.1.0"
edition.workspace = true
license.workspace = true
repository.workspace = true

[dependencies]
anyhow = "1"
libreascent-shared = { path = "../shared" }
serde_json = "1"
tokio = { version = "1", features = ["macros", "net", "rt-multi-thread", "signal"] }
```

- [ ] **Step 2: Write config loader tests and implementation**

Create `desktop/agent/src/config_loader.rs`:

```rust
use anyhow::{Context, Result};
use libreascent_shared::config::{default_config, DesktopConfig};
use std::fs;
use std::path::Path;

pub fn load_or_create(path: &Path) -> Result<DesktopConfig> {
    if path.exists() {
        let text = fs::read_to_string(path)
            .with_context(|| format!("failed to read config {}", path.display()))?;
        let config = serde_json::from_str(&text)
            .with_context(|| format!("failed to parse config {}", path.display()))?;
        return Ok(config);
    }

    let config = default_config();
    save(path, &config)?;
    Ok(config)
}

pub fn save(path: &Path, config: &DesktopConfig) -> Result<()> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .with_context(|| format!("failed to create config directory {}", parent.display()))?;
    }

    let text = serde_json::to_string_pretty(config).context("failed to serialize config")?;
    fs::write(path, text).with_context(|| format!("failed to write config {}", path.display()))?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    #[test]
    fn creates_default_config_when_missing() {
        let path = temp_path("missing-config.json");

        let config = load_or_create(&path).expect("config should be created");

        assert_eq!(config.schema_version, 1);
        assert!(path.exists());
        let _ = fs::remove_file(path);
    }

    #[test]
    fn loads_existing_config() {
        let path = temp_path("existing-config.json");
        let mut config = default_config();
        config.included_domains = vec!["example.com".to_string()];
        save(&path, &config).expect("config should save");

        let loaded = load_or_create(&path).expect("config should load");

        assert_eq!(loaded.included_domains, vec!["example.com"]);
        let _ = fs::remove_file(path);
    }

    fn temp_path(name: &str) -> std::path::PathBuf {
        let suffix = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("clock should work")
            .as_nanos();
        std::env::temp_dir().join(format!("libreascent-{suffix}-{name}"))
    }
}
```

- [ ] **Step 3: Add CLI command**

Create `desktop/agent/src/main.rs`:

```rust
mod config_loader;
mod dns;

use anyhow::{bail, Result};
use libreascent_shared::blocklist::DomainBlocklist;
use libreascent_shared::config::default_config_path;

#[tokio::main]
async fn main() -> Result<()> {
    let args = std::env::args().skip(1).collect::<Vec<_>>();

    match args.first().map(String::as_str) {
        Some("check-domain") => {
            let Some(domain) = args.get(1) else {
                bail!("usage: libreascent-agent check-domain <domain>");
            };
            let config = config_loader::load_or_create(&default_config_path())?;
            let blocklist = DomainBlocklist::new(config.included_domains, config.excluded_domains);
            println!("{}", if blocklist.is_blocked(domain) { "blocked" } else { "allowed" });
        }
        Some("run-dns") => {
            dns::run_local_dns_proxy(default_config_path(), "127.0.0.1:5353").await?;
        }
        _ => {
            println!("usage:");
            println!("  libreascent-agent check-domain <domain>");
            println!("  libreascent-agent run-dns");
        }
    }

    Ok(())
}
```

Create `desktop/agent/src/dns.rs` as a stub for this task:

```rust
use anyhow::Result;
use std::path::PathBuf;

pub async fn run_local_dns_proxy(_config_path: PathBuf, bind_addr: &str) -> Result<()> {
    println!("DNS proxy would listen on {bind_addr}");
    Ok(())
}
```

- [ ] **Step 4: Run agent tests**

Run:

```powershell
cargo test -p libreascent-agent
```

Expected: PASS for config loader tests.

- [ ] **Step 5: Run CLI help**

Run:

```powershell
cargo run -p libreascent-agent -- check-domain example.com
```

Expected: command exits successfully and prints `allowed` unless local `ProgramData/LibreAscent/config.json` already blocks `example.com`.

- [ ] **Step 6: Commit**

```powershell
git add desktop/agent desktop/Cargo.toml
git commit -m "feat(desktop): add agent config CLI"
```

## Task 5: DNS Proxy Blocking

**Files:**

- Modify: `desktop/agent/Cargo.toml`
- Modify: `desktop/agent/src/dns.rs`

- [ ] **Step 1: Add DNS dependency**

Update `desktop/agent/Cargo.toml`:

```toml
[dependencies]
anyhow = "1"
hickory-proto = "0.24"
libreascent-shared = { path = "../shared" }
serde_json = "1"
tokio = { version = "1", features = ["macros", "net", "rt-multi-thread", "signal"] }
```

- [ ] **Step 2: Implement packet response tests and DNS proxy helpers**

Replace `desktop/agent/src/dns.rs`:

```rust
use anyhow::{Context, Result};
use hickory_proto::op::{Message, MessageType, OpCode, ResponseCode};
use hickory_proto::serialize::binary::{BinDecodable, BinEncodable};
use libreascent_shared::blocklist::DomainBlocklist;
use std::net::SocketAddr;
use std::path::PathBuf;
use tokio::net::UdpSocket;

use crate::config_loader;

const UPSTREAM_DNS: &str = "1.1.1.1:53";

pub async fn run_local_dns_proxy(config_path: PathBuf, bind_addr: &str) -> Result<()> {
    let bind: SocketAddr = bind_addr.parse().context("invalid DNS bind address")?;
    let upstream: SocketAddr = UPSTREAM_DNS.parse().context("invalid upstream DNS address")?;
    let socket = UdpSocket::bind(bind).await.context("failed to bind DNS proxy")?;
    let upstream_socket = UdpSocket::bind("0.0.0.0:0").await.context("failed to bind upstream DNS socket")?;
    let mut buffer = vec![0_u8; 4096];

    loop {
        let (size, peer) = socket.recv_from(&mut buffer).await.context("failed to receive DNS packet")?;
        let request = &buffer[..size];
        let config = config_loader::load_or_create(&config_path)?;
        let blocklist = DomainBlocklist::new(config.included_domains, config.excluded_domains);

        if let Some(response) = build_block_response_if_needed(request, &blocklist)? {
            socket.send_to(&response, peer).await.context("failed to send blocked DNS response")?;
            continue;
        }

        upstream_socket
            .send_to(request, upstream)
            .await
            .context("failed to forward DNS request")?;
        let (upstream_size, _) = upstream_socket
            .recv_from(&mut buffer)
            .await
            .context("failed to receive upstream DNS response")?;
        socket
            .send_to(&buffer[..upstream_size], peer)
            .await
            .context("failed to send upstream DNS response")?;
    }
}

pub fn build_block_response_if_needed(request: &[u8], blocklist: &DomainBlocklist) -> Result<Option<Vec<u8>>> {
    let message = Message::from_bytes(request).context("failed to parse DNS request")?;
    let Some(query) = message.queries().first() else {
        return Ok(None);
    };
    let domain = query.name().to_ascii();

    if !blocklist.is_blocked(&domain) {
        return Ok(None);
    }

    let mut response = Message::new();
    response.set_id(message.id());
    response.set_message_type(MessageType::Response);
    response.set_op_code(OpCode::Query);
    response.set_authoritative(false);
    response.set_recursion_desired(message.recursion_desired());
    response.set_recursion_available(true);
    response.set_response_code(ResponseCode::NXDomain);
    response.add_query(query.clone());

    response.to_bytes().context("failed to encode blocked DNS response").map(Some)
}

#[cfg(test)]
mod tests {
    use super::*;
    use hickory_proto::op::Query;
    use hickory_proto::rr::{Name, RecordType};

    #[test]
    fn returns_nxdomain_for_blocked_domain() {
        let request = dns_query("example.com.");
        let blocklist = DomainBlocklist::new(vec!["example.com".to_string()], Vec::<String>::new());

        let response_bytes = build_block_response_if_needed(&request, &blocklist)
            .expect("request should parse")
            .expect("domain should be blocked");
        let response = Message::from_bytes(&response_bytes).expect("response should parse");

        assert_eq!(response.response_code(), ResponseCode::NXDomain);
        assert_eq!(response.queries().len(), 1);
    }

    #[test]
    fn returns_none_for_allowed_domain() {
        let request = dns_query("allowed.com.");
        let blocklist = DomainBlocklist::new(vec!["example.com".to_string()], Vec::<String>::new());

        let response = build_block_response_if_needed(&request, &blocklist).expect("request should parse");

        assert!(response.is_none());
    }

    fn dns_query(domain: &str) -> Vec<u8> {
        let mut message = Message::new();
        message.set_id(42);
        message.set_message_type(MessageType::Query);
        message.set_recursion_desired(true);
        message.add_query(Query::query(
            Name::from_ascii(domain).expect("domain should be valid"),
            RecordType::A,
        ));
        message.to_bytes().expect("query should encode")
    }
}
```

- [ ] **Step 3: Run DNS tests**

Run:

```powershell
cargo test -p libreascent-agent dns
```

Expected: PASS for blocked NXDOMAIN and allowed-domain passthrough decision.

- [ ] **Step 4: Commit**

```powershell
git add desktop/agent/Cargo.toml desktop/agent/src/dns.rs
git commit -m "feat(desktop): add DNS block response"
```

## Task 6: Tauri UI Skeleton And Commands

**Files:**

- Create: `desktop/ui/package.json`
- Create: `desktop/ui/index.html`
- Create: `desktop/ui/src/main.tsx`
- Create: `desktop/ui/src/App.tsx`
- Create: `desktop/ui/src/styles.css`
- Create: `desktop/ui/src-tauri/Cargo.toml`
- Create: `desktop/ui/src-tauri/tauri.conf.json`
- Create: `desktop/ui/src-tauri/src/main.rs`

- [ ] **Step 1: Create Tauri package files**

Create `desktop/ui/package.json`:

```json
{
  "name": "libreascent-desktop-ui",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite --host 127.0.0.1",
    "build": "vite build",
    "tauri": "tauri"
  },
  "dependencies": {
    "@tauri-apps/api": "^2.0.0",
    "@vitejs/plugin-react": "^5.0.0",
    "vite": "^7.0.0",
    "typescript": "~5.9.2",
    "react": "19.1.0",
    "react-dom": "19.1.0"
  },
  "devDependencies": {}
}
```

Create `desktop/ui/index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>LibreAscent Desktop</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

Create `desktop/ui/src/main.tsx`:

```tsx
import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```

Create `desktop/ui/src/App.tsx`:

```tsx
import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

type DesktopStatus = {
  serviceInstalled: boolean;
  serviceRunning: boolean;
  dnsProxyRunning: boolean;
  configPath: string;
};

type DomainResult = "idle" | "blocked" | "allowed" | "error";

export function App() {
  const [status, setStatus] = useState<DesktopStatus | null>(null);
  const [domain, setDomain] = useState("example.com");
  const [domainResult, setDomainResult] = useState<DomainResult>("idle");

  useEffect(() => {
    invoke<DesktopStatus>("get_status")
      .then(setStatus)
      .catch(() => setStatus(null));
  }, []);

  async function testDomain() {
    setDomainResult("idle");
    try {
      const blocked = await invoke<boolean>("test_domain", { domain });
      setDomainResult(blocked ? "blocked" : "allowed");
    } catch {
      setDomainResult("error");
    }
  }

  return (
    <main className="shell">
      <section className="panel">
        <p className="eyebrow">LibreAscent Desktop</p>
        <h1>Windows protection</h1>
        <dl className="status-grid">
          <div>
            <dt>Service installed</dt>
            <dd>{status?.serviceInstalled ? "Yes" : "No"}</dd>
          </div>
          <div>
            <dt>Service running</dt>
            <dd>{status?.serviceRunning ? "Yes" : "No"}</dd>
          </div>
          <div>
            <dt>DNS proxy</dt>
            <dd>{status?.dnsProxyRunning ? "Running" : "Stopped"}</dd>
          </div>
        </dl>
        <p className="path">
          {status?.configPath ?? "Config path unavailable"}
        </p>
      </section>

      <section className="panel">
        <h2>Domain test</h2>
        <div className="domain-row">
          <input
            value={domain}
            onChange={(event) => setDomain(event.target.value)}
          />
          <button onClick={testDomain}>Test</button>
        </div>
        <p className={`result result-${domainResult}`}>{domainResult}</p>
      </section>
    </main>
  );
}
```

Create `desktop/ui/src/styles.css`:

```css
:root {
  color: #e5edf7;
  background: #101418;
  font-family:
    Inter,
    ui-sans-serif,
    system-ui,
    -apple-system,
    BlinkMacSystemFont,
    "Segoe UI",
    sans-serif;
}

body {
  margin: 0;
}

.shell {
  display: grid;
  gap: 16px;
  min-height: 100vh;
  box-sizing: border-box;
  padding: 32px;
  background: #101418;
}

.panel {
  border: 1px solid #2a3441;
  border-radius: 8px;
  padding: 20px;
  background: #151b22;
}

.eyebrow {
  margin: 0 0 8px;
  color: #82d4aa;
  font-size: 13px;
  font-weight: 700;
  text-transform: uppercase;
}

h1,
h2 {
  margin: 0 0 16px;
}

.status-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin: 0;
}

dt {
  color: #9aa8b7;
  font-size: 12px;
}

dd {
  margin: 4px 0 0;
  font-weight: 700;
}

.path {
  margin: 16px 0 0;
  color: #9aa8b7;
  word-break: break-all;
}

.domain-row {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 8px;
}

input,
button {
  border: 1px solid #354254;
  border-radius: 6px;
  padding: 10px 12px;
  color: #e5edf7;
  background: #0f141a;
  font: inherit;
}

button {
  cursor: pointer;
  background: #1f6f4a;
}

.result {
  margin: 12px 0 0;
  font-weight: 700;
}

.result-blocked {
  color: #ff6b6b;
}

.result-allowed {
  color: #82d4aa;
}

.result-error {
  color: #ffd166;
}
```

- [ ] **Step 2: Add Tauri backend**

Create `desktop/ui/src-tauri/Cargo.toml`:

```toml
[package]
name = "libreascent-desktop-ui"
version = "0.1.0"
edition.workspace = true
license.workspace = true
repository.workspace = true

[build-dependencies]
tauri-build = { version = "2", features = [] }

[dependencies]
libreascent-shared = { path = "../../shared" }
serde = { version = "1", features = ["derive"] }
tauri = { version = "2", features = [] }
```

Create `desktop/ui/src-tauri/tauri.conf.json`:

```json
{
  "$schema": "https://schema.tauri.app/config/2",
  "productName": "LibreAscent Desktop",
  "version": "0.1.0",
  "identifier": "app.libreascent.desktop",
  "build": {
    "beforeDevCommand": "npm run dev",
    "devUrl": "http://127.0.0.1:1420",
    "beforeBuildCommand": "npm run build",
    "frontendDist": "../dist"
  },
  "app": {
    "windows": [
      {
        "title": "LibreAscent Desktop",
        "width": 980,
        "height": 720
      }
    ]
  },
  "bundle": {
    "active": true,
    "targets": ["msi"]
  }
}
```

Create `desktop/ui/src-tauri/src/main.rs`:

```rust
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
```

- [ ] **Step 3: Install UI dependencies**

Run:

```powershell
npm install --prefix desktop/ui
```

Expected: dependencies install and `desktop/ui/package-lock.json` is created.

- [ ] **Step 4: Build UI frontend**

Run:

```powershell
npm run --prefix desktop/ui build
```

Expected: Vite build succeeds and writes `desktop/ui/dist`.

- [ ] **Step 5: Run Tauri backend check**

Run:

```powershell
cargo check -p libreascent-desktop-ui
```

Expected: Rust backend compiles.

- [ ] **Step 6: Commit**

```powershell
git add desktop/ui desktop/Cargo.toml
git commit -m "feat(desktop): add Tauri UI skeleton"
```

## Task 7: Root Scripts And Documentation

**Files:**

- Modify: `package.json`
- Create: `desktop/README.md`

- [ ] **Step 1: Add desktop scripts**

Modify root `package.json` scripts section to include these keys while preserving existing scripts:

```json
"desktop:ui:dev": "npm --prefix desktop/ui run tauri dev",
"desktop:ui:build": "npm --prefix desktop/ui run tauri build",
"desktop:rust:test": "cargo test --manifest-path desktop/Cargo.toml",
"desktop:agent:check": "cargo run --manifest-path desktop/Cargo.toml -p libreascent-agent -- check-domain example.com"
```

- [ ] **Step 2: Add desktop README**

Create `desktop/README.md`:

````markdown
# LibreAscent Desktop

Windows-first desktop protection for LibreAscent.

## Phase 1

This phase includes:

- Shared Rust config and blocklist logic.
- Agent binary with config loading and domain checks.
- DNS proxy logic that can return NXDOMAIN for blocked domains.
- Tauri UI skeleton for status and domain testing.

## Commands

```powershell
npm run desktop:rust:test
npm run desktop:agent:check
npm install --prefix desktop/ui
npm run --prefix desktop/ui build
cargo check --manifest-path desktop/Cargo.toml -p libreascent-desktop-ui
```
````

## Current Limits

The agent is not installed as a Windows service yet. DNS adapter changes, app blocking, overlay, and installer work are later phases.

````

- [ ] **Step 3: Run full phase verification**

Run:

```powershell
npm run desktop:rust:test
````

Expected: all Rust tests pass.

Run:

```powershell
npm run desktop:agent:check
```

Expected: prints `allowed` unless local ProgramData config blocks `example.com`.

Run:

```powershell
npm run --prefix desktop/ui build
```

Expected: Vite build succeeds.

- [ ] **Step 4: Commit**

```powershell
git add package.json package-lock.json desktop/README.md
git commit -m "docs(desktop): add phase one commands"
```

## Phase 1 Completion Criteria

- `cargo test --manifest-path desktop/Cargo.toml` passes.
- `npm run --prefix desktop/ui build` passes.
- `cargo check --manifest-path desktop/Cargo.toml -p libreascent-desktop-ui` passes.
- Agent can evaluate configured blocked domains.
- DNS response helper returns NXDOMAIN for blocked domains in tests.
- UI opens with status and domain test controls.

## Future Plans After Phase 1

- Phase 2: real Windows service install/start/stop/status and admin elevation flow.
- Phase 3: set and monitor Windows adapter DNS settings.
- Phase 4: process and foreground-window app blocking.
- Phase 5: overlay helper window and block-event IPC.
- Phase 6: friction/control modes and tamper event log.
