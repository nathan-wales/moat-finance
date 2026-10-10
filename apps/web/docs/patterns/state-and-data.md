# Pattern: State and Data (apps/web)

## The two-layer model

| Layer | Tool | Owns |
|-------|------|------|
| Server state | React Query | Data from `apps/api`: loading, caching, refetching, mutation lifecycle |
| UI state | Zustand | Client-only state: modals, filters, selected rows, sidebar open/closed |

Never manage server data in Zustand. Never put UI-only state in React Query.

---

## React Query — server state

### OpenAPI client hooks

`apps/web` uses an OpenAPI-generated client from `packages/openapi/`. React Query hooks are built on top of this client in `src/lib/api/`.

```ts
// src/lib/api/transactions.ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "~/lib/api/client";

export function useTransactions(filters: TransactionFilters) {
  return useQuery({
    queryKey: ["transactions", filters],
    queryFn: () => apiClient.transactions.list(filters),
  });
}

export function useUpdateTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateTransactionInput) =>
      apiClient.transactions.update(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transactions"] });
    },
  });
}
```

### Query key conventions

- Use an array: `["domain", filters]`
- Top-level key matches the resource name: `"transactions"`, `"accounts"`, `"budget"`
- When invalidating after mutations, invalidate by top-level key to clear all related queries

### Cache invalidation

After a mutation succeeds, invalidate related queries with `queryClient.invalidateQueries`. Don't try to manually update the cache unless the optimistic update is clearly worthwhile.

```ts
// Prefer broad invalidation over surgical cache updates
qc.invalidateQueries({ queryKey: ["transactions"] });
qc.invalidateQueries({ queryKey: ["budget"] });
```

---

## Zustand — UI state

Stores live in `src/lib/`. Each store is scoped to a domain.

### Basic store pattern

```ts
// src/lib/transaction-filter-store.ts
import { create } from "zustand";
import { useShallow } from "zustand/react/shallow";

type TransactionFilterState = {
  search: string;
  categoryId: string | null;
  dateRange: DateRange | null;
  setSearch: (s: string) => void;
  setCategoryId: (id: string | null) => void;
  setDateRange: (r: DateRange | null) => void;
  reset: () => void;
};

const initialState = {
  search: "",
  categoryId: null,
  dateRange: null,
};

export const useTransactionFilterStore = create<TransactionFilterState>(
  (set) => ({
    ...initialState,
    setSearch: (search) => set({ search }),
    setCategoryId: (categoryId) => set({ categoryId }),
    setDateRange: (dateRange) => set({ dateRange }),
    reset: () => set(initialState),
  })
);

// Focused selector hook — avoids re-renders from unrelated state changes
export const useFilterState = () =>
  useTransactionFilterStore(
    useShallow((s) => ({
      search: s.search,
      categoryId: s.categoryId,
      dateRange: s.dateRange,
    }))
  );
```

### Immer — only when deeply nested

Use `immer` middleware only when updates require modifying deeply nested objects. For flat or shallow state (booleans, IDs, modals), plain `set` is always preferred.

```ts
// ✅ Plain set — fine for simple state
set({ isOpen: true });
set({ selectedId: id });

// ✅ Immer — warranted for deeply nested mutation
set(produce((draft) => {
  draft.rules[ruleId].conditions[condIndex].value = newValue;
}));
```

### Dependency injection

Stores that need to call the API or access external state should receive those dependencies through setter calls, not through props or imports inside the store:

```ts
// ✅ Inject API client via setter after provider mounts
useEffect(() => {
  useMyStore.getState().setApiClient(apiClient);
}, [apiClient]);
```

---

## When you are doing X → read Y

| Change type | Read |
|-------------|------|
| Adding a new API endpoint's hooks | This file, plus [../../docs/patterns/api-patterns.md](../../../../docs/patterns/api-patterns.md) |
| Splitting a store that's getting large | [../../docs/patterns/state-management.md](../../../../docs/patterns/state-management.md) |
| Adding optimistic updates | This file (Cache invalidation section) |
| Writing tests for hooks/stores | [testing.md](testing.md) |
