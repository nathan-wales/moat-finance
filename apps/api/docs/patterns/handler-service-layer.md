# Pattern: Handler and Service Layer (apps/api)

## Layered architecture

```
pages/api/[route].ts              ← Next.js route file — wires handler to HTTP method
  → src/server/handlers/[domain].ts   ← Validates input, calls service, returns response
    → src/server/services/[domain].ts  ← Business logic + Prisma queries
      → Prisma → PostgreSQL (Neon)
```

Each layer has a strict contract with the layer below it. Never skip layers.

---

## Route files

Route files in `pages/api/` are minimal. They only:
1. Build the API context
2. Delegate to the appropriate handler based on HTTP method
3. Return a 405 for unsupported methods

```ts
// pages/api/transactions/index.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { buildApiContext } from "~/server/api-context";
import { listTransactions, createTransaction } from "~/server/handlers/transactions";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const ctx = await buildApiContext(req, res);
  if (req.method === "GET") return listTransactions(ctx, req.query);
  if (req.method === "POST") return createTransaction(ctx, req.body);
  res.status(405).end();
}
```

---

## Handler files

Handlers live in `src/server/handlers/`. They:
- **Always** use a wrapper from `handler-wrappers.ts` (`withAuth`, `withDemoOrAuth`, or `withPublic`)
- Validate input with Zod (import the schema from the service file)
- Call one service function
- Return the response directly

```ts
// src/server/handlers/transactions.ts
import { withAuth, withDemoOrAuth } from "~/server/handler-wrappers";
import { transactionService, updateTransactionSchema } from "~/server/services/transaction.service";

export const listTransactions = withDemoOrAuth(async (ctx, input) => {
  return transactionService.listForUser(ctx.userId, input);
});

export const updateTransaction = withAuth(async (ctx, input) => {
  const parsed = updateTransactionSchema.parse(input);
  return transactionService.update(ctx.userId, parsed);
});
```

**Handlers must not:**
- Contain Prisma queries
- Contain business logic
- Make decisions based on isDemoMode (the wrapper already handled that)

---

## Service files

Services live in `src/server/services/`. They own:
- All business logic
- All Prisma queries
- Zod input schemas (exported so handlers can import them)

```ts
// src/server/services/transaction.service.ts
import { db } from "~/server/db";
import { z } from "zod";

export const updateTransactionSchema = z.object({
  id: z.string(),
  categoryId: z.string().optional(),
  notes: z.string().optional(),
});

export const transactionService = {
  async listForUser(userId: string, filters: unknown) {
    return db.transaction.findMany({
      where: { userId },
      orderBy: { date: "desc" },
    });
  },

  async update(userId: string, input: z.infer<typeof updateTransactionSchema>) {
    // Verify ownership before mutating
    const existing = await db.transaction.findFirst({
      where: { id: input.id, userId },
    });
    if (!existing) throw new Error("Not found");

    return db.transaction.update({
      where: { id: input.id },
      data: { categoryId: input.categoryId, notes: input.notes },
    });
  },
};
```

---

## Response shapes

- **Success:** Return plain objects or arrays — the handler wrapper serializes them.
- **Errors:** Throw `Error` instances for unexpected failures. The wrapper catches and returns a 500. For validation errors, Zod parse failures bubble naturally.
- **Not found:** Throw a typed error or return `null` depending on whether the caller handles absence vs. treats it as an error.

---

## transaction-scope.ts

`src/lib/transaction-scope.ts` contains reusable Prisma `where` clause helpers for scoping queries to a user's household. Use these instead of writing raw `where: { userId }` everywhere:

```ts
import { userScope, householdScope } from "~/lib/transaction-scope";

// Scope to the user only
db.transaction.findMany({ where: userScope(userId) });

// Scope to the whole household
db.transaction.findMany({ where: householdScope(householdId) });
```

---

## When you are doing X → read Y

| Change type | Read |
|-------------|------|
| Adding a new endpoint | This file (full route → handler → service flow) |
| Auth for the new endpoint | [auth-and-permissions.md](auth-and-permissions.md) |
| Adding Prisma schema changes | [prisma-and-migrations.md](prisma-and-migrations.md) |
| Adding Plaid or external integration | [external-integrations.md](external-integrations.md) |
| Writing tests | [testing.md](testing.md) |
