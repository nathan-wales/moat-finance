# Rename: Moat Finance → Moat Finance

> **Status:** Complete (2026-06-10).
> **Type:** Cross-cutting rebrand + monorepo identifier rename.
> **Owner:** Tyler

---

## 1. Goal

Rename the product and codebase from **Moat Finance** to **Moat Finance**, consistently, everywhere:

- **Brand / user-facing copy** → `Moat Finance` (the full name) or `Moat` where a short form reads better.
- **Code identifiers** (npm scope, package names, env vars, app IDs, file/dir names, IPC bridge, etc.) → `moat`.

The end state: no remaining `fin` identifier or `Moat Finance` brand string carries the old meaning, the monorepo builds, typechecks, lints, and all apps (web, api, desktop, extension, mcp, ios, marketing) run.

### Naming convention (the single source of truth for this rename)

| Context | Old | New |
|---|---|---|
| Brand, full | `Moat Finance` / `Moat Finance` | `Moat Finance` |
| Brand, short | `Moat Finance` | `Moat` |
| Domain | `moatfinance.ai` | `moatfinance.ai` |
| App / API hosts | `app.moatfinance.ai` / `api.moatfinance.ai` | `app.moatfinance.ai` / `api.moatfinance.ai` |
| npm scope | `@moat/*` | `@moat/*` |
| App package names | `moat-web`, `moat-api`, `moat-desktop`, `moat-extension` | `moat-web`, `moat-api`, `moat-desktop`, `moat-extension` |
| Root workspace pkg | `fin` | `moat` |
| Env var prefix | `FIN_`, `WXT_MOAT_`, `NEXT_PUBLIC_MOAT_` | `MOAT_`, `WXT_MOAT_`, `NEXT_PUBLIC_MOAT_` |
| Desktop app ID | `com.moatfinance.desktop` | `com.moatfinance.desktop` |
| Desktop product name | `Moat Finance` | `Moat Finance` |
| Desktop IPC bridge global | `window.moatDesktop` | `window.moatDesktop` |
| Local DB filename | `moat.db` | `moat.db` |
| Desktop user-data dir | `Application Support/Moat Finance` | `Application Support/Moat Finance` |
| iOS target / product | `Moat Finance` | `Moat` |
| PAT / token prefixes | `moat_dev_`, `moat_local_` | `moat_dev_`, `moat_local_` |
| Agent tool namespace | `moat.applyRulesPreview` | `moat.applyRulesPreview` |
| DB name (Postgres) | `moat_finance_dev` | `moat_dev` |

> **Decision needed before starting** — see §9 Open Questions. A few of these (domain, GitHub repo name, DB name, app ID) have external/operational consequences and should be confirmed first.

---

## 2. Scope summary (what's affected)

This touches **every app and package**. Confirmed via search, the rename falls into these categories:

