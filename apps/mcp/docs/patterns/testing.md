# Pattern: Testing (apps/mcp)

The MCP app uses **`node:test` via `tsx`**. There is no Jest or Vitest. Tests live next to the code they cover (`*.test.ts` and `__tests__/*.test.ts`).

## Testing matrix by change type

| Change type | Test approach | Location |
|-------------|---------------|----------|
| Tool handler (unit) | `node:test` with a fake Prisma client + ToolContext | `src/tools/__tests__/` |
| Scope enforcement | Unit test on scope-checker.ts | `src/auth/__tests__/` |
| PAT verification | Unit test with mocked DB | `src/auth/__tests__/` |
| Full tool invocation (integration) | Local stdio loop | Manual / script |

---

## Tool unit tests

Build a typed fake Prisma client and pass it into the tool handler. Do not use `jest.mock`.

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { listGoals } from "../goals";

const mockDb = {
  goal: {
    findMany: async () => [
      { id: "1", name: "Emergency Fund", targetAmount: 10000, userId: "user-1" },
    ],
  },
};

const mockCtx = {
  userId: "user-1",
  db: mockDb as never,
  scopes: ["goals:read"],
};

describe("listGoals", () => {
  it("returns formatted goals", async () => {
    const result = await listGoals(mockCtx, { limit: 10 });
    assert.equal(result.goals.length, 1);
    assert.equal("userId" in result.goals[0], false);
  });
});
```

---

## Scope enforcement tests

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { assertScopes, McpAuthorizationError } from "../scope-checker";

describe("scope-checker", () => {
  it("throws when required scope is missing", () => {
    assert.throws(
      () => assertScopes(["accounts:read"], ["transactions:read"]),
      McpAuthorizationError,
    );
  });

  it("passes when required scope is present", () => {
    assert.doesNotThrow(() =>
      assertScopes(["transactions:read"], ["transactions:read"]),
    );
  });
});
```

---

## Local stdio loop — simulating LLM calls

The most realistic test is running the stdio transport locally and issuing MCP tool calls directly:

```bash
# 1. Start stdio server
MOAT_MCP_TOKEN=moat_dev_<pat> MOAT_MCP_CLIENT_PROFILE=test \
  pnpm --filter @moat/mcp run dev:stdio

# 2. Send a raw MCP tool call via stdin (pipe JSON)
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"moat.listAccounts","arguments":{}}}' \
  | pnpm --filter @moat/mcp run dev:stdio
```

Or configure Claude Desktop / Cursor to point at the local stdio process and invoke tools through the chat interface.

---

## Asserting scope enforcement

To verify a tool is properly gated:

1. Issue a PAT with **only** `accounts:read` scope.
2. Attempt to call `moat.listTransactions` (requires `transactions:read`).
3. Expect the response to contain a scope error, not transaction data.

---

## What to test vs. what to skip

**Test:**
- Tool handler output formatting (no raw Prisma fields, no PII leaking through)
- Scope enforcement for all tools
- PAT hash verification logic
- OAuth token expiry and rotation edge cases

**Skip:**
- The transport layer itself (MCP SDK responsibility)
- Prisma query correctness (test in `apps/api`)

---

## Running tests

```bash
pnpm --filter @moat/mcp run test
```

---

## When you are doing X → read Y

| Change type | Read |
|-------------|------|
| Testing a new tool | This file (tool unit tests section) |
| Verifying scope enforcement | This file (scope enforcement section) |
| Running tools end-to-end | This file (stdio loop section) |
| Understanding the tool registry | [tool-lifecycle.md](tool-lifecycle.md) |
