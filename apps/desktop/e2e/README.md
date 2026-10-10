# Desktop Playwright Golden (Plaid)

Phase 5 UI runner for the Golden Ledger. It launches an **unpacked** Electron build (`electron-vite build` → `out/main/index.js`), not `dist:mac`.

Plaid Link is not opened. The renderer reads `MOAT_E2E_GOLDEN_PLAID_JSON` through a preload getter that returns `null` unless `MOAT_E2E=1`. Dumping the ledger uses a main-process `globalThis` hook that is registered only when `MOAT_E2E=1` and `!app.isPackaged`.

CI launches this same unpacked build. It does **not** run `dist:linux` / electron-builder. It does download the Electron npm runtime (`pnpm --filter moat-desktop run ensure-electron`) because Playwright needs that binary, and other jobs skip it via `ELECTRON_SKIP_BINARY_DOWNLOAD=1`.

## Local run

```sh
PLAID_CLIENT_ID=golden-client-id PLAID_SECRET=golden-secret \
  pnpm --filter moat-desktop run build
pnpm --filter moat-desktop run test:e2e:plaid-golden
```

Playwright boots the Golden mock on `:18080` (`start-mock:desktop`). Catch-up delays are injected via `PLAID_CATCH_UP_DELAYS_MS` / `PLAID_HISTORICAL_CATCH_UP_DELAYS_MS` so the test can disable `disabledChecking` after the initial pages land.
