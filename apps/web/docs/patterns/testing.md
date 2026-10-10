# Pattern: Testing (apps/web)

## Testing matrix by change type

| Change type | Test approach | Location |
|-------------|---------------|----------|
| React component (pure UI) | Render test with React Testing Library | `src/components/[domain]/__tests__/` |
| Custom React hook | Hook test with `renderHook` | `src/lib/hooks/__tests__/` |
| Zustand store | Direct store unit test | `src/lib/__tests__/` |
| Page-level integration | Mock API + render the page | `src/app/[route]/__tests__/` |
| Critical user flow (e2e) | Playwright Golden Ledger | `e2e/` (`test:e2e:plaid-golden`) |

---

## Component tests

Use React Testing Library. Test behavior, not implementation details.

```tsx
// components/transactions/__tests__/transaction-row.test.tsx
import { render, screen } from "@testing-library/react";
import { TransactionRow } from "../transaction-row";

describe("TransactionRow", () => {
  it("renders merchant name and amount", () => {
    render(
      <TransactionRow
        transaction={{ id: "1", merchant: "Costco", amount: -45.99 }}
      />
    );
    expect(screen.getByText("Costco")).toBeInTheDocument();
    expect(screen.getByText("-$45.99")).toBeInTheDocument();
  });
});
```

---

## Hook tests

Test custom React Query hooks by wrapping in a `QueryClientProvider` and using MSW or a mock API client.

```tsx
// lib/hooks/__tests__/use-transactions.test.tsx
import { renderHook, waitFor } from "@testing-library/react";
import { createWrapper } from "~/test-utils/query-wrapper";
import { useTransactions } from "../use-transactions";

it("returns transaction list from API", async () => {
  const { result } = renderHook(() => useTransactions({}), {
    wrapper: createWrapper(),
  });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(result.current.data?.transactions).toHaveLength(3);
});
```

---

## Zustand store tests

Test stores directly — no React rendering needed.

```ts
// lib/__tests__/transaction-filter-store.test.ts
import { useTransactionFilterStore } from "../transaction-filter-store";

beforeEach(() => {
  useTransactionFilterStore.getState().reset();
});

it("updates search filter", () => {
  useTransactionFilterStore.getState().setSearch("amazon");
  expect(useTransactionFilterStore.getState().search).toBe("amazon");
});
```

---

## What to test vs. what to skip

**Test:**
- Business logic in utility functions (`budget-utils.ts`, `forecasting.ts`)
- Custom hooks that contain non-trivial logic
- Components with conditional rendering driven by data
- Store actions that perform derivations or validations

**Skip:**
- Passthrough components (pure layout, no logic)
- Trivial getter/setter store actions
- shadcn/ui primitives (tested upstream)

---

## Running tests

```bash
# Plaid Golden Playwright (requires local Postgres + migrate)
pnpm --filter moat-web run test:e2e:plaid-golden

# Desktop Electron Golden (unpacked build, not dist:mac)
pnpm --filter moat-desktop run test:e2e:plaid-golden
```

Web Golden injects an Auth.js session cookie (`e2e/session.ts`) and a test-only Plaid Link seam (`NEXT_PUBLIC_E2E=1` plus `window.__moatGoldenPlaid`). See [e2e/README.md](../../e2e/README.md).

These UI tests mock **Plaid's server**, not Moat sync/rules/pairing. Headless runners (`test:plaid-golden` on api and desktop) plus Playwright Goldens run on every `staging` push. Pushing `main` does not run them. Plaid Sandbox is a nightly adapter smoke, not the Golden snapshot.

---

## When you are doing X → read Y

| Change type | Read |
|-------------|------|
| Mocking the API client in tests | Check `src/test-utils/` for existing mock setup |
| Testing auth-protected routes | [auth-and-sessions.md](auth-and-sessions.md) |
| Testing a Zustand store | This file (Zustand store tests section) |
