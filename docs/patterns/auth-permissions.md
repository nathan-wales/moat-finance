# Pattern: Auth & Permissions

## Overview

Authorization in Moat Finance is **server-side only**. UI visibility is for user experience — it is never the access control layer. Any write action must be gated in `apps/api` via a handler wrapper.

---

## Handler wrappers (always use these)

All API route handlers in `apps/api/src/server/handlers/` must use one of three wrappers from `handler-wrappers.ts`:

| Wrapper | When to use |
|---------|-------------|
| `withAuth` | Mutations and writes that require real user identity. `isDemoMode` is always `false`. |
| `withDemoOrAuth` | Reads, projections, and forecasts that should work in demo mode OR for real users. |
| `withPublic` | Unauthenticated endpoints (webhooks, health checks, public metadata). |

### Why wrappers, not manual checks

Before wrappers existed, handlers manually called `requireDemoOrAuthenticated()` and then checked `if (!ctx.userId)`. This was error-prone: the userId could still be null if the wrong branch was hit, and the check could be forgotten entirely.

The wrappers resolve a guaranteed `userId: string` in the handler context **before** the handler runs:

```ts
// ✅ Correct — userId is string (guaranteed by wrapper)
export const updateTransaction = withAuth(async (ctx, input) => {
  return transactionService.update(ctx.userId, input);
});

// ❌ Wrong — userId could be null, throws at runtime
export async function updateTransaction(ctx: ApiContext, input: Input) {
  requireAuthenticated(ctx);
  return transactionService.update(ctx.userId!, input); // type assertion = bug waiting to happen
}
```

---

## Context types

### `AuthenticatedContext` (from `withAuth`)

```ts
type AuthenticatedContext = {
  userId: string;           // always the effective user ID (household-aware)
  actorUserId: string;      // the actual logged-in user
  effectiveUserId: string;  // resolved household member (may differ from actor)
  isHouseholdMember: boolean;
  isDemoMode: false;        // always false in withAuth
  // ...rest of ApiContext
}
```

### `DemoOrAuthContext` (from `withDemoOrAuth`)

```ts
type DemoOrAuthContext = {
  userId: string;           // always resolved — demo user ID or real user ID
  actorUserId: string;
  effectiveUserId: string;
  isHouseholdMember: boolean;
  isDemoMode: boolean;      // true if this is a demo session
  // ...rest of ApiContext
}
```

---

## Demo mode

Demo mode lets unauthenticated visitors explore Moat Finance using a shared demo dataset. `withDemoOrAuth` handles both cases transparently:

- If the request has a valid session: `userId` = real user ID, `isDemoMode = false`
- If the request has a demo cookie/header: `userId` = the demo user ID, `isDemoMode = true`

**Use `withAuth` (not `withDemoOrAuth`) for mutations.** A demo user should never be able to write real data.

---

## Household / profile identity

`withAuth` and `withDemoOrAuth` call `resolveRequestIdentity()`, which sets:

- `actorUserId` — who is making the request (login identity)
- `effectiveUserId` — whose ledger data to return (active profile `profileUserId`)
- `isHouseholdMember` — whether the actor is a household member (not the owner)
- `activeProfileId` / `activeProfileKind` — selected profile link, when resolved
- `userId` — always set to `effectiveUserId` for convenience

Resolution order: owned/granted `activeProfileId` cookie → default granted profile for household members → self.

Household members only receive `ProfileLink`s they were granted. Owner-only actions (create profile, household management, include-in-net-worth) must assert `!ctx.isHouseholdMember` — never `actorUserId === effectiveUserId`, which breaks when an owner has a Family/Business profile active.

Most service calls should use `ctx.userId` (the effective ledger). Use `ctx.actorUserId` for audit/logging and owner-scoped management.

---

## UI-side auth (apps/web)

The web app uses **NextAuth.js** for session management. Auth pages are in `app/auth/`. Route protection is in `middleware.ts`.

**Critical rule**: NextAuth session checks in the web app are for UX only (deciding what to render). They do NOT replace server-side permission checks in `apps/api`. Every API call from the web must still go through a handler wrapper.

---

## Good vs bad examples

### ✅ Good: mutation gated server-side

```ts
// apps/api/src/server/handlers/goals.handler.ts
export const createGoal = withAuth(async (ctx, input) => {
  return goalService.create(ctx.userId, input);
});
```

```tsx
// apps/web/src/components/goals/new-goal-button.tsx
// ✅ OK to hide button for UX — but not the only gate
{user && <Button onClick={openDialog}>New Goal</Button>}
```

### ❌ Bad: permission check in React only

```tsx
// ❌ Never rely on this as access control
{user?.role === "admin" && <DeleteButton onClick={deleteUser} />}
// The API handler must also check — a UI check can be bypassed via API calls directly
```

### ✅ Good: read works in demo mode

```ts
export const getTransactions = withDemoOrAuth(async (ctx, input) => {
  return transactionService.listForUser(ctx.userId, input);
});
```

### ❌ Bad: mutation uses withDemoOrAuth

```ts
// ❌ Demo users should never write real data
export const deleteTransaction = withDemoOrAuth(async (ctx, input) => {
  return transactionService.delete(ctx.userId, input.id);
});
// Use withAuth here
```

---

## Testing

When writing tests for handlers:

- Mock `ApiContext` with a realistic shape (see `api-context.ts`)
- For `withAuth` handlers, ensure `userId`, `actorUserId`, and `effectiveUserId` are all set as strings
- For `withDemoOrAuth` handlers, test both `isDemoMode: true` and `isDemoMode: false` paths
- Never test permission enforcement in the component layer — test it at the handler/service level