1. **npm scope `@moat/*`** — used as imports in **hundreds** of files across `apps/*` and `packages/*`. This is the single largest mechanical change.
2. **Package names** — 16 `@moat/*` packages + 4 `fin-*` apps + root `fin`.
3. **Turbo / pnpm filters & scripts** — `--filter moat-web`, `--filter moat-api`, etc. in root `package.json`, CI workflows, and AGENTS docs. **Note an existing inconsistency:** root `package.json` `lint:fix` references `moat-web`, `moat-api`, `@moat/mcp`, which do **not** match the real names (`moat-web`, `moat-api`, `@moat/mcp`). Reconcile during this work (see §6.1).
4. **User-facing brand copy** — `Moat Finance`, `Moat Finance`. Logo components (`apps/web/.../logo.tsx`, `apps/desktop/.../logo.tsx`) and the marketing site appear **already migrated** to `Moat Finance` + `moat-finance-logo.png`; verify no stragglers.
5. **Desktop (Electron) identity** — `appId`, `productName`, `publish.repo`, the `window.moatDesktop` contextBridge global, `moat.db` filename, the `Application Support/Moat Finance` data directory, and agent-gateway tool prefix `fin.*`.
6. **iOS app** — an entire `Moat Finance*` Xcode target: `Moat Finance.xcodeproj`, `apps/ios/Moat Finance/` source root, `FinApp.entitlements`, `FinAppApp.swift`, `FinApp`, `FinCard.swift`, `fin-theme.swift`, the `Moat Finance.xcscheme`, bundle identifier, product name, build artifact `Moat Finance.app`.
7. **API agent identity** — `MOAT_SYSTEM_PROMPT` (`# Moat Finance Agent Soul`), `MOAT_AGENT_VERSION`, `MOAT_PROMPT_VERSION`, `MOAT_TOOL_REGISTRY_VERSION`, `MOAT_STREAM_PROTOCOL_VERSION`, `MOAT_PROVIDER_NAME`.
8. **Environment variables** — `WXT_MOAT_API_URL`, `WXT_MOAT_WEB_URL`, `NEXT_PUBLIC_MOAT_RETAIL_EXTENSION_ID`, `MOAT_WEB_URL`, `MOAT_MCP_TOKEN`, `MOAT_MCP_CLIENT_PROFILE`, `MOAT_AGENT_MAX_STEPS`, `MOAT_AGENT_MAX_TOOL_TIME_MS`, Postgres DB name `moat_finance_dev`.
9. **Cross-app message contracts** — extension message type `MOAT_WEB_SYNC_RETAILER`.
10. **API surface metadata** — OpenAPI `title: Moat Finance REST API` and the generated `packages/client-ts` header.
11. **Domains & emails** — `app.moatfinance.ai`, `api.moatfinance.ai`, `tyler@moatfinance.ai` (`FEEDBACK_RECIPIENT`).
12. **Docs & specs** — `AGENTS.md`, `CLAUDE.md`, `.cursorrules`, every app `AGENTS.md`, `docs/`, and `specs/`.
13. **Lockfiles** — `pnpm-lock.yaml` and `package-lock.json` must be regenerated after package renames (do not hand-edit).
14. **GitHub repo metadata** — `publish.repo: "fin"`, `.github/workflows/*` filter names.

---

## 3. Critical distinctions — do NOT blindly find/replace

A naive global `fin → moat` will corrupt the codebase. These substrings contain `fin` but are **unrelated** and must be preserved:

- **`financial`, `finance`, `financialProfile`, `getFinancialProfileData`, `FinancialConnection`, `financial-profile`, `financial-data-providers`, `financial-connections`** — the literal word "financial/finance" appears constantly. **Never touch it** unless it's specifically the brand string "Moat Finance".
- **`define`, `defined`, `final`, `confirm`, `fine`, `finish`, `infinite`, `refine`, `Finicity`** (a real provider name in `finicity-sync.client.ts`).
- **`FinCard` (iOS)** is brand-derived (rename), but **`FinancialProfile`** is the domain word (keep).

**Mitigation:** All replacements must be **token-boundary aware** and reviewed per-category, not done as one global sed. Use the targeted patterns in §6, and grep-verify the diff for accidental `financial`→`moatancial` style corruption before committing each phase.

---

## 4. Inventory by category (with representative locations)

> Counts are approximate from search; the executor should re-run the listed search to get the authoritative file set at edit time.

### 4.1 npm scope `@moat/*` (largest)
- **Imports** in ~200+ files across `apps/web`, `apps/desktop`, `apps/api`, `apps/mcp`, `packages/*`.
- **Declared package names** (16): `@moat/retail-sync`, `@moat/financial-data-providers`, `@moat/domain`, `@moat/feedback`, `@moat/mcp-contracts`, `@moat/reports`, `@moat/db-postgres`, `@moat/state`, `@moat/ai-prompts`, `@moat/charts`, `@moat/mcp`, `@moat/config`, `@moat/runtime`, `@moat/shared`, `@moat/client-ts`, `@moat/openapi`, `@moat/ui`, `@moat/contracts`, `@moat/db-sqlite`, `@moat/features`, `@moat/data-access`, `@moat/events`.
- **`workspace:*` dependency references** in every consuming `package.json`.
- **tsconfig `paths` / bundler aliases** that map `@moat/*` (e.g. `apps/desktop/electron.vite.config.ts`, `apps/desktop/tsconfig.node.json`).

### 4.2 App package names + root
- `apps/web/package.json` → `moat-web`
- `apps/api/package.json` → `moat-api`
- `apps/desktop/package.json` → `moat-desktop` (+ `description: "Moat Finance Desktop — ..."`)
- `apps/extension/package.json` → `moat-extension`
- `apps/mcp/package.json` → `@moat/mcp`
- root `package.json` → `fin`

