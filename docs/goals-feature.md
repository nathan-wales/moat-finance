# Implement a new **Goals** feature for Moat Finance

The goal of this feature is to let users create financial goals like buying a house, saving for a vacation, buying a car, building an emergency fund, paying off debt, or saving for taxes. This should feel simple and motivating on the surface, but powered by Moat Finance’s forecasting and cash-flow intelligence underneath.

## Product direction

Use the user-facing name **Goals**, not Planning.

Primary navigation item:

- `Goals`

Primary CTA:

- `New Goal`

A goal represents a future financial target with:

- a name
- optional description
- goal type
- target amount
- target date
- starting amount
- optional money allocated from existing cash accounts
- monthly contribution
- calculated required monthly contribution
- projected completion date
- cash-flow impact
- on-track / behind / completed status

The first version should focus on **cash-style goals**, such as:

- Buy a house
- Save for vacation
- Buy a car
- Build emergency fund
- Save for taxes
- Wedding
- Rental property repairs
- Custom goal

Do not build debt payoff or investment-growth goals yet, but design the data model in a way that leaves room for them later.

---

## Routes

Add these routes in the web app:

```txt
/goals
/goals/new
/goals/[goalId]
````

The `/goals` page should show:

* page title: `Goals`
* `New Goal` button in the top right
* active goals
* completed goals, if any
* empty state if no goals exist yet

Example empty state:

```txt
No goals yet

Create a goal to see how saving for something affects your monthly cash flow and long-term forecast.

[New Goal]
```

---

## Goals overview page

Each goal card should show:

* goal name
* goal type
* current / starting amount
* target amount
* target date
* required monthly contribution
* planned monthly contribution
* status
* cash-flow impact

Example card:

```txt
House Down Payment

$18,000 of $80,000
Target: June 2028

Required: $1,925/mo
Planned: $1,500/mo

Status: Behind by $425/mo
Cash flow impact: -$1,500/mo

[View Goal]
```

Also show a summary section at the top:

```txt
Goals Overview

Monthly goal commitments: $2,450/mo
Average monthly net cash flow: $3,200/mo
Remaining after goals: $750/mo
```

Use the same monthly cash-flow calculation pattern already used elsewhere in the app if available. If not available, add a clean service function that can be reused later by the dashboard and what-if calculator.

---

## New goal flow

The new goal setup should be a multi-step flow with visible steps at the top.

Example step indicator:

```txt
1. Goal details
2. Starting money
3. Monthly plan
4. Cash-flow impact
5. Review
```

Use a clean stepper UI at the top of the form. The user should be able to move forward/backward without losing entered values.

---

# Step 1: Goal details

Fields:

* Goal type
* Goal name
* Description, optional
* Target amount
* Target date

Goal type options:

```ts
type GoalType =
  | "house"
  | "vacation"
  | "car"
  | "emergency_fund"
  | "taxes"
  | "wedding"
  | "rental_property"
  | "custom";
```

Suggested UI:

```txt
What are you saving for?

[House]
[Vacation]
[Car]
[Emergency fund]
[Taxes]
[Wedding]
[Rental property]
[Custom]
```

Then:

```txt
Goal name
Target amount
Target date
Description
```

Validation:

* name is required
* target amount must be greater than 0
* target date must be in the future
* goal type is required

---

# Step 2: Starting money

Ask how they want to start:

```txt
How do you want to start?

[Start from scratch]
Use $0 as the starting amount for this goal.

[Use existing money]
Choose money from your cash accounts to include in this goal.
```

Important: using existing money should be treated as a **hypothetical allocation**, not a real transfer.

Show this helper copy:

```txt
This does not move money. It only tells Moat Finance how much of your current cash you want to treat as available for this goal.
```

If the user picks **Start from scratch**:

* starting amount defaults to `$0`
* continue to the next step

If the user picks **Use existing money**:

Show cash-like accounts only.

Include accounts such as:

* checking
* savings
* cash management
* money market
* other cash-equivalent accounts

Exclude:

* credit cards
* loans
* investment accounts for V1
* mortgages
* property assets

Each account row should show:

```txt
Chase Checking
Balance: $7,240

[Use full balance]
[Custom amount]
```

The user should be able to allocate a custom amount from each account.

Example:

```txt
Ally HYSA
Balance: $18,500
Amount to include: [$10,000]
```

At the bottom, show:

```txt
Starting amount for this goal: $12,500
```

Do not allow allocated amount to exceed account balance.

---

# Step 3: Monthly plan

This step sets the monthly contribution.

Show:

```txt
How much do you want to put toward this goal each month?

