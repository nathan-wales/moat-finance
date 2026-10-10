# Pattern: Error Handling

## Overview

Errors in Moat Finance must be observable, typed, and consistent. No silent failures. Every error boundary should produce a log entry and a typed user-facing response.

---

## Core principles

1. **Log at the failure boundary** — one high-quality log in the catch block, not multiple noisy logs as the error propagates.
2. **Surface typed errors** — return structured JSON error responses from the API, not raw stack traces.
3. **Use the shared logger** — never use `console.error` directly in application code. Use `logger.error` or `logger.warn` from `~/lib/logger` (server-side) or `clientLogger` (browser).
4. **Re-throw when appropriate** — if you can't handle an error meaningfully at a given layer, log it and re-throw.

---

## API error responses

Return consistent JSON error shapes:

```ts
// 400 — validation error
res.status(400).json({ error: "Validation failed", details: zodError.errors });

// 401 — handled by handler wrappers automatically
res.status(401).json({ error: "Unauthorized" });

// 404 — resource not found
res.status(404).json({ error: "Not found" });

// 500 — unexpected server error
// Log the real error, return a safe message
logger.error("goal_create_failed", { userId: ctx.userId, error: err.message });
res.status(500).json({ error: "Internal server error" });
```

Never expose stack traces, raw Prisma errors, or internal error messages in 500 responses.

---

## Service layer error handling

Services should throw typed errors that handlers can catch and map to HTTP status codes:

```ts
// ✅ Typed error thrown in service
export class GoalNotFoundError extends Error {
  constructor(goalId: string) {
    super(`Goal not found: ${goalId}`);
    this.name = "GoalNotFoundError";
  }
}

// Handler catches and maps
export const getGoal = withDemoOrAuth(async (ctx, input) => {
  try {
    return await goalService.getForUser(ctx.userId, input.id);
  } catch (err) {
    if (err instanceof GoalNotFoundError) {
      return res.status(404).json({ error: "Not found" });
    }
    logger.error("goal_get_failed", { userId: ctx.userId, error: err.message });
    return res.status(500).json({ error: "Internal server error" });
  }
});
```

---

## Client-side error handling (apps/web)

- Use React Query's `onError` callback for mutation failures — show a toast notification.
- Log browser errors with `clientLogger` from `~/lib/client-logger` (proxies to API → Axiom).
- Never embed `AXIOM_TOKEN` in browser code.
- Never swallow errors silently in `catch` blocks — at minimum, log them.

---

## What not to log

Never include in logs:
- Tokens, secrets, API keys
- Email addresses
- Account numbers, routing numbers
- Raw transaction descriptions
- Full request/response bodies that may contain any of the above

Log: operation name, userId, error message/code, feature context.
