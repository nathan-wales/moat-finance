# Spec: Goals Feature

## Goal

Let users create and track financial goals (house, vacation, car, emergency fund, taxes, etc.) with cash-flow impact and forecast integration — simple and motivating on the surface, powered by Moat Finance's forecasting intelligence underneath.

## Context / Why now

Users currently see their cash flow and spending, but have no way to connect that to intentional financial targets. Goals makes Moat Finance actionable: it answers "how does saving for X change my monthly situation?" This is a high-leverage feature for user engagement and retention.

## Scope

**In scope (v1 — cash-style goals):**
- Buy a house, save for vacation, buy a car, build emergency fund, save for taxes, wedding, rental property repairs, custom goal
- Goal creation, editing, deletion
- Cash-flow impact calculation (how much does this goal cost per month?)
- On-track / behind / completed status
- Goals overview page with monthly commitment summary

**Out of scope for v1 (design for extensibility):**
- Debt payoff goals
- Investment-growth goals
- Goal sharing across household members
- Automated contributions tracking

## Behavior spec

### Routes

```
/goals              ← Goals list + overview
/goals/new          ← Goal creation flow
/goals/[goalId]     ← Individual goal detail
```

### Goal data model

| Field | Type | Notes |
|-------|------|-------|
| `name` | string | User-defined |
| `description` | string? | Optional |
| `goalType` | enum | house, vacation, car, emergency_fund, taxes, wedding, rental_repairs, custom |
| `targetAmount` | decimal | Final target |
| `targetDate` | date | When they want to reach the goal |
| `startingAmount` | decimal | What they have now toward this goal |
| `allocatedFromAccounts` | json? | Optional: specific cash accounts earmarked |
| `monthlyContribution` | decimal | What user plans to contribute per month |
| `requiredMonthlyContribution` | decimal | Calculated: (target - starting) / months remaining |
| `projectedCompletionDate` | date | Calculated: based on planned contribution |
| `cashFlowImpact` | decimal | Negative: monthly cost to cash flow |
| `status` | enum | on_track, behind, completed |

### Goals list page

- Page title: `Goals`
- `New Goal` button (top right)
- Active goals as cards
- Completed goals section (if any)
- Empty state: "No goals yet. Create a goal to see how saving for something affects your monthly cash flow and long-term forecast."
- Summary at top: monthly goal commitments, average net cash flow, remaining after goals

### Goal card

Shows: name, type, current/target amounts, target date, required monthly contribution, planned contribution, status (on-track / behind + delta), cash flow impact.

### Goal detail page

Full breakdown with timeline chart, contribution history (if tracked), and edit/delete options.

## Acceptance criteria

- [ ] User can create a goal with all required fields
- [ ] Required monthly contribution is calculated correctly: `(targetAmount - startingAmount) / monthsUntil(targetDate)`
- [ ] `cashFlowImpact` = `-monthlyContribution` (negative, represents monthly cost)
- [ ] Status: `on_track` if `monthlyContribution >= requiredMonthlyContribution`, else `behind`
- [ ] Goals list shows summary: total monthly commitments, net cash flow, remaining
- [ ] `/goals`, `/goals/new`, `/goals/[goalId]` routes all render correctly
- [ ] Empty state shown when user has no goals
- [ ] Goal can be edited and deleted
- [ ] `pnpm --filter moat-web run typecheck` passes
- [ ] `pnpm --filter moat-api run typecheck` passes

## Tech notes

- Use the existing cash-flow calculation service in `apps/api/src/lib/forecasting.ts` for monthly net cash flow — don't duplicate
- `requiredMonthlyContribution` and `projectedCompletionDate` are calculated fields — compute in the service layer on read, or store + recalculate on save
- DB: add `goals` table in Prisma schema (new migration)
- UI pattern: Zustand for goal creation form state, React Query for the goals list
- Goal type enum should be defined in Prisma schema, not hardcoded in UI

## Open questions

- Should completed goals auto-detect (when `startingAmount >= targetAmount`) or require manual completion?
- Should goals affect the main forecast shown on the dashboard? (Likely yes in v2)
- Do we want a monthly contribution tracking (actual vs planned) in v1, or just the target?
