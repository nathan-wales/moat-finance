# Dark Mode (Web + Desktop)

## Summary

Add dark mode to the web app and desktop app, mirroring the System / Light / Dark appearance toggle that already ships on iOS. Light mode is the existing design and must not change visually.

## Goals

- Activate the existing `.dark` CSS token blocks in `apps/web` and `apps/desktop` (already defined, currently unused).
- Appearance toggle with three options — **System**, **Light**, **Dark** — defaulting to **System**.
- Persist the choice locally under the key `moat.appearance` with values `system` | `light` | `dark`, matching iOS (`MoatAppearance.storageKey` in `apps/ios/Moat/Core/DesignSystem/Tokens/moat-theme.swift`).
- Make chart neutrals (grids, sankey nodes/labels, default tooltips) theme-aware via new design tokens that preserve the exact current light values.
- Sync Electron `nativeTheme.themeSource` so the desktop window chrome matches the in-app appearance.

## Non-goals

- Redesigning the light palette — light values stay pixel-identical.
- Cross-device sync of the appearance preference (device-local, same as iOS).
- Theming the marketing site or browser extension.

## Implementation

### Web (`apps/web`)

- `next-themes` `ThemeProvider` (`attribute="class"`, `defaultTheme="system"`, `enableSystem`, `storageKey="moat.appearance"`) wired in the root layout with `suppressHydrationWarning` on `<html>`.
- Appearance section on the Account settings page with a segmented System / Light / Dark control.
- The Sonner toaster picks up the active theme automatically through `useTheme()`.

### Desktop (`apps/desktop`)

- Renderer-side appearance store (Zustand) in `src/renderer/src/lib/stores/appearance-store.ts`; applies the `.dark` class on `<html>`, persists to `localStorage`, and tracks the OS `prefers-color-scheme` while in System mode. Initialized synchronously before first render to avoid a flash.
- Appearance card on the desktop Settings page.
- New `appearance:setThemeSource` IPC channel (contracts → preload → main) that sets `nativeTheme.themeSource`.

### Shared tokens

Both stylesheets gain `color-scheme` declarations and chart-neutral tokens (light values match the previously hardcoded hexes):

| Token | Light | Dark |
|-------|-------|------|
| `--chart-grid` | `#e5e7eb` | `oklch(1 0 0 / 12%)` |
| `--chart-node` | `#cbd5e1` | `oklch(0.45 0.02 255)` |
| `--chart-label` | `#374151` | `oklch(0.85 0 0)` |
| `--chart-label-strong` | `#111827` | `oklch(0.985 0 0)` |
| `--chart-label-muted` | `#6b7280` | `oklch(0.708 0 0)` |

`packages/charts` (and the web's forked chart copies) reference these via `var(--chart-*)` instead of hardcoded hexes. Brand series colors (blues/greens/purples) are unchanged — they read fine on both backgrounds.
