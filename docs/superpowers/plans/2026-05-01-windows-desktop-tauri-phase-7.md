# Windows Desktop Tauri Phase 7 Implementation Plan

**Goal:** Create a production-ready MSI installer and final verification.

**Architecture:**
- Use Tauri's built-in bundler to generate an MSI.
- Configure the installer to require administrative privileges (for service installation).
- Final review of all commands and scripts.

---

## Task 1: Installer Configuration

**Files:**
- Modify: `desktop/ui/src-tauri/tauri.conf.json`

- [ ] **Step 1: Enable bundling and configure MSI**
  Update `tauri.conf.json` to enable bundling and set `targets: ["msi"]`.
  Set `installScope: "perMachine"` to ensure service can be installed system-wide.

## Task 2: Final Root Scripts

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Add desktop:dist script**
  Add a command to root `package.json` that runs the full build and bundle process.

## Task 3: Documentation & Verification

**Files:**
- Modify: `desktop/README.md`

- [ ] **Step 1: Update README with installation instructions**
  Document how to build the MSI and what it installs.

- [ ] **Step 2: Final Verification Checklist**
  1. Service install/start/stop via UI (with UAC).
  2. DNS set to 127.0.0.1 on start, DHCP on stop.
  3. Blocked domain (e.g. pornhub.com) returns NXDOMAIN.
  4. Blocked app (e.g. discord.exe) is terminated and shows overlay.
  5. DNS restored if manually changed.
  6. Friction guard appears for uninstall.
