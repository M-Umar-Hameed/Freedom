# Windows Desktop Tauri Phase 4 Implementation Plan

**Goal:** Implement process and foreground-window app blocking.

**Architecture:**
- Use the `sysinfo` crate for process enumeration and termination.
- A background task in the service will poll running processes every second.
- Match processes against `blocked_apps` rules in the configuration.
- Integrate schedule checks to only block during active windows.

---

## Task 1: Process Management Logic

**Files:**
- Modify: `desktop/service/Cargo.toml`
- Create: `desktop/service/src/process_manager.rs`
- Modify: `desktop/service/src/service_manager.rs`

- [ ] **Step 1: Add dependencies**
  Update `desktop/service/Cargo.toml` with `sysinfo`.

- [ ] **Step 2: Implement process scanning and termination**
  Create `desktop/service/src/process_manager.rs`. Add logic to list processes, match against rules, and kill matched processes.

- [ ] **Step 3: Integrate into service loop**
  Add a background task in `service_manager.rs` that runs the process check every second.

## Task 2: Schedule Integration

**Files:**
- Modify: `desktop/service/src/process_manager.rs`

- [ ] **Step 1: Apply schedules to app blocking**
  Ensure the process manager respects the global or per-app schedules. (Phase 1 schedule logic).

## Task 3: UI for App Blocking

**Files:**
- Modify: `desktop/ui/src/App.tsx`
- Modify: `desktop/ui/src-tauri/src/main.rs`

- [ ] **Step 1: Implement get_config / update_config commands**
  Allow the UI to read and write the `DesktopConfig`.

- [ ] **Step 2: Add simple app management UI**
  Add a section to the UI to add/remove executable names to the blocked list.
