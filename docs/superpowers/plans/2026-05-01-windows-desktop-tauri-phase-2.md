# Windows Desktop Tauri Phase 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the background logic into a real Windows service that can be installed, started, stopped, and monitored. Handle UAC elevation for service management.

**Architecture:** Use the `windows-service` crate to implement the service control handler. Use `runas` or similar for UAC elevation in the UI.

**Tech Stack:** `windows-service` crate, `is_executable_anybody_elevated` (or similar) for elevation check.

---

## Task 1: Service Skeleton and Control Handler

**Files:**

- Modify: `desktop/service/Cargo.toml`
- Modify: `desktop/service/src/main.rs`
- Create: `desktop/service/src/service_manager.rs`

- [ ] **Step 1: Add service dependencies**

Update `desktop/service/Cargo.toml`:

```toml
[dependencies]
anyhow = "1"
hickory-proto = "0.24"
libreascent-shared = { path = "../shared" }
reqwest = { version = "0.12" }
serde_json = "1"
tokio = { version = "1", features = ["macros", "net", "rt-multi-thread", "signal"] }
windows-service = "0.8"
```

- [ ] **Step 2: Implement service manager logic**

Create `desktop/service/src/service_manager.rs` with install/uninstall/start/stop logic.

- [ ] **Step 3: Update main to support service mode**

Update `desktop/service/src/main.rs` to handle `service-run` subcommand which enters the Windows service loop.

## Task 2: Admin Elevation Flow

**Files:**

- Modify: `desktop/ui/src-tauri/Cargo.toml`
- Modify: `desktop/ui/src-tauri/src/main.rs`

- [ ] **Step 1: Add elevation dependencies**

Update `desktop/ui/src-tauri/Cargo.toml` with `is_elevated` or similar.

- [ ] **Step 2: Implement tauri commands for service management**

Add `install_service`, `uninstall_service`, `start_service`, `stop_service` commands that trigger UAC if not elevated.

## Task 3: UI Status and Controls

**Files:**

- Modify: `desktop/ui/src/App.tsx`

- [ ] **Step 1: Add buttons for service management**

Update the UI to show Install/Uninstall and Start/Stop buttons based on the service status.
