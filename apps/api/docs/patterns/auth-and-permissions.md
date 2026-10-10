# Pattern: Auth and Permissions (apps/api)

## The three wrappers — always use one

All API route handlers in `src/server/handlers/` must use one of three wrappers from `handler-wrappers.ts`. Never call `requireDemoOrAuthenticated()` manually.

| Wrapper | When to use | `isDemoMode` |
|---------|-------------|--------------|
| `withAuth` | Mutations, writes, anything that requires real identity | Always `false` |
| `withDemoOrAuth` | Reads and projections that should work in demo mode | `true` or `false` |
| `withPublic` | Unauthenticated endpoints: webhooks, health checks, public metadata | N/A |

The wrappers resolve a guaranteed `userId: string` before the handler runs, eliminating null checks and type assertions.

```ts
// ✅ withAuth — userId is string, isDemoMode is false
export const deleteAccount = withAuth(async (ctx, input) => {
  // ctx.userId is guaranteed string
  return accountService.delete(ctx.userId, input.accountId);
});

// ✅ withDemoOrAuth — works for demo and real users
export const listAccounts = withDemoOrAuth(async (ctx, input) => {
  return accountService.listForUser(ctx.userId);
});

// ❌ Never do this
export async function listAccounts(ctx: ApiContext) {
  requireDemoOrAuthenticated(ctx);
  return accountService.listForUser(ctx.userId!); // nullable assertion = bug
}
```

---

## Context types

### `AuthenticatedContext` (from `withAuth`)

```ts
{
  userId: string;             // the effective user ID (household-aware)
  actorUserId: string;        // the actual logged-in user
  effectiveUserId: string;    // resolved member — may differ from actorUserId
  isHouseholdMember: boolean;
  isDemoMode: false;
  req: NextApiRequest;
  res: NextApiResponse;
}
```

### `DemoOrAuthContext` (from `withDemoOrAuth`)

```ts
{
  userId: string;             // demo user ID or real user ID — always resolved
  actorUserId: string;
  effectiveUserId: string;
  isHouseholdMember: boolean;
  isDemoMode: boolean;        // true if demo session
  req: NextApiRequest;
  res: NextApiResponse;
}
```

---

## Household identity

When a user is a household member (invited into another user's household), `effectiveUserId` resolves to the primary account holder's user ID. This means queries automatically scope to the household. Use `ctx.userId` (which already equals `ctx.effectiveUserId`) for all Prisma queries — do not use `ctx.actorUserId` for data access.

```ts
// ✅ Always use ctx.userId for data scoping
db.transaction.findMany({ where: { userId: ctx.userId } });

// ❌ Don't use actorUserId for data — it may be the member, not the account owner
db.transaction.findMany({ where: { userId: ctx.actorUserId } });
```

---

## Demo mode

- Demo mode is initiated by visiting the web app without a session.
- `withDemoOrAuth` detects a demo cookie/header and resolves `userId` to the shared demo user.
- `isDemoMode: true` signals that the response should be demo data.
- **Use `withAuth` (not `withDemoOrAuth`) for all mutations.** Demo users must not be able to write data.

---

## Adding a new endpoint checklist

1. Choose the right wrapper based on the operation type (read → `withDemoOrAuth`, write → `withAuth`).
2. Use `ctx.userId` for all data scoping.
3. Validate input with Zod before passing to the service.
4. Return a 405 in the route file for unhandled HTTP methods.

---

## When you are doing X → read Y

| Change type | Read |
|-------------|------|
| Building the handler + service structure | [handler-service-layer.md](handler-service-layer.md) |
| Deep-dive on context types and household logic | [../../../../docs/patterns/auth-permissions.md](../../../../docs/patterns/auth-permissions.md) |
| Adding a Prisma model with user ownership | [prisma-and-migrations.md](prisma-and-migrations.md) |
