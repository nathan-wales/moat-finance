# Rule Condition Groups

## Status

Draft. Created 2026-08-21 after reviewing `packages/features/src/rules/rule-builder-dialog.tsx`, `packages/domain/src/rules/evaluateRule.ts`, `apps/api/src/server/rules-engine/`, and `apps/ios/Moat/Features/Rules/`.

## Goal

Let users combine conditions with OR as well as AND, including `(A AND B) OR (C AND D)`, without turning the sentence-style rule builder into a parentheses / boolean-expression editor.

Success means:

- One-group rules still look like today’s AND-only builder, with an interactive ALL/ANY header and `+ Group`.
- Two or more groups render as muted gray cards with outer ALL/ANY between groups.
- Evaluation, preview, backfill, MCP, desktop, and iOS all honor the same two-level match semantics.
- Existing rules migrate to one ALL group with identical behavior.

## Product Context

Rules are the highest-leverage automation surface in Moat. Users often need “Starbucks OR Dunkin” or “(Home Depot AND amount > 100) OR (Lowes AND amount > 50)”. Today that requires separate rules. Groups keep the mental model as “all or any?” instead of teaching precedence.

## Current Repo Context

| Concern | Location |
|---------|----------|
| Domain evaluation (AND only) | `packages/domain/src/rules/evaluateRule.ts` |
| API matcher copy | `apps/api/src/server/rules-engine/conditionMatcher.ts` |
| API runner | `apps/api/src/server/rules-engine/ruleRunner.ts` |
| Backfill SQL compile | `apps/api/src/server/rules-engine/backfill/compile-rule-to-transaction-where.ts` |
| Shared builder (web + desktop) | `packages/features/src/rules/rule-builder-dialog.tsx` |
| iOS editor | `apps/ios/Moat/Features/Rules/Views/rule-editor-sheet.swift` |
| Postgres schema | `apps/api/prisma/schema.prisma` (`TransactionRule`, `TransactionRuleCondition`) |
| SQLite schema | `packages/db-sqlite/prisma/schema.prisma` |

### Existing building blocks to reuse

| Asset | Location | Notes |
|-------|----------|-------|
| `InlineRuleDropdown` | `@moat/ui` | Header ALL/ANY picker |
| `ConditionRowUI` | `packages/features/.../condition-row.tsx` | Leaf rows unchanged |
| `matchCondition` | `@moat/domain` | Leaf matcher; wrap with group/rule match |
| Monitoring `WatchFilter` | `packages/monitoring-rules` | Semantic precedent for all/any — do not reuse JSON shape |

## Target Experience

### One group (default)

```text
IF — [ ALL ▾ ] CONDITIONS MATCH

  Description  contains  "Zg"
  and
  Amount       between   $50 – $100

  + Add condition
  + Group
```

Clicking ALL offers `ALL conditions match` / `ANY condition matches`. Connectors flip between `and` and `or`.

### Two or more groups

```text
IF — [ ANY ▾ ] OF THESE MATCH

  ┌─ muted card ────────────────────┐
  │ [ ALL ▾ ] CONDITIONS MATCH      │
  │   Description contains "Amazon" │
  │   and                           │
  │   Amount > $100                 │
  │   + Add condition               │
  └─────────────────────────────────┘

                    or

  ┌─ muted card ────────────────────┐
  │ [ ALL ▾ ] CONDITIONS MATCH      │
  │   Description contains "Walmart"│
  │   and                           │
  │   Amount > $50                  │
  │   + Add condition               │
  └─────────────────────────────────┘

  + Group
```

Adding the first extra group defaults the outer combinator to ANY. Collapsing to one group drops cards and restores the simple header.

## Architecture / Data Model

```ts
{
  match: "ANY", // rule-level: how groups combine
  groups: [
    { match: "ALL", conditions: [A, B] },
    { match: "ALL", conditions: [C, D] },
  ]
}
```

Relational storage:

- `TransactionRule.match` — `ALL | ANY`, default `ALL`
- `TransactionRuleConditionGroup` — `id`, `ruleId`, `sortOrder`, `match`
- `TransactionRuleCondition.groupId` — required after migration

API reads return flat `conditions[]` (ordered walk) plus additive `match` / `conditionGroups`. Writes with only flat `conditions[]` still mean one ALL group.

## Acceptance Criteria

- [ ] Existing rules migrate to one ALL group; evaluation unchanged
- [ ] `matchRuleConditions` in `@moat/domain`; API/desktop/MCP import it (or thin wrappers)
- [ ] Preview, historical backfill SQL, and iOS matcher honor groups
- [ ] Web/desktop builder: interactive ALL/ANY, `+ Group`, muted cards when 2+ groups
- [ ] iOS editor + list summaries match the same semantics/copy
- [ ] Flat `conditions[]` create/update still works for older clients

## Non-Goals

- Arbitrary nesting / parentheses editor
- Per-row AND/OR dropdowns between conditions
- Changing how multiple rules merge actions
- Unifying iOS onto the React builder

## Open Questions

- None for v1 — one grouping level is intentional.

## Related Specs

- [inline-rule-sentence-builder](../inline-rule-sentence-builder/spec.md) — presentation grammar; condition semantics were a non-goal there.

## Suggested Commit Message

```text
feat: adds all/any rule condition groups
```