Monthly contribution
[$1,500]
```

Also calculate and show the required monthly amount based on:

```txt
remainingAmount = targetAmount - startingAmount
monthsUntilTarget = number of months between today and target date
requiredMonthlyContribution = remainingAmount / monthsUntilTarget
```

Show helpful text:

```txt
To hit this goal by June 2028, you need to save $1,925/mo.
```

If the user enters less than required:

```txt
At $1,500/mo, you are projected to be $11,900 short by your target date.
```

If the user enters enough:

```txt
At $2,000/mo, you are on track to hit this goal by your target date.
```

Also show projected completion date:

```txt
Projected completion: August 2028
```

If monthly contribution is `0`, show:

```txt
With no monthly contribution, this goal will not be completed unless you add more starting money or change the target amount.
```

---

# Step 4: Cash-flow impact / what-if preview

This is a key part of the flow.

After the user sets up the goal, show the goal inside a **what-if calculator style view** before final creation.

Reuse the existing what-if calculator components if possible, but render them inside the new goal flow rather than navigating the user to the what-if calculator page.

This step should answer:

```txt
How does this goal affect my monthly cash flow?
```

Show:

```txt
Before goal

Average monthly income: $8,400
Average monthly expenses: $5,200
Average monthly net cash flow: +$3,200

After goal

Goal contribution: -$1,500/mo
Projected remaining cash flow: +$1,700/mo
```

Also show simple status:

```txt
Looks manageable
You would still have about $1,700/mo left after this goal.
```

Or:

```txt
This may be tight
This goal would leave you with only $150/mo of projected cash flow.
```

Or:

```txt
This goal is currently over budget
Your monthly contribution is higher than your average monthly net cash flow.
```

Include editable what-if controls:

* monthly contribution
* target date
* starting amount

When these values change, update:

* required monthly contribution
* projected completion date
* projected shortfall
* monthly cash-flow impact
* remaining monthly cash flow

This should feel like a preview/simulator.

Suggested layout:

```txt
Cash-flow impact

Current monthly net cash flow
+$3,200/mo

Goal contribution
-$1,500/mo

Projected remaining cash flow
+$1,700/mo

[Monthly contribution input / slider]
[Target date input]
[Starting amount input]

Result:
- Required monthly: $1,925/mo
- Planned monthly: $1,500/mo
- Projected completion: August 2028
- Target date status: Behind by 2 months
```

Do not save the goal yet on this step.

---

# Step 5: Review

Final confirmation step.

Show:

```txt
Looks good. Make the goal?

House Down Payment

Target amount: $80,000
Starting amount: $18,000
Target date: June 2028
Monthly contribution: $1,500/mo

Required monthly contribution: $1,925/mo
Projected completion: August 2028
Cash-flow impact: -$1,500/mo
Remaining monthly cash flow: +$1,700/mo

[Back]
[Make Goal]
```

When the user clicks `Make Goal`, create the goal and navigate to `/goals/[goalId]`.

Success toast:

```txt
Goal created
You can now track this goal from your Goals page.
```

---

## Goal detail page

The detail page should show:

```txt
House Down Payment

$18,000 of $80,000
Target: June 2028
Monthly contribution: $1,500/mo

Status: Behind by $425/mo
Projected completion: August 2028
```

Sections:

1. Goal summary
2. Progress
3. Monthly contribution
4. Cash-flow impact
5. Starting money allocations
6. What-if calculator
7. Goal settings

The what-if calculator on the detail page should reuse the same component from the setup flow.

Goal detail actions:

* edit goal
* mark as completed
* archive goal
* delete goal

Use archive for the normal removal path. Delete can exist but should require confirmation.

---

## Data model

Add models similar to this. Adjust names to fit the existing Prisma conventions.

```prisma
model Goal {
  id                          String   @id @default(cuid())
  userId                      String

  name                        String
  description                 String?
  type                        GoalType

  targetAmount                Decimal
  startingAmount              Decimal  @default(0)
  targetDate                  DateTime
  monthlyContribution         Decimal  @default(0)

  requiredMonthlyContribution Decimal?
  projectedCompletionDate     DateTime?
  projectedShortfall          Decimal?

  status                      GoalStatus @default(ACTIVE)

  createdAt                   DateTime @default(now())
  updatedAt                   DateTime @updatedAt

  allocations                 GoalAccountAllocation[]

  @@index([userId])
  @@index([userId, status])
}

model GoalAccountAllocation {
  id        String   @id @default(cuid())
  goalId    String
  accountId String
  amount    Decimal

  goal      Goal     @relation(fields: [goalId], references: [id], onDelete: Cascade)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([goalId])
  @@index([accountId])
}

enum GoalType {
  HOUSE
  VACATION
  CAR
  EMERGENCY_FUND
  TAXES
  WEDDING
  RENTAL_PROPERTY
  CUSTOM
}

