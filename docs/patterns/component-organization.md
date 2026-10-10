# Pattern: Component Organization

## Overview

Components in `apps/web` are organized by domain, not by type. Each file should export one primary component. When a file grows beyond ~200 lines or contains multiple distinct sub-components, extract them into sibling files.

---

## Directory structure

Components live in `apps/web/src/components/[domain]/`. Base UI primitives (shadcn/ui) live in `components/ui/`.

```
components/
├── ui/                    ← shadcn/ui primitives (Button, Dialog, Input, etc.)
├── dashboard/             ← Dashboard-specific components
├── charts/                ← Reusable chart components
├── transactions/          ← Transaction list, row, filters, edit dialog
│   ├── transaction-list.tsx
│   ├── transaction-row.tsx
│   ├── transaction-filters.tsx
│   └── edit-dialog/       ← Sub-directory for complex dialogs
│       ├── index.tsx
│       ├── category-input.tsx
│       └── merchant-input.tsx
├── auth/
└── ...
```

---

## When to extract to a sub-directory

When a component file:
- Exceeds ~200-250 lines and has multiple named sub-components
- Contains logic that could independently be reused
- Has sub-components that make the parent file hard to navigate

Create a sub-directory with an `index.tsx` as the public entry point and sibling files for extracted pieces.

```ts
// ✅ Extracted sub-components
// components/rules/rule-builder-dialog/index.tsx      ← exports RuleBuilderDialog
// components/rules/rule-builder-dialog/condition-row.tsx
// components/rules/rule-builder-dialog/action-row.tsx
// components/rules/rule-builder-dialog/preview-row.tsx

// ❌ Everything in one file
// components/rules/rule-builder-dialog.tsx  ← 400+ lines with 5 components
```

---

## Utility functions

Extract utility/helper functions into `src/lib/` when they:
- Are reused across multiple components
- Contain logic that benefits from independent testing
- Add noise to a component file (>10 lines of non-JSX logic)

Small one-liners can live inline. Everything else: `src/lib/[feature]-utils.ts`.

---

## Anti-patterns

- **Don't mix multiple unrelated domains in one component directory.** `components/transactions/` should not contain household-management components.
- **Don't create a deeply nested component hierarchy (>3 levels).** Flat is better.
- **Don't export multiple primary components from one file.** One file = one exported component.
- **Exception**: hooks files and store files can be longer — the single-responsibility rule mainly applies to `.tsx` files.