### 4.3 Scripts / filters / CI
- root `package.json`: `--filter moat-web`, `--filter moat-api`, `--filter=moat-web`, `--filter=moat-api`, and the `@app/*` mismatch.
- `.github/workflows/desktop-release.yml`, `.github/workflows/security.yml`.
- `scripts/dev.mjs`, `apps/web/vercel.json`, `apps/api/vercel.json`.

### 4.4 Brand copy (verify; mostly done)
- `apps/web/src/components/common/logo.tsx` — ✅ already "Moat Finance".
- `apps/desktop/src/renderer/src/components/logo.tsx` — ✅ already "Moat Finance".
- `apps/marketing/index.html` — ✅ title/nav already "Moat Finance"; **but still links to `app.moatfinance.ai`** (domain, §4.10).
- Sweep for any remaining standalone `Moat Finance` brand strings in toasts, page titles, `<title>`, metadata, onboarding copy, email templates.

### 4.5 Desktop identity
- `apps/desktop/package.json`: `appId: com.moatfinance.desktop` → `com.moatfinance.desktop`; `productName: "Moat Finance"` → `"Moat Finance"`; `publish.repo: "fin"`.
- `apps/desktop/src/preload/index.ts`: `contextBridge.exposeInMainWorld("moatDesktop", api)` → `"moatDesktop"`.
- **All `window.moatDesktop.*` call sites** in `apps/desktop/src/renderer/**` (dozens) → `window.moatDesktop.*`, plus the global type declaration.
- `apps/desktop/src/main/ipc/vault.ts`: `moat.db` filename.
- `packages/db-sqlite/src/ensureLocalDatabase.ts`, `apps/desktop/docs/patterns/sqlite-and-local-data.md`: `Application Support/Moat Finance/moat.db` paths.
- `apps/desktop/src/main/agent-gateway/local-token-service.ts`: token prefix `moat_local_`.
- `apps/desktop/src/main/agent-gateway/tools/registry.ts`: tool key `moat.applyRulesPreview`.
- `apps/desktop/docs/patterns/main-renderer-ipc.md`: example uses `window.fin` / `exposeInMainWorld("moat", …)` — update docs to match new bridge name.

### 4.6 iOS app (whole target)
- Directory: `apps/ios/Moat Finance/` → `apps/ios/Moat/` (124+ files).
- `apps/ios/Moat Finance.xcodeproj/` → `apps/ios/Moat.xcodeproj/` incl. `project.pbxproj` (`productName = Moat Finance`, `Moat Finance.app`, file refs), `xcshareddata/xcschemes/Moat Finance.xcscheme` → `Moat.xcscheme`.
- `apps/ios/Moat Finance/App/FinAppApp.swift` → `MoatApp.swift` (and `@main` struct).
- `apps/ios/Moat Finance/Core/DesignSystem/Components/FinCard.swift` → `MoatCard.swift` (+ `FinCard` type usages).
- `apps/ios/Moat Finance/Core/DesignSystem/Tokens/fin-theme.swift` → `moat-theme.swift`.
- `apps/ios/Moat Finance/SupportingFiles/FinApp.entitlements` → `MoatApp.entitlements`.
- Bundle identifier + display name in build settings / Info.plist.
- `apps/ios/README.md`.

### 4.7 API agent identity
- `apps/api/src/agent/prompts.ts`: `MOAT_SYSTEM_PROMPT`, `# Moat Finance Agent Soul` copy.
- `apps/api/src/agent/version.ts`: `MOAT_AGENT_VERSION`, `MOAT_PROMPT_VERSION`, `MOAT_TOOL_REGISTRY_VERSION`, `MOAT_STREAM_PROTOCOL_VERSION`, `MOAT_PROVIDER_NAME`.
- `apps/api/src/agent/context-builder.ts`, `loop-controller.ts`, `executor.ts` (consumers + `FIN_AGENT_*` env vars).

