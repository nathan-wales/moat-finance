# Pattern: Auth and Sessions (apps/web)

## Overview

`apps/web` uses **NextAuth.js** for session management. Auth is handled through a combination of:
- `src/server/auth.ts` — NextAuth configuration (providers, callbacks, session shape)
- `src/middleware.ts` — Route protection and redirects
- `app/auth/` — Sign-in and sign-up pages
- `app/api/auth/[...nextauth]/route.ts` — NextAuth callback handler

---

## Session shape

The session object is extended to include `userId` and other app-specific fields. The canonical type is defined in `src/server/auth.ts`.

```ts
// Accessing the session in a Server Component
import { auth } from "~/server/auth";

export default async function Page() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/sign-in");
  // session.user.id is always a string if the user is authenticated
}
```

```ts
// Accessing the session in a Client Component
import { useSession } from "next-auth/react";

export function UserMenu() {
  const { data: session } = useSession();
  // session?.user is the session user object
}
```

---

## Middleware — route protection

`src/middleware.ts` runs on every request matching the config pattern. It redirects:
- Unauthenticated users hitting `(dashboard)` routes → `/auth/sign-in`
- Authenticated users hitting `/auth/` routes → `/`
- Public routes (`/mcp/`, `/extension/`, `/api/auth/`) pass through unconditionally

**Do not add business logic to middleware.** Its only job is routing based on auth state.

---

## Demo mode

Demo mode allows unauthenticated visitors to explore Moat Finance using a shared demo dataset. Key points:

- Demo mode is initiated by visiting `/` without a session and triggering the demo flow.
- The web app communicates demo status to `apps/api` via a cookie or header.
- `apps/api` uses `withDemoOrAuth` to detect demo mode and return demo data.
- In the web app, use `session?.user?.isDemo` (or the equivalent field) to show demo mode indicators — e.g. a banner that prompts the user to sign up.

**Never allow a demo user to trigger mutations** — demo mode handlers in the API use `withDemoOrAuth`, and mutations should use `withAuth` which rejects demo users.

---

## Auth pages

`app/auth/` contains the sign-in and sign-up pages. These are public routes (not in the `(dashboard)` group).

- **Do not add loading spinners or session checks in auth pages.** The middleware ensures authenticated users never reach these pages.
- **Errors from NextAuth** (bad credentials, OAuth failure) are surfaced via `searchParams.error` per the NextAuth convention.

---

## Onboarding

First-time **Google** sign-in (the request that creates the user) is sent to `/onboarding` via `/post-login`, which reads `isNewUser` from the session JWT. Email/password register already uses `/onboarding` as its callback.

The dashboard does **not** force-redirect users who skip or leave onboarding. They can reopen `/onboarding` manually. Users who have already completed onboarding are sent from that page to `/overview`.

The middleware should pass through `/onboarding/` and `/post-login` for authenticated users. Do not add an `isNewUser` loop in middleware — that flag is a one-shot login signal.

---

## When you are doing X → read Y

| Change type | Read |
|-------------|------|
| Adding a new protected route | [routing-and-pages.md](routing-and-pages.md) — check route group and middleware |
| Changing session data / callbacks | `src/server/auth.ts` directly, plus [../../../../docs/patterns/auth-permissions.md](../../../../docs/patterns/auth-permissions.md) |
| Adding a demo mode indicator to UI | This file (Demo mode section) |
| Handling auth in the API layer | [../../../../docs/patterns/auth-permissions.md](../../../../docs/patterns/auth-permissions.md) |
