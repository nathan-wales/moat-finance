# iOS Category Picker Sheet

## Status

Draft. Created 2026-07-17 after reviewing transaction edit/bulk menus and rules category menus in `apps/ios`.

## Goal

Replace inline category `Menu` dropdowns with a shared full-height native category picker sheet that supports search, SF Symbol icons, and creating a new category — used wherever a category is assigned on iOS.

Success means:

- Edit transaction, split rows, bulk change category, and rules category pickers all open the same sheet
- The sheet opens at the large detent (full height), with search and icons
- Create new category is the top action and can create + select in one flow
- Edit-transaction Category field matches the Hashtags label-above / field-below layout

## Product Context

Users need a scannable, searchable category list when assigning categories, including the ability to create a custom category without leaving the transaction or rule flow.

## Current Repo Context

| Entry point | File | Current UX |
|-------------|------|------------|
| Edit transaction | `apps/ios/Moat/Features/Transactions/Views/transactions-view.swift` (`TransactionDetailSheet`) | `Menu` of name strings; label inside the field |
| Split rows | same | `Menu` of name strings |
| Bulk actions | same (`BulkTransactionsSheet`) | `Menu` titled “Change Category” |
| Rules editor | `apps/ios/Moat/Features/Rules/Views/rule-editor-sheet.swift` (`ruleEditorCategoryMenu`) | `Menu` of `CategoryItem` names |
| Category icons | `apps/ios/Moat/Features/Categories/Models/category-models.swift` | `CategoryItem.systemImage` SF Symbol map |
| Create category API | `apps/ios/Moat/Features/Categories/Services/categories-service.swift` | `create(name:)` → `/api/v1/category/create` |
| List categories API | same | `load()` → `/api/v1/category/list` |
| Sheet chrome | `apps/ios/Moat/Core/DesignSystem/Sheets/moat-glass-sheet.swift` | Default `[.medium, .large]`; full forms use `[.large]` |

`TransactionDetailSheet` is also presented from Dashboard and Income Insights.

### Existing building blocks to reuse

| Asset | Location | Notes |
|-------|----------|-------|
| `CategoryItem.systemImage` | `category-models.swift` | Default name → SF Symbol; custom → `tag.fill` |
| `CategoriesService` | `categories-service.swift` | List + create |
| Connect search field | `connect-institution-sheet.swift` | Custom magnifying-glass `TextField` in-sheet |
| Large detent sheets | financial-profile / MCP token sheets | `.presentationDetents([.large])` |

## Target Experience

1. User taps Category field (or Change Category / rules category control).
2. Full-height sheet titled “Category” slides up with drag indicator.
3. Search field at top filters the list.
4. First row: Create new category (plus icon) → nested create sheet (name + Save) → select new name and dismiss.
5. Remaining rows: icon + name; checkmark on current selection; tap selects and dismisses.

Edit-transaction Category field layout:

```
Category                    ← footnote/semibold secondary label above
[ icon  Salary          > ] ← mutedSurface tappable field
```

## Implementation Plan

### Phase 1 — Shared picker
1. Add `CategoryPickerSheet` under Categories/Views; register in Xcode project.
2. Self-load non-hidden categories; search; create nested sheet; icons via `CategoryItem`.

**Acceptance criteria:** Picker loads, filters, creates, and returns a selected name.

### Phase 2 — Wire call sites
1. Restyle edit Category like Hashtags; present picker from edit, splits, bulk, rules.
2. Keep filter-by-category menus unchanged.

**Acceptance criteria:** All assignment entry points use the shared sheet.

## Acceptance Criteria

- [x] Edit-transaction Category uses Hashtags-style label-above / field-below layout
- [x] Tapping that field opens `CategoryPickerSheet` at `.large` detent
- [x] Split category, bulk Change Category, and rules Set category / Category condition open the same sheet
- [x] Search filters categories; Create new category is the first list option
- [x] Listed categories show SF Symbol icons; custom categories use `tag.fill`
- [x] Filter-by-category UI remains a menu (unchanged)

## Non-Goals

- Per-category custom icon/color picker
- Changing filter-by-category UX
- Prompt library categories
- Web or desktop parity in this change

## Open Questions

- None

## Related Specs

- None

## Suggested Commit Message

```text
feat (ios): adds full category picker sheet
```