### 4.8 Environment variables
- `apps/extension/.env.production`, `apps/extension/lib/moat-api.ts`, `apps/extension/entrypoints/background.ts`: `WXT_MOAT_API_URL`, `WXT_MOAT_WEB_URL`.
- `apps/web/src/env.js`, retail-sync triggers: `NEXT_PUBLIC_MOAT_RETAIL_EXTENSION_ID`.
- `apps/desktop/src/main/ipc/retail-sync.ts`: `MOAT_WEB_URL`.
- `apps/mcp/.env.example`, `apps/mcp/docs/patterns/transports.md`, `.vscode/mcp.json`: `MOAT_MCP_TOKEN`, `MOAT_MCP_CLIENT_PROFILE`.
- `.env.example`: `DATABASE_URL` / `DIRECT_URL` db name `moat_finance_dev`.
- **Also rename the file `apps/extension/lib/moat-api.ts` → `moat-api.ts`** and its importers.

### 4.9 Cross-app contracts
- Extension external message type `MOAT_WEB_SYNC_RETAILER` (defined and consumed in `apps/web` + `apps/extension`). **Both sides must change together** or sync breaks.

### 4.10 API metadata, domains, emails
- `packages/openapi/api-v1.yaml`: `title: Moat Finance REST API`.
- `packages/client-ts/src/index.ts`: header comment (regenerated from OpenAPI).
- Domains `app.moatfinance.ai` → `app.moatfinance.ai`, `api.moatfinance.ai` → `api.moatfinance.ai` in marketing, extension `.env.production`, specs.
- `apps/api/src/lib/email/send-feedback-notification-email.ts`: `tyler@moatfinance.ai` → `tyler@moatfinance.ai`.

### 4.11 Docs & specs
- Root `AGENTS.md`, `CLAUDE.md`, `.cursorrules`; every app `AGENTS.md`; `docs/**`; `specs/**`.
- These are non-functional but should be updated for consistency (lower risk — do last).

---

## 5. Assets already done (verify, don't redo)
- `moat-finance-logo.png` exists in `apps/web/public/`, `apps/desktop/src/renderer/src/assets/`, `apps/marketing/public/`.
- Logo components reference the new asset + "Moat Finance" text.
- Marketing `index.html` title, nav, OG tags use "Moat Finance".

Action: confirm the **old** `fin-logo*.png` assets are removed or intentionally kept, and that favicon/app icons (`apps/marketing/public/favicon.ico`, `apps/ios/.../AppIcon-1024.png`, desktop `build/icon.*`) are updated to the Moat brand.

---

## 6. Execution plan (phased, each phase independently verifiable)

> **Principle:** rename in dependency order (leaf packages first), regenerate lockfiles once, then sweep app-level identifiers, then docs. Commit per phase so each is reviewable and revertible. Run typecheck + lint after each code phase.

### Phase 0 — Decisions & prep
- Resolve §9 Open Questions (app ID, DB name, domain, GitHub repo, scope name).
- Create a tracking checklist; ensure a clean working tree + new branch.

### Phase 1 — npm scope & package names (the backbone)
1. Rename each package's own `name` field: `@moat/x` → `@moat/x`, `moat-web` → `moat-web`, etc., root `fin` → `moat`.
2. Update every `dependencies`/`devDependencies` `@moat/*: "workspace:*"` reference.
3. Update tsconfig `paths` and bundler aliases (`electron.vite.config.ts`, any `vite`/`next`/`tsup` alias).
4. Global, token-safe replace of import specifiers `@moat/` → `@moat/` across `**/*.{ts,tsx,js,mjs}`.
5. Delete & regenerate lockfiles: `pnpm install` (regenerates `pnpm-lock.yaml`). Decide whether to remove the stale `package-lock.json` (repo uses pnpm — see §9).
6. **Verify:** `pnpm install` clean, `turbo run typecheck`, `turbo run check`.

### Phase 2 — Scripts, filters, CI
1. Root `package.json` scripts: `moat-web`/`moat-api` → `moat-web`/`moat-api`; fix the `@app/*` mismatch to the real new names.
2. `.github/workflows/*`, `vercel.json` (web + api), `scripts/dev.mjs`.
3. **Verify:** scripts run; CI filters resolve.

### Phase 3 — Desktop identity
1. `appId`, `productName`, `publish.repo`, `description`.
2. Bridge rename `moatDesktop` → `moatDesktop` (preload + all `window.moatDesktop.*` call sites + global typings) — **do in one commit** to avoid a broken intermediate.
3. `moat.db` → `moat.db`, `Application Support/Moat Finance` → `Application Support/Moat Finance`. **Add a migration/back-compat note** (§7) — existing users have data at the old path.
4. Agent-gateway tool prefix `fin.*` → `moat.*`; token prefix `moat_local_` → `moat_local_`.
5. Update desktop docs examples.
6. **Verify:** `pnpm --filter moat-desktop run typecheck`, dev launch, IPC round-trip.

