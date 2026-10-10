# Pattern: Routing and Pages (apps/web)

## App Router conventions

`apps/web` uses Next.js App Router with route groups. The directory structure under `src/app/` is the routing surface.

```
src/app/
├── (dashboard)/            ← Route group — shares the authenticated dashboard layout
│   ├── layout.tsx          ← Dashboard shell (sidebar, top nav, auth gate)
│   ├── page.tsx            ← / (dashboard home)
│   ├── transactions/
│   ├── spending/
│   ├── budget/
│   ├── accounts/
│   ├── goals/
│   ├── rules/
│   └── settings/
├── auth/                   ← Unauthenticated auth pages (sign-in, sign-up)
├── onboarding/             ← New user onboarding flow
├── household/              ← Household management (invite, accept)
├── mcp/                    ← MCP OAuth consent page (public)
├── extension/              ← Extension OAuth redirect / callback (public)
├── layout.tsx              ← Root layout (providers: NextAuth, React Query, PostHog)
└── not-found.tsx
```

---

## Route groups

Route groups (wrapped in parentheses, e.g. `(dashboard)`) exist to share a layout without adding the group name to the URL. The `(dashboard)` group applies the sidebar + auth shell to all pages inside it without requiring `/dashboard/` in the path.

---

## Server vs. client components

- **Default to Server Components.** If a file has no interactivity or browser APIs, it doesn't need `"use client"`.
- **Add `"use client"` only when the component uses hooks, browser APIs, or event handlers.**
- Pages that fetch initial data should do so as Server Components and pass data as props to Client Components that own interactivity.

```tsx
// app/(dashboard)/transactions/page.tsx — Server Component
// Fetches initial data server-side, passes to client table component
export default async function TransactionsPage() {
  // Server-side data fetch via direct API call or server action
  return <TransactionsView />;
}
```

---

## Layouts

- Each route group or nested route can have its own `layout.tsx`.
- **Root layout** (`app/layout.tsx`) wraps the entire app in providers: `SessionProvider`, `QueryClientProvider`, `PostHogProvider`.
- **Dashboard layout** (`app/(dashboard)/layout.tsx`) contains the sidebar, top nav, and route-level auth protection.
- Layouts are always Server Components unless they need a provider that requires `"use client"`.

---

## `app/api/` routes

`apps/web` does **not** own API routes for data. Data API routes live in `apps/api`. The `app/api/` directory in web is limited to:

- NextAuth.js callback handler (`app/api/auth/[...nextauth]/route.ts`)
- OAuth relay routes for the MCP consent flow

Never add business-logic API routes to `apps/web`. All data fetching goes through the OpenAPI client → `apps/api`.

---

## Middleware

`src/middleware.ts` handles:

1. Redirecting unauthenticated users away from `(dashboard)` routes to `/auth/sign-in`
2. Redirecting authenticated users away from `/auth/` pages to `/`
3. Passing through public routes (`/mcp/`, `/extension/`, `/api/auth/`)

```ts
// middleware.ts pattern — do not add business logic here
export { auth as middleware } from "~/server/auth";
export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico|public/).*)"],
};
```

---

## When you are doing X → read Y

| Change type | Read |
|-------------|------|
| Adding a new page or route | This file, plus [components.md](components.md) for component conventions |
| Changing auth redirects / middleware | [auth-and-sessions.md](auth-and-sessions.md) |
| Adding data fetching to a page | [state-and-data.md](state-and-data.md) |
| Writing tests for a page | [testing.md](testing.md) |
