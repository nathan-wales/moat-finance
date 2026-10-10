# Spec: PostgreSQL Row-Level Security

## Problem

Tenant isolation for sensitive financial data was enforced only in TypeScript. A missed `userId` predicate can expose another user’s data. Neon/Postgres RLS was not enabled.

## Goals

- Audit ownership and auth boundaries for every Prisma model.
- Fix application-layer cross-tenant gaps first.
- Add request-scoped DB actor context (`app.user_id`, `app.actor_type`) via transaction-local `set_config`.
- Enable **FORCE RLS on every public table** during a planned downtime window (zero end-user traffic).
- Introduce a restricted runtime role (`moat_app`) and document the Neon cutover.

## Non-goals

- Replacing TypeScript authorization with RLS.
- Broad `BYPASSRLS` for ordinary API traffic.
- An unauthenticated “public” actor — unauthenticated routes resolve capability tokens across tenants and run as the service actor.

## Coverage

Every public Prisma model has RLS enabled and forced. Policies fall into ownership classes (user-owned, through-parent, service-only, catalog read, published-row read). See [docs/security/row-level-security-audit.md](../../../docs/security/row-level-security-audit.md).

## Actor model

| Actor | `app.actor_type` | `app.user_id` | Set by |
|-------|------------------|---------------|--------|
| Signed-in user / household member | `user` | effective owner id | `withAuth` / `withDemoOrAuth` |
| Demo | `demo` | demo user id | `withDemoOrAuth` |
| Trusted job / webhook / unauthenticated capability route | `service` | job user id when known | `withServiceDatabaseActor`, `withPublic`, MCP auth/OAuth |
| Admin operational views | `admin` | unset | `requireAdminUser` after the admin check |

## Rollout gates

1. App-layer ownership fixes merged.
2. Both RLS migrations applied on staging.
3. `moat_app` created; `verify-rls-isolation.sql` and `rls-smoke.ts` pass as `moat_app`.
4. `MOAT_DATABASE_ACTOR_CONTEXT` left at its default (`true`).
5. Runtime `DATABASE_URL` switched to `moat_app`; `DIRECT_URL` stays on the owner.
6. Follow [docs/security/row-level-security-cutover-runbook.md](../../../docs/security/row-level-security-cutover-runbook.md).
