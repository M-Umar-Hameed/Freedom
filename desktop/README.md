# LibreAscent Desktop

Windows-first desktop protection for LibreAscent.

## Components

- **UI**: Tauri + React (Vite) app for configuration and status.
- **Service**: Rust background service for DNS proxying and app blocking.
- **Shared**: Core logic (config, blocklist parsing) shared between UI and Service.

## Development

```powershell
# Install UI dependencies
npm install --prefix desktop/ui

# Run UI in dev mode
npm run desktop:ui:dev

# Run tests
npm run desktop:rust:test

# Update remote blocklists
npm run desktop:service:update

# Check if a domain is blocked
npm run desktop:service:check -- pornhub.com
```

## Production

To build the MSI installer:

```powershell
npm run desktop:dist
```

The installer will be generated in `desktop/target/release/bundle/msi/`.

## Features

- **DNS Proxy**: High-performance local DNS server that returns NXDOMAIN for adult content.
- **App Blocking**: Terminate distracting apps (e.g. Discord, Steam) based on config.
- **Service-UI IPC**: Local UDP broadcast for real-time block events.
- **Block Overlay**: FS borderless window that appears when content is blocked.
- **Tamper Resistance**: Automatically restores DNS settings if changed.
- **Control Modes**: Flexible, Locked, and Hardcore modes with friction gates.
