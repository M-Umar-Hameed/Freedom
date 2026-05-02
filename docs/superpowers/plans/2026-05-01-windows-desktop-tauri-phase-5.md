# Windows Desktop Tauri Phase 5 Implementation Plan

**Goal:** Implement the block overlay window and IPC communication between the service and the UI.

**Architecture:**
- The service will use a local TCP or UDP socket (restricted to localhost) to broadcast block events.
- The Tauri UI will listen for these events and show/hide an always-on-top borderless window (the overlay).
- The overlay will use the same theme concepts as the mobile app.

---

## Task 1: Service-to-UI IPC (Block Events)

**Files:**
- Modify: `desktop/service/src/service_manager.rs`
- Modify: `desktop/ui/src-tauri/src/main.rs`

- [ ] **Step 1: Broadcast block events from service**
  Update the service loop to send a message over a localhost UDP socket whenever a process or domain is blocked.

- [ ] **Step 2: Listen for block events in Tauri**
  Add a background task in the Tauri backend to listen for the UDP broadcast and emit a Tauri event to the frontend.

## Task 2: Block Overlay Window

**Files:**
- Modify: `desktop/ui/src-tauri/tauri.conf.json`
- Create: `desktop/ui/src/Overlay.tsx`
- Modify: `desktop/ui/src/main.tsx`
- Modify: `desktop/ui/src-tauri/src/main.rs`

- [ ] **Step 1: Configure overlay window in Tauri**
  Add a second window definition to `tauri.conf.json` (borderless, always-on-top, transparent, initially hidden).

- [ ] **Step 2: Implement Overlay component**
  Create a fullscreen React component for the block screen.

- [ ] **Step 3: Handle show/hide logic**
  Update the Tauri backend to show the overlay window when a block event is received and hide it when the block is cleared.

## Task 3: UI Integration

**Files:**
- Modify: `desktop/ui/src/App.tsx`

- [ ] **Step 1: Add overlay preview to settings**
  Allow the user to trigger a test overlay from the main dashboard.
