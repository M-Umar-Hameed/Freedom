# Monorepo Restructure Design

## Goal

Restructure LibreAscent into a clean monorepo with separate mobile and desktop app folders while keeping one stable `main` branch.

## Recommended Repository Shape

```text
LibreAscent/
  mobile/        # current Expo/React Native Android app
  desktop/       # Windows-first Tauri app
  shared/        # shared schemas, blocklist assets, and portable logic
  docs/          # specs, plans, architecture notes
  package.json   # root workspace scripts
```

## Branch Strategy

Use one `main` branch for the repository.

Use feature branches for platform work:

- `feature/mobile-*`
- `feature/desktop-*`
- `feature/shared-*`

Use tags for platform releases:

- `mobile-v1.6.0`
- `desktop-v0.1.0`

Avoid separate permanent branches such as `android-main` and `desktop-main`. Separate long-lived platform branches would make shared blocklists, docs, releases, and fixes harder to coordinate.

## Mobile Move

Move the existing Android Expo app into `mobile/`.

Files and folders moved into `mobile/`:

- `.expo/`
- `android/`
- `app/`
- `assets/`
- `components/`
- `constants/`
- `data/`
- `db/`
- `hooks/`
- `modules/`
- `plugins/`
- `providers/`
- `services/`
- `stores/`
- `types/`
- Expo, Metro, Babel, Tailwind, TypeScript, ESLint, and nativewind config files.
- Mobile `package.json`, lockfile, and app config files.

Root `.gitignore` remains at the repo root and covers both mobile and desktop artifacts.

## Desktop Placement

Create `desktop/` for the Windows Tauri app.

Expected subfolders:

- `desktop/ui`
- `desktop/agent`
- `desktop/shared` or root `shared/desktop-rust`, depending on what proves cleaner during implementation.
- `desktop/installer`

The desktop app should not be mixed into the mobile Expo folder.

## Shared Placement

Create `shared/` only for assets or schemas that are genuinely used by both platforms.

Initial shared candidates:

- settings export schema
- domain blocklists
- keyword blocklists
- release-independent docs for rule formats

Do not prematurely force React Native UI code or Android native module code into `shared/`.

## Root Workspace

Root `package.json` becomes orchestration only.

Initial root scripts:

- `mobile:start`
- `mobile:android`
- `mobile:typecheck`
- `mobile:lint`
- `desktop:ui:dev`
- `desktop:ui:build`
- `desktop:rust:test`

The root should not directly depend on app runtime packages unless needed for workspace tooling.

## Import Path Impact

The current mobile app uses `@/` aliases. After moving to `mobile/`, `mobile/tsconfig.json`, Babel, Metro, NativeWind, and Expo Router should continue resolving `@/` against `mobile/`.

No mass import rewrite should be needed if config paths are updated correctly.

## Migration Order

1. Move current app files into `mobile/`.
2. Update root scripts to call `npm --prefix mobile ...`.
3. Update mobile config paths if any assume repo root.
4. Run mobile typecheck and lint.
5. Add `desktop/` after mobile baseline is stable.
6. Move shared blocklists/schema only after both apps need them.

## Testing

After restructure:

- `npm --prefix mobile install`
- `npm --prefix mobile run typecheck`
- `npm --prefix mobile run lint`
- `npm --prefix mobile run android` when device/emulator is available

Known current baseline issue:

- `modules/freedom-accessibility-service/src/index.ts` references `updateNsfwMonitoredApps`, but `FreedomAccessibilityModuleInterface` does not declare it. This should be fixed before using typecheck as a clean restructure gate.

## Risks

- Expo tooling can assume config files live beside `package.json`; moving all mobile config into `mobile/` avoids most risk.
- Native Android paths may reference root-relative files; verify Gradle and Expo module config after move.
- Existing docs and GitHub workflows may point to root commands; update them after folder move.
- Moving many files makes review noisy; use `git mv` style moves and keep behavior changes separate.
