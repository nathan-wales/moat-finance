# Desktop Demo Mode — Superseded

## Status

**Superseded** (August 19, 2026). Desktop no longer seeds a local sample dataset into SQLite.

## Current behavior

Settings → Local Database → **Open web demo** opens the Moat web app sign-in with `demoMode=true`, which enters the shared web demo workspace (`demo@internal.system` + overlay session). Sample data never mixes with the local vault.

| Piece | Path |
|-------|------|
| Settings CTA | `apps/desktop/src/renderer/src/pages/settings.tsx` |
| IPC | `localDb:openWebDemo` in `apps/desktop/src/main/ipc/local-db.ts` |
| Web URL helper | `apps/desktop/src/main/lib/moat-web-url.ts` |
| Web auto-enter | `apps/web/src/app/auth/signin/page.tsx` (`?demoMode=true`) |
| Legacy purge | `packages/db-sqlite/src/purge-legacy-demo-workspace.ts` (one-shot on vault init) |

## Why this changed

Local seeding wrote `demo-*` rows into the active profile. That could not coexist with real data and was not a true context switch like web demo mode.

## Historical notes

The former local seeder lived in `packages/db-sqlite/src/seed-demo-workspace.ts` with IPC `localDb:seedDemo` / `clearDemo` / `getDemoStatus` and env `MOAT_DESKTOP_SEED_DEMO=1`. Those paths were removed.
