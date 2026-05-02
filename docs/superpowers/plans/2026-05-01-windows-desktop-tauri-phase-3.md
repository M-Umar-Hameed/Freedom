# Windows Desktop Tauri Phase 3 Implementation Plan

**Goal:** Implement logic to set and monitor Windows network adapter DNS settings to point to the local DNS proxy (127.0.0.1).

**Architecture:**
- The service will use `netsh` or PowerShell commands to manage DNS settings.
- A background task in the service will monitor the DNS settings and restore them if changed (tamper resistance).
- The UI will show whether DNS is currently controlled by LibreAscent.

---

## Task 1: DNS Adapter Management Logic

**Files:**
- Create: `desktop/service/src/dns_manager.rs`
- Modify: `desktop/service/src/main.rs`
- Modify: `desktop/service/src/service_manager.rs`

- [ ] **Step 1: Implement adapter discovery and DNS setting**
  Create `desktop/service/src/dns_manager.rs`. Use `netsh` to get active adapters and set DNS to 127.0.0.1.

- [ ] **Step 2: Add commands to service CLI**
  Update `desktop/service/src/main.rs` with `set-dns` and `reset-dns` commands.

- [ ] **Step 3: Integrate into service loop**
  Update `desktop/service/src/service_manager.rs` to set DNS on start and reset on stop.

## Task 2: DNS Monitoring (Tamper Resistance)

**Files:**
- Modify: `desktop/service/src/dns_manager.rs`
- Modify: `desktop/service/src/service_manager.rs`

- [ ] **Step 1: Implement DNS check logic**
  Add `is_dns_set_correctly` function to `dns_manager.rs`.

- [ ] **Step 2: Add monitor loop to service**
  Run a background task in `service_manager.rs` that checks DNS every 30 seconds and restores it if needed.

## Task 3: UI Status Update

**Files:**
- Modify: `desktop/ui/src-tauri/src/main.rs`
- Modify: `desktop/ui/src/App.tsx`

- [ ] **Step 1: Update get_status to report DNS control status**
  Check if primary adapter DNS points to 127.0.0.1.

- [ ] **Step 2: Show DNS status in UI**
  Update the status grid to show if "System DNS" is "Managed" or "External".
