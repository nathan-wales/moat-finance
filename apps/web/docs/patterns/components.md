# Pattern: Components (apps/web)

## Directory organization

Components are organized by domain under `src/components/`. Shared primitives live in `components/ui/`.

```
src/components/
├── ui/                     ← shadcn/ui primitives (Button, Input, Dialog, etc.)
├── charts/                 ← Chart components (Recharts wrappers)
├── dashboard/              ← Dashboard-specific widgets
├── transactions/           ← Transaction table, filters, modals
├── spending/               ← Spending breakdown, category charts
├── budget/                 ← Budget rows, progress bars
├── accounts/               ← Account cards, balance displays
├── rules/                  ← Rule builder dialog and related components
│   └── rule-builder-dialog/
│       ├── index.tsx       ← Dialog shell, exported entry point
│       ├── condition-row.tsx
│       ├── action-row.tsx
│       ├── category-input.tsx
│       └── preview-row.tsx
├── agent/                  ← AI agent chat interface
├── onboarding/             ← Onboarding flow steps
└── layout/                 ← Shell components (sidebar, top nav, mobile nav)
```

---

## Single responsibility per file

Each `.tsx` file exports one primary component. When a component file grows beyond ~200 lines and contains multiple distinct sub-components, split it into a sub-directory:

```
# Before — one large file
components/rules/rule-builder-dialog.tsx  (~350 lines, 4 sub-components)

# After — sub-directory split
components/rules/rule-builder-dialog/
  index.tsx          ← Dialog shell (re-exports from here)
  condition-row.tsx  ← One sub-component per file
  action-row.tsx
  category-input.tsx
  preview-row.tsx
```

This rule **does not apply** to stores or hooks. Only `.tsx` files that render UI.

---

## Design system primitives

Interactive UI primitives (Button, Input, Select, Dialog, Sheet, Card, Checkbox, etc.) come from the Moat design system:

- **Shared / cross-platform UI** (`packages/features`, desktop renderer): import from `@moat/ui`.
- **Web app-local UI**: import from `~/components/ui/[name]` or `@moat/ui`.
- **Never use native HTML controls** (`<button>`, `<select>`, etc.) when a design-system primitive exists.
- **Never build a primitive from scratch** if a design-system equivalent exists.
- **Never import Radix directly** in app or feature code — go through `@moat/ui` / `~/components/ui`.
- Customize via Tailwind variants (using `cva` from `class-variance-authority`) — not by adding one-off inline style overrides.

```tsx
// ✅ Correct — design system
import { Button, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@moat/ui";
// or, in apps/web local code:
import { Button } from "~/components/ui/button";

// ❌ Wrong — native HTML when a primitive exists
<select onChange={...}><option>...</option></select>
<button type="button">Save</button>

// ❌ Wrong — importing from Radix directly
import * as Dialog from "@radix-ui/react-dialog";
```

---

## Domain component conventions

- **Co-locate related things.** If a component only makes sense within a domain (e.g. `TransactionRow` only makes sense in `transactions/`), put it there — not in `components/ui/`.
- **No auth/permission logic in components.** Hide UI elements for UX clarity, but never treat component visibility as access control.
- **No direct API calls in components.** Components consume React Query hooks. Never call `fetch()` or the API client directly inside a component.

---

## Conditional logic in JSX

Do not put ternaries inside JSX. Compute conditional values before `return` and reference them in markup.

```tsx
// ✅ Correct — const before return
const inviteTitle = referrerFirstName
  ? `${referrerFirstName} invited you to Moat Finance`
  : "You've been invited to Moat Finance!";

return <CardTitle>{inviteTitle}</CardTitle>;

// ❌ Wrong — ternary in JSX
return (
  <CardTitle>
    {referrerFirstName
      ? `${referrerFirstName} invited you to Moat Finance`
      : "You've been invited to Moat Finance!"}
  </CardTitle>
);
```

Rules:

- **One ternary per expression** — never nest (`a ? b : c ? d : e`).
- **Multi-branch logic** — extract a helper function instead of chaining ternaries or nesting `{condition ? ... : ...}` blocks.
- **Conditional rendering** — prefer early return, `&&`, or a small render helper over inline ternaries when swapping component trees.

---

## Naming conventions

- Files: kebab-case — `transaction-filter-bar.tsx`
- Component exports: PascalCase — `export function TransactionFilterBar()`
- Props types: `[ComponentName]Props` — `type TransactionFilterBarProps = { ... }`

---

## When you are doing X → read Y

| Change type | Read |
|-------------|------|
| Adding data fetching to a component | [state-and-data.md](state-and-data.md) |
| Adding auth-gated UI | [auth-and-sessions.md](auth-and-sessions.md) |
| Writing component tests | [testing.md](testing.md) |
| Adding a new route/page | [routing-and-pages.md](routing-and-pages.md) |
