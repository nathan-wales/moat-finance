# Pattern: Tool Lifecycle (apps/mcp)

## End-to-end: adding a new tool

Adding a tool requires: handler file, registry, contracts package (input + output schemas, description, scopes), and verifying the audit wrapper covers it.

### Step 1 — Write the tool handler

Create or add to the appropriate domain file in `src/tools/`:

```ts
// src/tools/goals.ts
import { z } from "zod";
import type { ToolContext } from "./types";
import { formatGoal } from "./format";

export const listGoalsSchema = z.object({
  limit: z.number().int().min(1).max(50).optional().default(10),
});

export async function listGoals(
  ctx: ToolContext,
  input: z.infer<typeof listGoalsSchema>
) {
  const goals = await ctx.db.goal.findMany({
    where: { userId: ctx.userId },
    take: input.limit,
    orderBy: { createdAt: "desc" },
  });

  return schemaEnvelope("goals.list", {
    goals: goals.map(formatGoal),
    count: goals.length,
  });
}
```

**Tool handler rules:**
- Accept a typed `ToolContext` (has `userId`, `db`, `scopes`)
- Use the Prisma `db` from context — never import the global db singleton
- Return only safe, formatted data via `format.ts` helpers (`schemaEnvelope`)
- No PII: return counts, amounts, dates, enums. Not account numbers, routing numbers, raw descriptions unless necessary for the use case
- Keep handlers thin — Prisma queries inline or in a service, no complex business logic in the tool file

### Step 1b — Contracts (required)

In `packages/mcp-contracts`:
1. Add Zod `inputSchema` (prefer plain `z.object`; if you need `.refine`/`.superRefine`, keep them — registration unwraps via `getAdvertisedInputSchema`)
2. Add Zod `outputSchema` matching the `schemaEnvelope` shape in `output-schemas.ts`
3. Add the tool contract with a description that **names real argument keys and defaults**
4. Add any new scopes

### Step 2 — Register in the registry

```ts
// src/tools/registry.ts
import { listGoals, listGoalsSchema } from "./goals";

export const toolRegistry = [
  // ... existing tools
  {
    name: "moat.listAccounts",
    description: "List the user's savings goals with target amounts and progress.",
    inputSchema: listGoalsSchema,
    requiredScope: "goals:read",
    handler: listGoals,
  },
];
```

**Registry rules:**
- Tool names use the `moat.` prefix + camelCase: `moat.listAccounts`, `moat.getSpendingBreakdown`. Names should match the actual operation (`hide` vs `delete`, `preview` vs `apply`, `set` vs `upsert`).
- `requiredScope` must be a string defined in `packages/mcp-contracts/`
- Every registered tool is automatically wrapped in the audit logger — do not manually call `log-tool-call.ts`

### Step 3 — Add the scope to mcp-contracts (if new)

```ts
// packages/mcp-contracts/src/scopes.ts
export const MCP_SCOPES = {
  // ... existing scopes
  GOALS_READ: "goals:read",
} as const;
```

Add the scope description to the OAuth consent screen copy as well.

### Step 4 — Verify audit coverage

The audit wrapper in `src/mcp-server.ts` wraps all registered tools automatically. As long as the tool is in the registry, it's covered. You do not need to add any manual audit calls.

---

## format.ts — response formatting

`src/tools/format.ts` contains helpers that normalize Prisma model objects to LLM-friendly response shapes. Always use these rather than returning raw Prisma objects:

```ts
// ✅ Format before returning
return { goals: goals.map(formatGoal) };

// ❌ Never return raw Prisma objects
return { goals };
```

Add a new `format[Model]` function to `format.ts` when adding a new domain tool.

---

## When you are doing X → read Y

| Change type | Read |
|-------------|------|
| Adding a new tool | This file (full step-by-step) |
| Auth scopes and token enforcement | [auth-and-scopes.md](auth-and-scopes.md) |
| Transport setup (HTTP vs stdio) | [transports.md](transports.md) |
| Testing the tool locally | [testing.md](testing.md) |
