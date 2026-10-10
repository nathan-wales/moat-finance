# Category Overrides

## Status

Implemented 2026-08-21. Sparse per-user `CategoryOverride` overlay on global default categories.

## Goal

Let each user rename, re-icon, hide, or remove Moat default categories without cloning the catalog per user.

Success means:

- Default categories keep stable global IDs for transactions, rules, budgets, and provider mapping
- Name, icon, and visibility changes are per-user
- Hiding a default no longer mutates the shared `Category` row
- Removing a default tombstones it for that user; Uncategorized and Transfer stay protected

## Product Context

Users can already edit custom categories. Defaults are a shared chart of accounts used by Plaid/Apple mapping. Customizing presentation (label, icon, visibility) should feel the same as custom categories without forking IDs or blocking new Moat defaults.

## Current Repo Context

| Asset | Location | Notes |
|-------|----------|-------|
| Global defaults | `apps/api/prisma/schema.prisma` `Category` (`userId` null, `isDefault`) | Seeded from `packages/category-mapping/src/canonical-categories.ts` |
| Category API | `apps/api/src/server/handlers/category.ts` | `update`/`delete` require `userId`; `toggleHidden` writes the shared row |
| Hidden-category scope | `apps/api/src/lib/transaction-scope.ts` | `NOT EXISTS` on `Category.isHidden` |
| Desktop categories | `packages/db-sqlite/src/repositories/SqliteCategoryRepository.ts` | Same hide-on-shared-row bug in a single-user DB |
| Categories UI | `packages/features/src/categories/` | Edit/delete hidden for `isDefault` |
| iOS categories | `apps/ios/Moat/Features/Categories/` | Actions gated on `isUserOwned` |

### Existing building blocks to reuse

| Asset | Location | Notes |
|-------|----------|-------|
| Handler wrappers | `apps/api/src/server/handler-wrappers.ts` | `withAuth` / `withDemoOrAuth` |
| Category DTO | `packages/contracts/src/api-client.ts` `Category` | Clients should keep seeing a flat category |
| Category repository | `packages/data-access/src/repositories/CategoryRepository.ts` | Desktop implements this |

## Target Experience

- Default rows show edit, hide, and delete (except protected defaults)
- Edit dialog works for defaults: name + icon
- Hide still means “exclude this category’s transactions from spending/budget scope”
- Delete on a default removes it from pickers and hides its transactions; it stays in the hidden section so the eye control can restore it
- Delete on a custom category still remaps transactions to Uncategorized and drops the row
- Uncategorized cannot be hidden or removed; Transfer cannot be removed

## Architecture / Data Model

Sparse per-user overlay. Null overlay fields inherit the global category.

```prisma
model CategoryOverride {
  id         String   @id @default(cuid())
  userId     String
  categoryId String
  name       String?
  icon       String?
  isHidden   Boolean?
  isRemoved  Boolean  @default(false)
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  @@unique([userId, categoryId])
}
```

Reads merge `COALESCE(override.field, category.field)`. `isRemoved` implies hidden. Provider mapping continues to use canonical `Category.name`.

## Acceptance Criteria

- [x] User can rename and change the icon of a default category; other users still see the canonical name/icon
- [x] Hiding a default category hides that user’s transactions only
- [x] Removing a default does not delete the global row or remap historical transactions
- [x] Uncategorized cannot be hidden or removed; Transfer cannot be removed
- [x] New canonical defaults still appear for existing users until they override them
- [x] Web, desktop, and iOS category management expose edit/hide/delete on defaults (with protected exceptions)

## Non-Goals

- Per-user copies of the default catalog at signup
- Changing Plaid/Apple mapping to use display names
- Desktop cloud-backup of override rows in this change
- Reset-all-defaults UI

## Open Questions

None for this iteration. Tombstone vs hide: tombstone is delete-on-default; hide keeps the category in pickers but excludes transactions.

## Related Specs

- `specs/complete/apple-finance-kit-categories.spec.md` — canonical default catalog
- `specs/complete/desktop-electron-app/phase-4-desktop-v1-beta.spec.md` — desktop default seed

## Suggested Commit Message

```text
feat: add per-user default category overrides
```
