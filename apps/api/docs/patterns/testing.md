# Pattern: Testing (apps/api)

The API uses **`node:test` via `tsx`**. There is no Jest or Vitest. Tests live next to the code they cover (`*.test.ts`), not in `__tests__/` folders.

## Testing matrix by change type

| Change type | Test approach | Location |
|-------------|---------------|----------|
| Service function (unit) | `node:test` with a `createMockDb()` fake | `src/server/services/*.test.ts` |
| Handler / auth / contracts | Request-level contract tests | `src/server/handlers/*.test.ts`, `src/server/lib/*.test.ts` |
| Plaid Golden Ledger | Headless ingest against the mock Plaid server + Postgres | `src/server/plaid/golden/` (`test:plaid-golden`) |
| Plaid Sandbox compatibility | Nightly smoke (skipped without secrets) | `src/server/plaid/sandbox-smoke.test.ts` |
| Prisma model / query | Integration test against the ephemeral CI Postgres | Golden runners; never the shared Neon |

---

## Service unit tests

Do not use `jest.mock`. Build a typed fake Prisma client (see existing `createMockDb()` helpers) and pass it into the service.

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { listGoals } from "../goal.service";

describe("goalService.listForUser", () => {
  it("returns goals for the given userId", async () => {
    const db = {
      goal: {
        findMany: async () => [{ id: "1", name: "Emergency Fund", userId: "user-1" }],
      },
    };
    const result = await listGoals("user-1", db as never);
    assert.equal(result.length, 1);
  });
});
```

---

## Golden Ledger vs unit tests

Unit tests pin local invariants (mapping, watermarks, pairing helpers, unsigned webhook 401). They do **not** replace the Golden Ledger.

`pnpm --filter moat-api run test:plaid-golden` starts a mock Plaid server, migrates empty Postgres, and runs production `exchangePublicTokenForItem` / webhook / job-worker code. The dump must equal `@moat/plaid-golden-ledger`'s `expected-state`. Reconnect variations live in `reconnect-ledger.test.ts`.

Playwright UI Golden is separate (`pnpm --filter moat-web run test:e2e:plaid-golden`). It still dumps through the same helper; it does not talk to Plaid Sandbox.

---

## What to test vs. what to skip

**Test:**
- Service functions with business logic (calculations, ownership checks, data transformation)
- Handler input validation (Zod parsing errors)
- Webhook signature verification (unsigned POST → 401)
- Golden ingest, idempotency, reconnect, and mutation phases

**Skip:**
- Trivial passthrough services (pure Prisma read with no transformation)
- Route files (they just wire handlers to methods)

---

## Test database strategy

`test:api-contracts` needs no database and runs in CI. Golden tests (`test:plaid-golden`) require a migrated Postgres 16 `DATABASE_URL` (e.g. `./start-database.sh` + `pnpm db:migrate:deploy`). Never run tests against the shared Neon instance.

---

## Running tests

```bash
# From repo root
pnpm --filter moat-api run test:api-contracts
pnpm --filter moat-api run test:plaid-golden

# Nightly Sandbox smoke (no-ops without PLAID_SANDBOX_* GitHub secrets, or local PLAID_*)
pnpm --filter moat-api run test:plaid-sandbox-smoke
```

---

## When you are doing X → read Y

| Change type | Read |
|-------------|------|
| Setting up a test for a new service | This file (service unit test section) |
| Testing a Plaid or external integration | [external-integrations.md](external-integrations.md) |
| Testing auth behavior | [auth-and-permissions.md](auth-and-permissions.md) |
| Golden Ledger fixture / expected-state | [apps/web/e2e/README.md](../../../web/e2e/README.md) |
