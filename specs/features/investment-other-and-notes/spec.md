# Spec: Investment “Other” type + Notes

## Problem

Manual investments only support Stocks, Real Estate, Roth IRA, 401(k), and HSA. Users need a catch-all **Other** type (private equity, CDs, crypto, collectibles, etc.) with title, value, and expected annual return (default/placeholder 7%). Separately, every investment should support optional freeform **notes**.

## Current context

- Postgres `InvestmentType` enum and `Investment` model: `apps/api/prisma/schema.prisma`
- API Zod + handlers: `apps/api/src/server/handlers/investment.ts`
- OpenAPI / client: `packages/openapi/api-v1.yaml`, `packages/client-ts`
- Desktop IPC + SQLite: `packages/contracts`, `packages/data-access`, `packages/db-sqlite`
- Web forms: `apps/web/.../investments/*`, `apps/web/src/components/dashboard/*investment*`
- Desktop page: `apps/desktop/src/renderer/src/pages/investments.tsx`
- iOS Investments: `apps/ios/Moat/Features/Investments/`
- Financial profile already has string type `"Other"`; needs optional `notes` on `ProfileInvestment`

## Done looks like

1. `OTHER` is a valid investment type in DB, API, OpenAPI, desktop SQLite/IPC, web, and iOS.
2. Add/edit investment flows include **Other** in the type dropdown (same standard form as Stocks: name/title, value, monthly contribution, annual return % with 7% placeholder/default).
3. Optional `notes` field on `Investment` (and Plaid investment accounts for edit parity), exposed in create/update and all add/edit UIs at the bottom.
4. Financial profile `ProfileInvestment` supports optional `notes` (web shared features + iOS).
5. Portfolio allocation includes an Other section when balances exist.
6. `formatInvestmentType` maps `OTHER` → `"Other"` when merging into financial profile.

## Non-goals

- Changing real estate intake / `RealEstateInvestment`
- MCP investment CRUD tools
- Migrating existing freeform profile `"Other"` rows into the Prisma `Investment` table
