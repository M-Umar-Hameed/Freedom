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

## Current Limits

The agent is not installed as a Windows service yet. DNS adapter changes, app blocking, overlay, and installer work are later phases.
