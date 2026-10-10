# Web Playwright Golden (Plaid)

This is the Phase 4 UI runner for the Golden Ledger. It does **not** open Plaid Link. The iframe is replaced by a test-only seam that is active only when both are true:

1. `NEXT_PUBLIC_E2E=1` (build/dev-time; production deploys must leave this unset)
2. `window.__moatGoldenPlaid` is injected by the test (`addInitScript`)

## Session cookie

`e2e/session.ts` mints an Auth.js v5 JWT with `encode()` from `next-auth/jwt`.

- Cookie name: `authjs.session-token` (development salt)
- Secret: `AUTH_SECRET` (must match `moat-web` and `moat-api`)
- Claims: `id` / `sub` = seeded Postgres `User.id`, plus `email`

`global-setup.ts` writes that cookie to `e2e/.auth/user.json` as Playwright `storageState`. The dashboard layout and the `/api/v1` proxy both authenticate from it. CSRF is derived from the same cookie via `getCsrfToken()`.

The first-run “financial guidance” dialog is skipped via `localStorage` in `golden-fixture.ts` so it cannot intercept Connect.

## Local run

Playwright loads `DATABASE_URL` / `AUTH_SECRET` from `apps/api/.env` when those are not already in the shell. CI supplies an ephemeral Postgres URL instead. Postgres must already be migrated (`pnpm db:migrate:deploy`). Then:

```sh
pnpm --filter moat-web run test:e2e:plaid-golden
```

Playwright boots the Golden mock (`:18080`), API (`:3101`), and web (`:3100`) so it does not collide with a local `pnpm dev` on 3000/3001.
