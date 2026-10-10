# Pattern: API Patterns

## Overview

The API (`apps/api`) follows a layered architecture: route handlers are thin, services own business logic, and Prisma is only touched inside service functions. All handlers use wrapper functions from `handler-wrappers.ts` for auth.

---

## Layered architecture

```
pages/api/[route].ts      ← Next.js route file (just wires handler)
  → handlers/[domain].handler.ts   ← Validates input, calls service, returns response
    → services/[domain].service.ts  ← Business logic + Prisma queries
      → Prisma / external integrations
```

### Route files

Route files in `pages/api/` should be minimal — just wire the handler:

```ts
// pages/api/goals/index.ts
import { createGoal, listGoals } from "~/server/handlers/goals.handler";
import type { NextApiRequest, NextApiResponse } from "next";
import { buildApiContext } from "~/server/api-context";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const ctx = await buildApiContext(req, res);
  if (req.method === "GET") return listGoals(ctx, req.query);
  if (req.method === "POST") return createGoal(ctx, await parseBody(req));
  res.status(405).end();
}
```

### Handler files

Handlers validate input, call a service, and return the response. They should not contain business logic or Prisma queries:

```ts
// handlers/goals.handler.ts
import { withAuth, withDemoOrAuth } from "~/server/handler-wrappers";
import { goalService } from "~/server/services/goal.service";
import { createGoalSchema } from "~/server/services/goal.service";

export const listGoals = withDemoOrAuth(async (ctx, input) => {
  const goals = await goalService.listForUser(ctx.userId);
  return { goals };
});

export const createGoal = withAuth(async (ctx, input) => {
  const parsed = createGoalSchema.parse(input);
  return goalService.create(ctx.userId, parsed);
});
```

### Service files

Services own all business logic and Prisma access:

```ts
// services/goal.service.ts
import { db } from "~/server/db";
import { z } from "zod";

export const createGoalSchema = z.object({
  name: z.string().min(1),
  targetAmount: z.number().positive(),
  targetDate: z.string().datetime(),
});

export const goalService = {
  async listForUser(userId: string) {
    return db.goal.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
  },

  async create(userId: string, input: z.infer<typeof createGoalSchema>) {
    return db.goal.create({
      data: { ...input, userId },
    });
  },
};
```

---

## Input validation

Always validate handler input with Zod. Define schemas in the service file or a shared types file. Parse in the handler before passing to the service:

```ts
// ✅ Parse input before calling service
export const createGoal = withAuth(async (ctx, input) => {
  const parsed = createGoalSchema.parse(input); // throws ZodError if invalid
  return goalService.create(ctx.userId, parsed);
});

// ❌ Don't trust raw input
export const createGoal = withAuth(async (ctx, input: any) => {
  return goalService.create(ctx.userId, input);
});
```

---

## Error responses

Use consistent, typed error responses. The API should never return raw untyped error objects.

Standard response shape for errors:

```ts
// Validation error → 400
res.status(400).json({ error: "Validation failed", details: zodError.errors });

// Auth error → 401 (handled by wrappers)
res.status(401).json({ error: "Unauthorized" });

// Not found → 404
res.status(404).json({ error: "Goal not found" });

// Server error → 500
res.status(500).json({ error: "Internal server error" });
// Log the real error internally, never expose stack traces
```

---

## OpenAPI spec + codegen

The API contract lives in `packages/openapi/api-v1.yaml`. The TypeScript client in `packages/client-ts/` and the React Query hooks in `apps/web/src/lib/api/` are generated from this spec via Orval.

**When adding or changing a handler:**
1. Update `packages/openapi/api-v1.yaml` with the new/changed endpoint
2. Run Orval codegen: `pnpm --filter @moat/openapi run generate`
3. The generated client is used by `apps/web` for all API calls

Do not hand-write API client code in `apps/web` — always use the generated client.

---

## Anti-patterns

```ts
// ❌ Business logic in handler
export const createGoal = withAuth(async (ctx, input) => {
  const existing = await db.goal.count({ where: { userId: ctx.userId } });
  if (existing >= 10) throw new Error("Goal limit reached");
  const requiredMonthly = (input.targetAmount - input.startingAmount) / monthsUntil(input.targetDate);
  return db.goal.create({ data: { ...input, userId: ctx.userId, requiredMonthly } });
  // ^^^ all of this belongs in goalService.create()
});

// ❌ Prisma query directly in handler
export const getGoal = withDemoOrAuth(async (ctx, input) => {
  return db.goal.findFirst({ where: { id: input.id, userId: ctx.userId } });
  // ^^^ this belongs in goalService.getForUser()
});
```

---

## Testing

- **Unit test services** — mock Prisma (or use a test DB) and test business logic in isolation.
- **Integration test handlers** — test the full handler lifecycle with a real or seeded DB.
- **Don't unit test route files** — they're wiring only.
- Test both the happy path and validation/auth error paths.