### Phase 4 — API agent identity & env vars
1. Rename `FIN_*` constants/env vars → `MOAT_*`; update `.env.example`, `.vscode/mcp.json`, MCP/extension `.env*`.
2. Update agent prompt brand copy ("Moat Finance Agent Soul" → "Moat Finance Agent…").
3. Postgres DB name `moat_finance_dev` → `moat_dev` (coordinate with actual DB — §9).
4. Token prefixes `moat_dev_` → `moat_dev_` (display + any validation).
5. **Verify:** api typecheck, agent smoke test, env validation (`env.js`, t3-env) passes.

### Phase 5 — Cross-app contracts & API metadata
1. Extension message type `MOAT_WEB_SYNC_RETAILER` (web + extension together).
2. OpenAPI title; **regenerate** `packages/client-ts` (don't hand-edit generated file).
3. Rename `apps/extension/lib/moat-api.ts` → `moat-api.ts` + importers.
4. **Verify:** extension build, openapi codegen, web ↔ extension sync.

### Phase 6 — iOS target
1. Rename `apps/ios/Moat Finance/` → `apps/ios/Moat/`, `Moat Finance.xcodeproj` → `Moat.xcodeproj`, scheme, entitlements, `FinAppApp.swift`/`FinCard.swift`/`fin-theme.swift`.
2. Update `project.pbxproj` (`productName`, `Moat Finance.app`, file group paths), bundle id, display name.
3. **Verify:** `xcodebuild` / open in Xcode, app builds & launches.

### Phase 7 — Domains, emails, brand copy stragglers
1. `moatfinance.ai` → `moatfinance.ai` (and `app.`/`api.` subdomains) across marketing links, `apps/extension/.env.production`, deployed env, and specs. Coordinate DNS + hosting (Vercel domains, API host) so links resolve.
2. `FEEDBACK_RECIPIENT` email → `tyler@moatfinance.ai` (ensure the new mailbox exists).
3. Final brand-string sweep across all apps.

### Phase 8 — Docs & specs
1. `AGENTS.md`, `CLAUDE.md`, `.cursorrules`, app `AGENTS.md`, `docs/**`, `specs/**`.
2. Move/keep this spec; mark complete.

### Phase 9 — Final verification
- `pnpm install` clean from scratch (delete `node_modules` + lockfile, reinstall).
- `turbo run build`, `turbo run typecheck`, `turbo run check` all green.
- Manual smoke: web, api, desktop, extension, mcp, ios, marketing.
- Grep audit: `rg -n "@moat/|moat-web|moat-api|moat-desktop|moat-extension|moatDesktop|FIN_|com\.fin|financewithfin|Moat Finance|\bFin\b"` returns only intentional/false-positive (`financial`, `Finicity`, etc.) matches.

---

## 7. Data migration & back-compat (must not lose user data)

- **Desktop SQLite:** existing installs store data at `Application Support/Moat Finance/moat.db`. Changing `productName`/`appId` changes the user-data directory, and renaming `moat.db` orphans existing data. **Plan a one-time migration:** on launch, if new path is empty and old `Moat Finance/moat.db` exists, copy/move it. Document and test this before shipping. (See `specs/backlog/desktop-cloud-sync.spec.md` which already references `moat.db` semantics.)
- **Desktop appId change** affects auto-updater identity and code-signing — coordinate with `apps/desktop/docs/patterns/packaging.md` and signing certs.
- **Issued PATs / agent tokens** with `moat_finance_*` prefixes: decide whether existing tokens remain valid (keep accepting old prefix on read) or are invalidated.
- **Env vars in deployed environments** (Vercel, etc.): rename `FIN_*` → `MOAT_*` in the hosting dashboards **at the same time** as the code, or support both during a transition.

---

## 8. Risks

- **Broken intermediate states:** renaming a package name without updating all consumers (or the bridge global without all call sites) breaks the build. Keep each such change atomic per phase/commit.
- **Accidental `financial`/`Finicity` corruption** from over-broad replace (see §3). Highest-likelihood failure mode.
- **Generated files** (`client-ts`, lockfiles) hand-edited instead of regenerated → drift.
- **External coupling** (Vercel env, DB name, domain DNS, GitHub repo, Apple bundle id, code signing) drifting from the code if not coordinated.
- **Extension ↔ web message contract** mismatch silently breaks retail sync.

---

## 9. Open questions / decisions (resolve in Phase 0)

1. **npm scope** — confirm `@moat/*` → `@moat/*` (vs `@moat-finance/*`). Spec assumes `@moat/*`.
2. **Desktop app ID** — `com.moatfinance.desktop` vs `com.moat.desktop`. Affects updater/signing identity; pick once.
3. **Postgres DB name** — rename `moat_finance_dev` → `moat_dev`, or leave the physical DB and only change local examples? (Renaming a live DB is operational, not just code.)
4. **Domain** — ✅ **Decided: `moatfinance.ai`** (replacing `moatfinance.ai`; hosts become `app.moatfinance.ai` / `api.moatfinance.ai`, feedback email `tyler@moatfinance.ai`). Remaining sub-decision: confirm DNS, TLS, Vercel domain config, and mailbox are provisioned before/with the code swap, and whether to keep the old domain redirecting during transition.
5. **GitHub repo** — rename repo `fin` → `moat`? Affects `publish.repo`, workflow URLs, clone paths.
6. **`package-lock.json`** — the repo is pnpm-based (`pnpm-lock.yaml`, `packageManager: pnpm`). Is the root `package-lock.json` stale/removable, or intentionally present?
7. **Token back-compat** — invalidate `moat_finance_*` tokens or accept both during transition?
8. **iOS bundle id / App Store record** — renaming product name & bundle id has App Store Connect implications; confirm whether this is a fresh identity or in-place rename.

---

## 10. Definition of done

- All eight app surfaces build, typecheck, lint, and run.
- No unintended `fin`/`Moat Finance` identifiers remain (grep audit in §9 clean aside from `financial`/`finance`/`Finicity` and other documented false positives).
- Desktop existing-user data migrates without loss.
- Lockfiles and generated clients regenerated, not hand-edited.
- Docs/specs reflect the new naming convention table (§1).
- This spec moved to `specs/complete/` once shipped.

---

## 11. Production deployment checklist (post-merge)

Code is ready to ship once these operational steps are done **at deploy time**:

| Step | Action |
|------|--------|
| Vercel (web + api) | Add `MOAT_*` env vars; keep legacy `FIN_*` vars during transition (code accepts both) |
| Vercel domains | Point `app.moatfinance.ai` and `api.moatfinance.ai`; optionally redirect `financewithfin.com` |
| Extension `.env.production` | Already uses `WXT_MOAT_*`; rebuild and publish to Chrome Web Store |
| Web extension ID | Set `NEXT_PUBLIC_MOAT_RETAIL_EXTENSION_ID` in Vercel |
| Postgres | `.env.example` uses `moat_dev`; physical DB rename is optional |
| Desktop | New `com.moatfinance.desktop` app ID requires fresh code-signing/updater identity |
| iOS | New bundle ID `com.moatfinance.app` may need App Store Connect update |
| GitHub | Optional repo rename `fin` → `moat` for desktop auto-updater `publish.repo` |
| Email | Provision `tyler@moatfinance.ai` and update `EMAIL_FROM` / `FEEDBACK_RECIPIENT` |

### Intentional legacy identifiers (do not remove)

- `finUserId` / `finAccessToken` in extension auth storage and redirect params (dual-read with `moat*`; web writes both during transition)
- PostHog events `moat_finance_ai_*` (preserve analytics history)
- Component paths `fin-ai-panel/` (internal file names, not user-facing)
- Desktop migration constants `Moat Finance/` folder and `fin.db` filename
- Historical specs in `specs/complete/` (archival context)

---

## Follow-up: identifier cutover (2026-07)

A later pass completed the remaining Fin→Moat **code identifier** cleanup across apps and packages
(`FinAi*`/`FinAgent*`/`FinWidget*`/`FinApiClient`/`finCard`/env vars/localStorage/URL scheme, etc.).
Historical notes in `specs/complete/**` and applied Prisma migration folder names may still mention Fin;
those are intentionally left as historical records.
