# Desktop Auto-Update Widget

## Status

Complete. Implemented July 13, 2026 (PR #23) and landed with the macOS updater zip fix. Created July 13, 2026 after reviewing `apps/desktop/src/main/updater.ts`, `apps/desktop/src/main/index.ts`, `apps/desktop/src/preload/index.ts`, `apps/desktop/src/renderer/src/desktop-shell.tsx`, `apps/desktop/src/renderer/src/App.tsx`, `apps/desktop/package.json`, and `apps/desktop/docs/patterns/packaging.md`.

## Goal

Complete the desktop auto-update experience so packaged Moat Finance Desktop builds check for updates on launch, download the update safely, and show a small floating bottom-left widget with a clear **Update** action when a restart/install is available.

Success means:

- Packaged desktop builds check for updates shortly after launch without blocking app startup.
- When an update has been downloaded, the renderer shows a compact bottom-left widget with version-aware copy and an **Update** button.
- Clicking **Update** explicitly restarts the app through `electron-updater` instead of forcing an unexpected quit.
- Update failures are observable through the existing remote logging path without exposing sensitive local data.

## Product Context

Moat Finance Desktop is part of the local-first financial context OS. Users should receive fixes and improvements reliably, but desktop update prompts must feel lightweight and trustworthy because the app may contain sensitive financial context. The right V1 behavior is an unobtrusive restart prompt after the update is ready, not a modal interruption while the user is reviewing finances or configuring the local agent gateway.

## Current Repo Context

### What exists today

| Asset | Location | Current behavior |
|-------|----------|------------------|
| Desktop app startup | `apps/desktop/src/main/index.ts` | Calls `initAutoUpdater()` after `createWindow()` inside `app.whenReady()`. The main window is not passed into the updater module. |
| Auto-updater module | `apps/desktop/src/main/updater.ts` | Uses `electron-updater`, skips non-packaged builds, sets `autoDownload = true`, sets `autoInstallOnAppQuit = true`, logs updater events, and calls `checkForUpdatesAndNotify()` once on launch. |
| Publish config | `apps/desktop/package.json` | `electron-builder` uses the generic provider at `https://downloads.moatfinance.ai/updates`. |
| Preload bridge | `apps/desktop/src/preload/index.ts` | Exposes typed domain IPC groups on `window.moatDesktop`; there is no updater API. |
| Renderer shell | `apps/desktop/src/renderer/src/desktop-shell.tsx` | Wraps onboarding, vault, and app content with `MoatModeProvider`, `MoatModeInset`, `MoatOverlay`, and `FeatureToaster`. This is the best root-level location for a global update widget. |
| Main app layout | `apps/desktop/src/renderer/src/App.tsx` | Renders the app once vault and onboarding are complete. It already has a top banner for MCP connection state, but no global update UI. |
| Packaging docs | `apps/desktop/docs/patterns/packaging.md` | Says updates happen at startup and interval, are downloaded silently, and the user is prompted to restart. The current implementation only does startup checking and console logging. |

### Gaps to close

- No main-to-renderer event is sent when update state changes.
- No preload API exists for update status, event subscriptions, manual check, or install/restart.
- No renderer state or component exists for update availability.
- No bottom-left floating widget exists.
- No code calls `autoUpdater.quitAndInstall()`.
- The current `checkForUpdatesAndNotify()` path may show native OS notifications; the desired UX is an in-app widget.
- The docs mention an update interval and user prompt, but the code does not implement either.

## Target Experience

### Launch and background behavior

1. User opens a packaged Moat Finance Desktop build.
2. The main process initializes updater listeners and schedules the first update check after the main window is ready.
3. If no update exists, the app remains unchanged.
4. If an update exists, Moat downloads it in the background.
5. Once the update is downloaded and ready to install, a small bottom-left widget appears above app chrome.

### Widget layout

```text
+-------------------------------------------+
| Update ready                              |
| Version 0.1.14 is ready to install.       |
|                                           |
| [Later]                         [Update]  |
+-------------------------------------------+
```

Placement:

- Fixed bottom-left.
- Offset from viewport edges: `left-4 bottom-4`.
- Width: compact card, roughly `w-80`.
- Z-index above page content and route command menu trigger, below any modal dialog overlays if the UI system has a defined modal layer.
- Rendered globally from `DesktopShell` so it can appear on onboarding, vault, and app screens.

Copy:

- Title: `Update ready`
- Body with version: `Version {version} is ready to install.`
- Body without version: `A new version is ready to install.`
- Primary button: `Update`
- Secondary button: `Later`

Interaction:

- **Update** calls the updater install IPC action. The main process runs `autoUpdater.quitAndInstall(false, true)` or the locally preferred equivalent after confirming an update has been downloaded.
- **Later** dismisses the widget for the current renderer session only. It may reappear after app restart if the downloaded update is still ready.
- The widget should not show for `checking`, `available`, or `downloading` states in V1. It should show only when installation is ready.
- If the install IPC call fails, keep the widget visible and show a concise error state in the widget: `Update could not start. Try again.`

### State machine

| State | Source event | Renderer behavior |
|-------|--------------|-------------------|
| `idle` | app start or no update available | No widget. |
| `checking` | `checking-for-update` | No widget. |
| `available` | `update-available` | No widget; update is downloading. |
| `downloading` | `download-progress` | No widget in V1. |
| `ready` | `update-downloaded` | Show widget unless dismissed. |
| `error` | updater error or check failure | No widget; log remotely. If the user clicked **Update**, show inline retry copy. |

## Architecture / Contracts

### Main process

Update `apps/desktop/src/main/updater.ts` so it owns updater state and exposes a small typed API:

- `initAutoUpdater(mainWindow: BrowserWindow): void`
- `getUpdateStatus(): DesktopUpdateStatus`
- `checkForUpdates(): Promise<DesktopUpdateStatus>`
- `installDownloadedUpdate(): Promise<void>`

Recommended status shape:

```ts
type DesktopUpdateStatus =
	| { state: "idle" }
	| { state: "checking" }
	| { state: "available"; version?: string }
	| { state: "downloading"; version?: string; percent: number }
	| { state: "ready"; version?: string; releaseDate?: string }
	| { state: "error"; message: string };
```

Main process behavior:

- Keep `autoDownload = true`.
- Set `autoInstallOnAppQuit = false` so install happens through explicit user action instead of silently on any quit.
- Prefer `checkForUpdates()` over `checkForUpdatesAndNotify()` to keep the UX inside the app.
- Send status changes to the main window with a dedicated IPC event.
- Guard `installDownloadedUpdate()` so it only calls `quitAndInstall` when the current state is `ready`.
- Use `remoteLogger.error()` for updater failures. Do not log account details, transaction details, or user PII.

### IPC contracts

Add contract constants and types in `packages/contracts` so preload, main, and renderer share channel names.

Suggested file:

- `packages/contracts/src/ipc/desktop-updates.ts`

Suggested channels:

```ts
export const DESKTOP_UPDATE_CHANNELS = {
	getStatus: "desktop-updates:get-status",
	checkForUpdates: "desktop-updates:check-for-updates",
	install: "desktop-updates:install",
	statusChanged: "desktop-updates:status-changed",
} as const;
```

Export the new contract from the package's IPC barrel following existing `packages/contracts` patterns.

### Main IPC handler

Add a focused handler file:

- `apps/desktop/src/main/ipc/desktop-updates.ts`

Register it from:

- `apps/desktop/src/main/ipc/register-handlers.ts`

Handlers:

- `DESKTOP_UPDATE_CHANNELS.getStatus` -> returns current updater state.
- `DESKTOP_UPDATE_CHANNELS.checkForUpdates` -> triggers a manual check and returns state.
- `DESKTOP_UPDATE_CHANNELS.install` -> starts install/restart if ready.

Event:

- Main process sends `DESKTOP_UPDATE_CHANNELS.statusChanged` when state changes.

### Preload bridge

Extend `apps/desktop/src/preload/index.ts` with:

```ts
updates: {
	getStatus(): Promise<DesktopUpdateStatus>;
	checkForUpdates(): Promise<DesktopUpdateStatus>;
	install(): Promise<void>;
	onStatusChanged(callback: (status: DesktopUpdateStatus) => void): () => void;
}
```

`onStatusChanged` must return an unsubscribe function that removes the exact listener passed to `ipcRenderer.on`.

### Renderer

Add a small global feature under the renderer:

```text
apps/desktop/src/renderer/src/components/update-widget/
|-- desktop-update-widget.tsx
`-- use-desktop-update-status.ts
```

Responsibilities:

- `use-desktop-update-status.ts`
  - Fetches initial status with `window.moatDesktop.updates.getStatus()`.
  - Subscribes to `window.moatDesktop.updates.onStatusChanged(...)`.
  - Tracks local dismissal for the current renderer session.
  - Exposes `install`, `dismiss`, `isInstalling`, and `installError`.
- `desktop-update-widget.tsx`
  - Renders nothing unless state is `ready` and not dismissed.
  - Uses existing Tailwind and `@moat/ui` button/card patterns where available in the desktop renderer.
  - Keeps copy compact and accessible.

Mount `DesktopUpdateWidget` from `apps/desktop/src/renderer/src/desktop-shell.tsx`, outside `MoatModeInset` if it should float over all app phases, or inside the provider tree if it needs shared UI context.

## Implementation Plan

### Phase 1 - Main-process updater state

1. Refactor `initAutoUpdater()` to accept the main `BrowserWindow`.
2. Replace console-only event handling with a module-level `DesktopUpdateStatus` store and a `broadcastUpdateStatus()` helper.
3. Switch from `checkForUpdatesAndNotify()` to `checkForUpdates()`.
4. Keep startup check behavior for packaged builds; no-op with `idle` status in dev.
5. Disable `autoInstallOnAppQuit` so the explicit **Update** button controls restart/install.

**Acceptance criteria:**

- Packaged builds still check once on launch.
- Dev builds do not attempt network update checks.
- `update-downloaded` transitions status to `ready`.
- Updater errors are logged through `remoteLogger.error()`.

### Phase 2 - Typed IPC and preload API

1. Add shared update channels and status types to `packages/contracts`.
2. Add `apps/desktop/src/main/ipc/desktop-updates.ts`.
3. Register the handler in `register-handlers.ts`.
4. Extend `ElectronAPI` and `api` in `preload/index.ts`.
5. Add a renderer type update if `window.moatDesktop` is declared outside preload.

**Acceptance criteria:**

- Renderer can read current update status.
- Renderer can subscribe and unsubscribe from update status events.
- Renderer can trigger install only through the typed bridge.
- No raw `ipcRenderer` access is introduced in renderer code.

### Phase 3 - Bottom-left widget UI

1. Add `use-desktop-update-status.ts`.
2. Add `desktop-update-widget.tsx`.
3. Mount the widget in `DesktopShell`.
4. Implement **Later** dismissal for the current renderer session.
5. Implement **Update** action with inline retry copy on install failure.

**Acceptance criteria:**

- Widget appears only for `ready` updates.
- Widget is fixed to bottom-left and remains visible across app routes.
- **Later** hides the widget until the app reloads.
- **Update** calls the install IPC action once per click and shows pending/failed state.

### Phase 4 - Verification and docs

1. Update `apps/desktop/docs/patterns/packaging.md` so it matches the implementation.
2. Add focused unit tests where practical:
   - Main updater status reducer or event-to-status helper if extracted.
   - Renderer hook/component behavior with a mocked `window.moatDesktop.updates`.
3. Run desktop checks:
   - `pnpm --filter moat-desktop run check:write`
   - `pnpm --filter moat-desktop run typecheck`
4. Manually verify a packaged build with a mocked or staged update feed before shipping.

**Acceptance criteria:**

- Docs describe startup check, optional manual check API, background download, and explicit restart prompt.
- Lint and typecheck pass.
- Manual packaged-build verification covers update available, update downloaded, later dismissal, install click, and updater error.

## Acceptance Criteria

- [x] `initAutoUpdater(mainWindow)` runs on app launch for packaged builds and does not run update network checks in dev.
- [x] The update provider remains `https://downloads.moatfinance.ai/updates`.
- [x] Main process tracks update status and broadcasts status changes to renderer windows.
- [x] Preload exposes a typed `window.moatDesktop.updates` API.
- [x] Renderer never imports Electron directly for updater behavior.
- [x] A compact bottom-left widget appears when an update has downloaded and is ready to install.
- [x] Widget copy includes the target version when available.
- [x] **Update** restarts into the downloaded update through `autoUpdater.quitAndInstall`.
- [x] **Later** dismisses the widget for the current renderer session.
- [x] Updater failures are remotely logged without PII.
- [x] Desktop packaging docs match shipped behavior.
- [x] `pnpm --filter moat-desktop run check:write` passes.
- [x] `pnpm --filter moat-desktop run typecheck` passes.

## Non-Goals

- No redesign of the whole desktop notification system.
- No release-channel selector, beta/stable toggle, or update preferences screen in V1.
- No visible download progress UI in V1.
- No update feed infrastructure changes beyond using the existing generic provider.
- No forced restart, forced quit, or automatic install while the user is active.
- No web, iOS, extension, or MCP behavior changes.

## Open Questions

- Should **Later** stay dismissed only for the current renderer session, or persist until the next app version is available?
- Should the widget appear over the locked vault screen, or only after unlock? The recommended V1 default is global visibility because the update is app-level, but product may prefer not to interrupt unlock.
- Should there be a manual **Check for updates** entry in Settings for users who want to trigger checks outside launch?
- Should failed background checks surface any UI, or remain log-only unless the user manually checks?

## Related Specs and Docs

- `apps/desktop/docs/patterns/packaging.md`
- `apps/desktop/AGENTS.md`
- `docs/patterns/main-renderer-ipc.md`
- `specs/roadmap.md`

## Suggested Commit Message

```text
docs (desktop): adds update widget spec
```
