# Monorepo Restructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the existing Android Expo app into `mobile/` and prepare the repo root for separate `mobile/`, `desktop/`, and `shared/` work.

**Architecture:** Keep one Git repo and one `main` branch. The root becomes an orchestration layer with scripts that delegate to `mobile/`; the existing Expo app keeps its own package, lockfile, configs, native modules, and source tree inside `mobile/`.

**Tech Stack:** Expo SDK 54, React Native, TypeScript, npm, PowerShell, Git.

---

## File Structure

- Create `mobile/`: owns the current Expo/React Native Android app.
- Create `shared/README.md`: explains when code/assets belong in shared.
- Modify root `.gitignore`: keep repo-level ignores and add app-level artifacts for nested folders.
- Replace root `package.json`: root orchestration scripts only.
- Move existing mobile files into `mobile/`: Expo app source, native Android project, custom modules, configs, lockfile, assets, data, services, stores, and types.
- Keep `docs/` at root.
- Keep `.github/`, `.husky/`, `.vscode/`, `.git/`, `.gitignore`, `.gitattributes`, `LICENSE`, and root docs at root.

## Task 1: Move Android App Into `mobile/`

**Files:**

- Create: `mobile/`
- Move into `mobile/`: `.expo`, `android`, `app`, `assets`, `components`, `constants`, `data`, `db`, `hooks`, `modules`, `plugins`, `providers`, `services`, `stores`, `types`
- Move into `mobile/`: `.eslintrc.cjs`, `app.config.ts`, `babel.config.js`, `eas.json`, `expo-env.d.ts`, `global.css`, `knip.json`, `metro.config.js`, `nativewind-env.d.ts`, `package-lock.json`, `package.json`, `tailwind.config.js`, `tsconfig.json`

- [ ] **Step 1: Verify clean worktree**

Run:

```powershell
git status --short
```

Expected: no output.

- [ ] **Step 2: Create `mobile/`**

Run:

```powershell
New-Item -ItemType Directory -Path mobile
```

Expected: `mobile/` exists.

- [ ] **Step 3: Move mobile directories**

Run:

```powershell
git mv .expo mobile/.expo
git mv android mobile/android
git mv app mobile/app
git mv assets mobile/assets
git mv components mobile/components
git mv constants mobile/constants
git mv data mobile/data
git mv db mobile/db
git mv hooks mobile/hooks
git mv modules mobile/modules
git mv plugins mobile/plugins
git mv providers mobile/providers
git mv services mobile/services
git mv stores mobile/stores
git mv types mobile/types
```

Expected: directories move under `mobile/`.

- [ ] **Step 4: Move mobile config and package files**

Run:

```powershell
git mv .eslintrc.cjs mobile/.eslintrc.cjs
git mv app.config.ts mobile/app.config.ts
git mv babel.config.js mobile/babel.config.js
git mv eas.json mobile/eas.json
git mv expo-env.d.ts mobile/expo-env.d.ts
git mv global.css mobile/global.css
git mv knip.json mobile/knip.json
git mv metro.config.js mobile/metro.config.js
git mv nativewind-env.d.ts mobile/nativewind-env.d.ts
git mv package-lock.json mobile/package-lock.json
git mv package.json mobile/package.json
git mv tailwind.config.js mobile/tailwind.config.js
git mv tsconfig.json mobile/tsconfig.json
```

Expected: mobile package and tool configs live under `mobile/`.

- [ ] **Step 5: Commit the move only**

Run:

```powershell
git status --short
git add mobile
git commit -m "refactor: move Android app into mobile folder"
```

Expected: commit contains file moves only.

## Task 2: Add Root Orchestration Package

**Files:**

- Create: `package.json`
- Modify: `.gitignore`

- [ ] **Step 1: Create root `package.json`**

Create root `package.json`:

```json
{
  "name": "libreascent-monorepo",
  "private": true,
  "version": "1.6.0",
  "scripts": {
    "mobile:start": "npm --prefix mobile run start",
    "mobile:android": "npm --prefix mobile run android",
    "mobile:ios": "npm --prefix mobile run ios",
    "mobile:web": "npm --prefix mobile run web",
    "mobile:lint": "npm --prefix mobile run lint",
    "mobile:lint:fix": "npm --prefix mobile run lint:fix",
    "mobile:typecheck": "npm --prefix mobile run typecheck",
    "mobile:unused": "npm --prefix mobile run unused",
    "desktop:ui:dev": "npm --prefix desktop/ui run tauri dev",
    "desktop:ui:build": "npm --prefix desktop/ui run tauri build",
    "desktop:rust:test": "cargo test --manifest-path desktop/Cargo.toml"
  }
}
```

- [ ] **Step 2: Update `.gitignore` for nested apps**

Ensure `.gitignore` includes these lines:

```gitignore
# nested app dependencies and builds
mobile/node_modules/
mobile/.expo/
mobile/dist/
mobile/web-build/
desktop/ui/node_modules/
desktop/ui/dist/
desktop/target/
```

Keep existing ignore rules.

- [ ] **Step 3: Verify root scripts can find mobile package**

Run:

```powershell
npm.cmd run mobile:typecheck
```

Expected: command reaches `mobile/package.json` and fails only with the known pre-existing type error:

```text
modules/freedom-accessibility-service/src/index.ts(132,37): error TS2339: Property 'updateNsfwMonitoredApps' does not exist on type 'FreedomAccessibilityModuleInterface'.
```

- [ ] **Step 4: Commit root orchestration**

Run:

```powershell
git add package.json .gitignore
git commit -m "chore: add monorepo root scripts"
```

Expected: root package exists and delegates mobile commands to `mobile/`.

## Task 3: Fix Mobile Type Baseline

