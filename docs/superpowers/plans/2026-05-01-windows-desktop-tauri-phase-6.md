# Windows Desktop Tauri Phase 6 Implementation Plan

**Goal:** Implement Control Modes (Locked/Hardcore) and Friction flows (countdown/clicks).

**Architecture:**
- **Flexible Mode:** No friction.
- **Locked Mode:** Friction required for destructive actions (uninstall, removing rules).
- **Hardcore Mode:** Strongest friction. Service attempts to restart if stopped. DNS settings are aggressively restored.
- **Friction:** UI-driven countdown and click-count gates.

---

## Task 1: Friction & Control Mode Logic (Shared)

**Files:**
- Modify: `desktop/shared/src/config.rs`

- [ ] **Step 1: Add friction evaluation helpers**
  Add methods to check if an action requires friction based on the current `ControlMode`.

## Task 2: UI Friction Flows

**Files:**
- Create: `desktop/ui/src/FrictionGuard.tsx`
- Modify: `desktop/ui/src/App.tsx`

- [ ] **Step 1: Implement FrictionGuard component**
  Create a component that shows a countdown or requires X clicks before calling a success callback.

- [ ] **Step 2: Wrap sensitive actions**
  Use `FrictionGuard` for Uninstall and potentially "Disable Protection" (if added).

## Task 3: Hardcore Enforcement & Tamper Log

**Files:**
- Modify: `desktop/service/src/service_manager.rs`
- Modify: `desktop/service/src/dns_manager.rs`

- [ ] **Step 1: Aggressive DNS restoration**
  In Hardcore mode, log tamper events to `tamper.log` when DNS is restored.

- [ ] **Step 2: Guard Service Stop**
  If in Hardcore mode, the service should record a "manual stop" event and potentially set a flag for the installer/watchdog to restart it.