enum GoalStatus {
  ACTIVE
  COMPLETED
  ARCHIVED
}
```

If this app already uses lowercase enum values or string unions instead of Prisma enums, follow the existing convention.

Use Decimal for money.

Do not store derived values unless the existing app commonly does that. Prefer calculating:

* required monthly contribution
* projected completion date
* projected shortfall
* status text
* cash-flow impact

in a shared service.

If storing snapshots is useful for performance, keep them clearly marked as cached/calculated fields.

---

## Shared calculation service

Create a shared goal calculation service that can be used by:

* new goal setup flow
* goal detail page
* goals overview page
* future AI assistant
* future scenario engine

Example:

```ts
export type GoalCalculationInput = {
  targetAmount: number;
  startingAmount: number;
  targetDate: Date;
  monthlyContribution: number;
  averageMonthlyNetCashFlow?: number;
};

export type GoalCalculationResult = {
  remainingAmount: number;
  monthsUntilTarget: number;
  requiredMonthlyContribution: number;
  projectedCompletionDate: Date | null;
  projectedShortfall: number;
  isOnTrack: boolean;
  monthlyCashFlowAfterGoal: number | null;
  cashFlowImpact: number;
};
```

Core calculations:

```ts
remainingAmount = max(targetAmount - startingAmount, 0)

monthsUntilTarget = max(number of months between now and targetDate, 1)

requiredMonthlyContribution = remainingAmount / monthsUntilTarget

projectedAmountAtTarget =
  startingAmount + monthlyContribution * monthsUntilTarget

projectedShortfall =
  max(targetAmount - projectedAmountAtTarget, 0)

isOnTrack =
  projectedShortfall === 0

projectedCompletionDate =
  monthlyContribution > 0
    ? today + ceil(remainingAmount / monthlyContribution) months
    : null

cashFlowImpact =
  monthlyContribution

monthlyCashFlowAfterGoal =
  averageMonthlyNetCashFlow == null
    ? null
    : averageMonthlyNetCashFlow - monthlyContribution
```

Be careful with dates and month rounding. Keep the behavior predictable and covered by tests.

---

## API / server behavior

Add API/server actions consistent with the existing architecture.

Needed operations:

* list goals
* get goal by id
* create goal
* update goal
* archive goal
* mark goal completed
* delete goal
* list cash accounts available for goal allocation

Ensure all queries are scoped to the authenticated user.

For account allocations:

* validate the account belongs to the user
* validate the account is cash-like
* validate amount is non-negative
* validate amount does not exceed current balance
* store allocations as hypothetical references only
* do not modify account balances
* do not trigger Plaid behavior
* do not create transactions

---

## UI components

Create reusable components where practical:

```txt
GoalCard
GoalStatusBadge
GoalProgressBar
GoalStepper
GoalTypePicker
GoalAccountAllocationPicker
GoalMonthlyPlanStep
GoalCashFlowImpactPreview
GoalReviewStep
GoalWhatIfCalculator
GoalSummaryMetrics
```

The most important reusable component is:

```txt
GoalWhatIfCalculator
```

This should be used in both:

* `/goals/new` step 4
* `/goals/[goalId]`

It should accept controlled values and emit changes upward.

---

## Design notes

Use the existing design system:

* shadcn/ui
* Tailwind
* existing card styles
* existing button styles
* existing form components
* existing currency formatting utilities
* existing date formatting utilities
* existing chart/progress components if available

Keep the flow friendly and simple.

Suggested tone:

```txt
Looks manageable
This goal would leave you with about $1,700/mo after your usual expenses.
```

Avoid overly robotic labels like:

```txt
Simulation Output
Derived Forecast Result
```

Prefer:

```txt
Cash-flow impact
What this changes
Can I afford this?
```

---

## Testing

Add tests for the goal calculation service.

Cover:

* target amount greater than starting amount
* starting amount already meets target
* monthly contribution is zero
* monthly contribution is below required amount
* monthly contribution is above required amount
* target date is soon
* target date is invalid/past
* average monthly cash flow is present
* average monthly cash flow is missing

Also add validation tests for:

* cannot allocate more than account balance
* cannot allocate from non-cash account
* cannot access another user’s account
* cannot create a goal with invalid target amount
* cannot create a goal with past target date

---

## Acceptance criteria

* User can visit `/goals`.
* User can click `New Goal`.
* User sees a multi-step setup flow with step labels at the top.
* User can select a goal type and enter goal details.
* User can start from scratch or allocate hypothetical money from existing cash accounts.
* User can set a monthly contribution.
* App calculates required monthly contribution.
* App calculates whether the goal is on track.
* App shows a cash-flow impact preview before creation.
* The cash-flow impact preview reuses the same what-if calculator style/component pattern instead of being a completely separate implementation.
* Final step says something close to: `Looks good. Make the goal?`
* Clicking `Make Goal` creates the goal.
* User is redirected to the goal detail page.
* Goal appears on the goals overview page.
* User can edit, complete, archive, or delete the goal.
* All goal data is scoped to the authenticated user.
* Money values use Decimal-safe handling.
* Core calculations are covered by tests.
