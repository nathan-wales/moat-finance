# Category Colors

## Status

Draft. Created 2026-09-16 after reviewing canonical categories, `CategoryOverride`, the shared category dialog, and transaction leading-icon rendering.

## Goal

Give every category a stored hex color so transaction list icons and the categories page are recognizable at a glance, without looking up color by name at render time.

Success means:

- Each of the 31 canonical defaults has a distinct, semantically grouped hex on the category record
- Users can set a color when creating a category and change it later, including on defaults
- Web and desktop show a light tinted circle with a colored glyph on the transaction list and categories page
- Renamed defaults keep their color because it lives on the record (or the per-user override), not the display name

## Product Context

Category icons today are gray (`bg-muted` / `text-muted-foreground`). Color is the cheapest extra signal for scanning a long transaction list. Spending charts already use an index-based palette; this feature does not replace that. It colors only the small category glyph.

## Current Repo Context

Categories are a shared global catalog plus per-user customs. Defaults are personalized with sparse `CategoryOverride` (name, icon, hide, parent). There is no stored color; chart colors come from `getCategoryColor(index)` in `packages/features/src/spending/spending-chart-utils.ts`.

### Existing building blocks to reuse

| Asset | Location | Notes |
|-------|----------|-------|
| Canonical defaults | `packages/category-mapping/src/canonical-categories.ts` | Seed source for Postgres and SQLite |
| Override merge | `packages/data-access/src/category-overrides.ts` | Same sparse overlay as icon |
| Category API | `apps/api/src/server/handlers/category.ts` | create/update fields |
| Desktop repo | `packages/db-sqlite/src/repositories/SqliteCategoryRepository.ts` | Mirrors API override writes |
| Shared UI | `packages/features/src/categories/` | Dialog, row, icon — web and desktop |
| Tx icon circle | `packages/features/src/transactions/transaction-leading-control.tsx` | Gray circle + glyph |
| Design system | `packages/ui` | Add ColorPicker primitive here |

## Target Experience

Transaction row leading control:

- Circle fill: stored hex at ~10% opacity
- Glyph: stored hex
- Hover still fades the badge and shows the select affordance

Categories page row:

- Same tinted circle + colored glyph next to the name

Create / Edit Category dialog, below name/icon:

- A row of preset swatches
- A Custom control that reveals `HexColorPicker` plus a hex text field
- New custom categories default to `#71717A` until the user picks another color

## Architecture / Data Model

Store hex on the row. User color changes on defaults go through `CategoryOverride.color`, matching icon.

```prisma
model Category {
  color String @default("#71717A")
}

model CategoryOverride {
  color String?
}
```

Canonical list gains `color: string` per default. Seeds and a Postgres migration backfill by canonical name (`userId IS NULL`). Remaining custom rows keep `#71717A`.

Validation:

```ts
hexColorSchema = z.string().regex(/^#[0-9A-Fa-f]{6}$/)
```

Normalize to uppercase `#RRGGBB` on write. Resolve `override.color ?? category.color`. If a default is set back to its canonical hex, store `null` on the override.

Listed transactions include resolved `categoryRef.icon` and `categoryRef.color` so the leading control does not look up by name.

## Acceptance Criteria

- [ ] Each canonical default has a unique stored hex; customs default to `#71717A`
- [ ] Create and edit category dialogs expose presets + a hex picker; save persists `color`
- [ ] Changing a default’s color is per-user (`CategoryOverride`); other users keep the seeded color
- [ ] Renaming a category does not change its color
- [ ] Transaction list leading circle/glyph uses the resolved color (web and desktop)
- [ ] Categories page glyph uses the same badge
- [ ] Invalid hex is rejected server-side / IPC-side

## Non-Goals

- iOS category color UI (API may return `color`; iOS decode ignores unknown keys)
- Recoloring spending charts or entire transaction rows
- MCP tool output changes

## Open Questions

None. Palette and surfaces were decided in the implementation plan.

## Related Specs

- [Category Overrides](../category-overrides/spec.md)
- [Category Parent Buckets](../category-parent-buckets/spec.md)

## Suggested Commit Message

```text
feat: add per-category hex colors
```