**Files:**

- Modify: `mobile/modules/freedom-accessibility-service/src/index.ts`

- [ ] **Step 1: Inspect current native module interface around NSFW methods**

Run:

```powershell
Get-Content mobile/modules/freedom-accessibility-service/src/index.ts
```

Expected: file shows `FreedomAccessibilityModuleInterface` and a call to `FreedomAccessibilityModule.updateNsfwMonitoredApps`.

- [ ] **Step 2: Add missing interface method**

In `mobile/modules/freedom-accessibility-service/src/index.ts`, add this method to `FreedomAccessibilityModuleInterface`:

```ts
updateNsfwMonitoredApps(packageNames: string[]): Promise<void>;
```

Do not change runtime behavior.

- [ ] **Step 3: Run mobile typecheck**

Run:

```powershell
npm.cmd run mobile:typecheck
```

Expected: typecheck passes.

- [ ] **Step 4: Commit baseline fix**

Run:

```powershell
git add mobile/modules/freedom-accessibility-service/src/index.ts
git commit -m "fix(mobile): declare NSFW monitored apps bridge method"
```

Expected: one TypeScript interface fix committed.

## Task 4: Update Mobile Tooling Paths

**Files:**

- Modify if needed: `mobile/tsconfig.json`
- Modify if needed: `mobile/babel.config.js`
- Modify if needed: `mobile/metro.config.js`
- Modify if needed: `mobile/tailwind.config.js`
- Modify if needed: `mobile/app.config.ts`

- [ ] **Step 1: Search for root-relative assumptions**

Run:

```powershell
rg "F:\\\\Github|\\.\\./|process\\.cwd\\(|__dirname|root|android/" mobile/*.config.* mobile/*.json mobile/*.js mobile/*.ts
```

Expected: review output for paths that became wrong after move.

- [ ] **Step 2: Verify TypeScript alias still maps `@/*` to mobile root**

Open `mobile/tsconfig.json`.

Expected relevant config:

```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./*"]
    }
  }
}
```

If it differs, update only the `paths` entry to the snippet above.

- [ ] **Step 3: Verify Expo entry still works from mobile package**

Open `mobile/package.json`.

Expected:

```json
{
  "main": "expo-router/entry"
}
```

Do not change this unless it differs.

- [ ] **Step 4: Run lint and typecheck from root scripts**

Run:

```powershell
npm.cmd run mobile:typecheck
npm.cmd run mobile:lint
```

Expected: typecheck passes. Lint either passes or reports pre-existing lint issues unrelated to path movement; if lint reports path/import failures from the move, fix those before committing.

- [ ] **Step 5: Commit tooling path fixes**

Run:

```powershell
git status --short
git add mobile/tsconfig.json mobile/babel.config.js mobile/metro.config.js mobile/tailwind.config.js mobile/app.config.ts
git commit -m "chore(mobile): align tooling paths after move"
```

Expected: commit exists only if files changed. If no files changed, skip commit and record that tooling paths already worked.

## Task 5: Add Shared Folder Contract And Root README Update

**Files:**

- Create: `shared/README.md`
- Modify: `README.md`

- [ ] **Step 1: Create shared folder contract**

Create `shared/README.md`:

```markdown
# Shared

This folder is for files used by both mobile and desktop builds.

Good candidates:

- settings export schemas
- domain blocklists
- keyword blocklists
- rule format documentation

Do not move platform-specific UI, Expo modules, Android native code, or Tauri service code here.
```

- [ ] **Step 2: Update root README project structure**

In `README.md`, update the architecture block to:

```text
LibreAscent/
  mobile/                 # Expo Android app
    app/                  # Expo Router screens
    components/           # UI components
    modules/              # Custom Expo Native Modules
    services/             # Business logic
    stores/               # Zustand state
    data/                 # Domain and keyword blocklists
  desktop/                # Windows Tauri app
  shared/                 # Cross-platform schemas and shared rule assets
  docs/                   # Specs, plans, and architecture notes
```

- [ ] **Step 3: Update root README setup commands**

In `README.md`, update install/run commands:

```bash
npm --prefix mobile install
npm --prefix mobile run android
```

Also mention root shortcuts:

```bash
npm run mobile:android
npm run mobile:typecheck
```

- [ ] **Step 4: Commit docs**

Run:

```powershell
git add README.md shared/README.md
git commit -m "docs: document monorepo layout"
```

Expected: docs describe `mobile/`, `desktop/`, and `shared/`.

## Task 6: Final Verification

**Files:**

- No new files expected.

- [ ] **Step 1: Verify repository shape**

Run:

```powershell
Get-ChildItem -Force
Get-ChildItem mobile -Force
```

Expected: root contains `mobile`, `docs`, `shared`, root `package.json`; `mobile` contains Expo app files.

- [ ] **Step 2: Verify mobile commands**

Run:

```powershell
npm.cmd run mobile:typecheck
npm.cmd run mobile:lint
```

Expected: both pass, unless lint has documented pre-existing non-path issues.

- [ ] **Step 3: Verify Git state**

Run:

```powershell
git status --short
git log --oneline -6
```

Expected: clean worktree. Recent commits show move, root scripts, baseline fix, docs.

- [ ] **Step 4: Report completion**

Report:

```text
Monorepo restructure complete.
Android app now lives in mobile/.
Root scripts delegate to mobile/.
Desktop can now be added under desktop/.
```

## Completion Criteria

- Current Android app lives under `mobile/`.
- Root `package.json` has orchestration scripts.
- `npm.cmd run mobile:typecheck` passes after the known interface fix.
- `README.md` documents the monorepo layout.
- `shared/README.md` defines shared-folder boundaries.
- Worktree is clean.
