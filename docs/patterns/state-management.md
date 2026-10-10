# Pattern: State Management

## Overview

Moat Finance uses two state layers:

- **Zustand** — UI state, client-side interactions, modal open/close, selected filters, optimistic updates
- **React Query** — server state, data fetched from `apps/api`, caching, background refetching

Keep them separate. Don't put server data in Zustand; don't put pure UI state in React Query.

---

## Zustand: UI state

### Where stores live

Stores live in `apps/web/src/lib/`. Name them `[domain]-store.ts` (e.g., `transaction-filter-store.ts`).

### Default: plain `set`

Use standard Zustand `set` for most updates. Plain `set` is readable, fast, and doesn't require Immer:

```ts
// ✅ Plain set — clear and direct
export const useTransactionFilterStore = create<TransactionFilterState>((set) => ({
  selectedCategory: null,
  dateRange: null,
  searchQuery: "",

  setCategory: (category) => set({ selectedCategory: category }),
  setDateRange: (range) => set({ dateRange: range }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  resetFilters: () => set({ selectedCategory: null, dateRange: null, searchQuery: "" }),
}));
```

### Immer: opt-in for complex nested state

Only use `immer` middleware when you have deeply nested state that plain `set` makes unreadable. Don't use it by default:

```ts
// ✅ Immer is justified — nested mutation is clean
import { immer } from "zustand/middleware/immer";

const useRuleBuilderStore = create(immer<RuleBuilderState>((set) => ({
  rule: {
    conditions: [],
    actions: [],
    metadata: { name: "", enabled: true },
  },

  addCondition: (condition) =>
    set((state) => { state.rule.conditions.push(condition); }),

  updateAction: (index, update) =>
    set((state) => { Object.assign(state.rule.actions[index], update); }),
})));

// ❌ Immer for simple state — unnecessary
const useModalStore = create(immer<ModalState>((set) => ({
  isOpen: false,
  toggle: () => set((state) => { state.isOpen = !state.isOpen; }),
  // Plain set would be: toggle: () => set((s) => ({ isOpen: !s.isOpen }))
})));
```

### Selectors: `useShallow` for objects

Use `useShallow` when selecting objects or arrays to prevent unnecessary re-renders:

```ts
import { useShallow } from "zustand/react/shallow";

// ✅ useShallow prevents re-render when object contents haven't changed
const { selectedCategory, dateRange } = useTransactionFilterStore(
  useShallow((s) => ({ selectedCategory: s.selectedCategory, dateRange: s.dateRange }))
);

// ❌ Object selector without useShallow — creates new reference on every call
const filters = useTransactionFilterStore((s) => ({
  selectedCategory: s.selectedCategory,
  dateRange: s.dateRange,
}));
```

### Expose focused selector hooks

Export a named hook for each logical slice instead of exposing the whole store to consumers:

```ts
// ✅ Focused selector hook — consumers get only what they need
export const useFilterState = () =>
  useTransactionFilterStore(
    useShallow((s) => ({ selectedCategory: s.selectedCategory, dateRange: s.dateRange }))
  );

export const useFilterActions = () =>
  useTransactionFilterStore(
    useShallow((s) => ({ setCategory: s.setCategory, setDateRange: s.setDateRange, reset: s.resetFilters }))
  );
```

### Inject external dependencies via setters

Don't pass external services (API clients, routers) as props to store consumers. Inject them once via a setter:

```ts
// ✅ Inject router via setter (e.g., in a top-level provider)
const useNavigationStore = create<NavigationState>((set) => ({
  router: null,
  setRouter: (router) => set({ router }),
}));

// In a component: useNavigationStore.getState().setRouter(router)
```

---

## React Query: server state

### Where hooks live

Queries and mutations are generated from the OpenAPI spec via Orval and live in `apps/web/src/lib/api/`. Use these generated hooks — don't hand-write `fetch` calls or `useEffect` for data loading.

```ts
// ✅ Use the generated React Query hook
import { useGetTransactions } from "~/lib/api/transactions";

function TransactionList() {
  const { data, isLoading, error } = useGetTransactions({ category: "food" });
  // ...
}

// ❌ Don't fetch in useEffect
function TransactionList() {
  const [data, setData] = useState(null);
  useEffect(() => {
    fetch("/api/transactions").then(r => r.json()).then(setData);
  }, []);
}
```

### When to use React Query vs Zustand

| Use case | Use |
|----------|-----|
| Data from `apps/api` | React Query |
| Caching + background refetch | React Query |
| Modal open/close | Zustand |
| Active filters / selected items | Zustand |
| Form state | React Hook Form (local state) |
| Optimistic updates | React Query `onMutate` |
| UI loading/skeleton state driven by API data | React Query `isLoading` |

### Mutations

Use generated mutation hooks. Handle errors explicitly — don't let failures fail silently:

```ts
const { mutate: createGoal, isPending } = useCreateGoal({
  onSuccess: () => {
    toast.success("Goal created");
    queryClient.invalidateQueries({ queryKey: ["goals"] });
  },
  onError: (error) => {
    toast.error("Failed to create goal");
    logger.error("create_goal_failed", { error });
  },
});
```

---

## Anti-patterns

```ts
// ❌ Server data in Zustand
const useGoalStore = create((set) => ({
  goals: [],
  fetchGoals: async () => {
    const data = await fetch("/api/goals").then(r => r.json());
    set({ goals: data });
  },
}));
// Use React Query for this — it handles caching, deduplication, background refresh

// ❌ Complex UI state in React Query
const { data: isDrawerOpen } = useQuery({
  queryKey: ["drawer-state"],
  queryFn: () => false,
});
// Use Zustand for pure UI state

// ❌ Immer everywhere
const useSimpleStore = create(immer((set) => ({
  count: 0,
  increment: () => set((s) => { s.count++; }),
  // Plain: increment: () => set((s) => ({ count: s.count + 1 }))
})));

// ❌ New state management library
import { atom } from "jotai";
// Don't introduce Jotai, MobX, Redux, or other patterns — Zustand is the standard
```
