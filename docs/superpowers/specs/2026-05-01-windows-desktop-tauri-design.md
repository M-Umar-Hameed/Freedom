# Windows Desktop Tauri Design

## Goal

Build a Windows-first desktop version of LibreAscent that provides hard blocking for adult content and distracting desktop usage. The desktop app should reuse the current project's product model where practical while replacing Android-only enforcement with Windows-native enforcement.

## Scope

This design covers the first Windows desktop implementation. It targets a strong impulse-resistant block, not an impossible-to-defeat security boundary against a determined administrator with safe mode, alternate boot media, registry access, or service recovery knowledge.

Included:

- Tauri desktop UI for settings, status, blocklists, schedules, and friction flows.
- Windows background service for enforcement.
- Shared rule schema for domains, keywords, blocked apps, schedules, and control modes.
- DNS-level website blocking.
- Process and foreground-window app blocking.
- Fullscreen block overlay.
- Basic tamper resistance through service startup, watchdog checks, and guarded settings changes.

Excluded from the first implementation:

- macOS and Linux support.
- Browser extension URL-path scanning.
- Windows Filtering Platform packet filtering.
- Cloud sync.
- Perfect protection from an administrator deliberately dismantling the system.

## Architecture

Add a new `desktop/` workspace:

- `desktop/ui`: Tauri app. Presents the dashboard, blocklist management, app blocking, schedules, control modes, permissions/status, import/export, and overlay preview.
- `desktop/service`: Windows service. Runs with elevated permissions and owns enforcement.
- `desktop/shared`: shared types, config schema, blocklist parsing, schedule evaluation, and control-mode helpers.
- `desktop/installer`: installer scripts and service registration.

The existing Expo Android app remains unchanged. Shared logic should be copied or extracted only when it reduces duplication without making the mobile app depend on desktop tooling.

## Data Model

Use a versioned JSON configuration stored under `ProgramData/LibreAscent/config.json`.

Core fields:

- `schemaVersion`
- `adultBlockingEnabled`
- `includedDomains`
- `excludedDomains`
- `keywords`
- `blockedApps`
- `reelsApps`
- `controlMode`
- `friction`
- `schedules`
- `overlayTheme`

The import/export format should stay close to the current mobile settings export so users can move rule sets between Android and Windows.

## Enforcement

### DNS Blocking

The service runs a local DNS proxy on `127.0.0.1`. During setup, LibreAscent sets the active Windows adapter DNS server to localhost and forwards allowed queries to a configured upstream resolver.

Blocked domains return NXDOMAIN. Matching uses normalized exact and suffix matching, equivalent to the Android DNS blocklist behavior.

The service periodically verifies DNS settings still point to LibreAscent. If they are changed while hard mode is active, it restores them and records a tamper event.

### App Blocking

The service monitors running processes and the foreground window. Blocked apps are matched by executable name and optional full path.

When a blocked app is opened during an active block window, the service shows the block overlay and terminates or minimizes the process according to the app rule. First version should default to terminate for hard-blocked apps.

### Overlay

The user-session helper process displays a borderless always-on-top fullscreen Tauri window when the service reports a block event. The overlay uses the same theme concepts as the mobile app: title, subtitle, body, background image/color, and reason text.

The overlay stays visible until the blocked site/app is no longer active or a configured timeout expires for non-app events.

## Control Modes

Support the existing conceptual modes:

- Flexible: settings can be changed freely.
- Locked: disabling protection or removing rules requires friction.
- Hardcore: service remains active, DNS settings are restored automatically, and disabling protection requires the strongest configured friction.

Friction options:

- Countdown timer.
- Repeated click confirmation.

The desktop version should make the user intent explicit before weakening protection. It should not rely on hidden or deceptive behavior.

## Tauri Commands

The UI communicates with the service through a local named pipe or localhost IPC endpoint restricted to the current machine.

Initial commands:

- `get_status`
- `get_config`
- `update_config`
- `enable_protection`
- `disable_protection`
- `trigger_friction`
- `import_config`
- `export_config`
- `get_block_events`
- `test_domain`
- `test_app_rule`

The service validates all config writes. The UI is not trusted as the enforcement authority.

## Error Handling

The UI shows explicit status when:

- The Windows service is not installed.
- The service is installed but not running.
- DNS settings are not controlled by LibreAscent.
- Another DNS/VPN/security product conflicts with localhost DNS.
- The app lacks elevation for install or repair.

The service should fail closed for adult/domain blocking when protection is enabled: if config reload fails, keep the last known good rules active.

## Testing

Unit tests:

- Domain normalization and suffix matching.
- Keyword matching.
- Schedule evaluation, including overnight windows.
- Control-mode and friction decisions.
- Config migration between schema versions.

Integration tests:

- Service loads config and starts DNS proxy.
- Blocked domain returns NXDOMAIN.
- Allowed domain forwards upstream.
- Blocked process is detected and handled.
- UI can read status and submit guarded config updates.

Manual Windows verification:

- Install service as admin.
- Reboot and confirm service auto-starts.
- Open blocked domain in multiple browsers.
- Open blocked desktop app.
- Attempt to change DNS during hardcore mode.
- Attempt to quit UI while service remains active.

## Risks

- DNS-over-HTTPS in browsers can bypass system DNS. First version should warn when known browsers have DoH enabled. A browser extension or WFP-based enforcement can be added later.
- Admin users can still disable services or boot around protection. The product should describe this honestly.
- Process killing can cause data loss in blocked apps. For the first version, only block user-selected apps and clearly label terminate behavior.
- Antivirus or firewall software may flag local DNS/service behavior. The installer and service should use signed binaries before broader distribution.

## Milestones

1. Scaffold `desktop/` Tauri UI and Rust shared config types.
2. Build Windows service skeleton with install/start/status commands.
3. Implement DNS proxy and blocklist matching.
4. Add UI status/settings screens and config persistence.
5. Implement app/process blocking.
6. Implement overlay helper.
7. Add friction/control modes.
8. Add installer and manual verification checklist.
