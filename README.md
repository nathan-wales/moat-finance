# Moat Finance

**Open source personal finance app.** Budgeting, investments, retirement planning, and a built-in MCP server so your AI assistant can reason over your real financial data, all running on infrastructure you control.

- **Self-host it** with Docker on a home server, NAS, VPS, or your own cloud account.
- **Or run it locally** with the desktop app: a SQLite database on your computer that works fully offline.
- **Connect your AI assistant** (Claude, ChatGPT, Cursor, and any other MCP client) to your own MCP endpoint with scoped, revocable tokens.

[Website](https://moatfinance.ai) · [Self-hosting guide](docs/self-hosting.md) · [Contributing](CONTRIBUTING.md) · [Security](SECURITY.md)

## Features

- **Accounts and transactions:** checking, savings, credit cards, loans, and manual accounts. Sync banks with your own Plaid keys, or import CSVs.
- **Rules engine:** auto-categorize, tag, and organize transactions.
- **Net worth and forecasts:** historical net worth plus conservative, expected, and aggressive projections.
- **Investments and retirement:** portfolio tracking and retirement plans built on your real numbers.
- **Insurance, real estate, goals, and household context:** the full financial picture, not just a budget.
- **MCP server:** give AI assistants structured, audited, read-scoped access to your finances.
- **REST API and TypeScript SDK:** an OpenAPI spec in `packages/openapi` and a client in `packages/client-ts`.

## Quickstart (self-hosted)

You need Docker with Compose.

```bash
git clone https://github.com/tyler16smith/moat-finance.git
cd moat-finance
cp .env.self-host.example .env
./scripts/self-host/generate-secrets.sh
docker compose up -d
```

Open http://localhost:3000. See the [self-hosting guide](docs/self-hosting.md) for HTTPS, Plaid, backups, upgrades, and connecting an AI assistant.

There is no billing, paywall, or subscription in this edition: every feature is available to every user. Optional integrations use your own accounts: for automatic bank sync you bring your own Plaid keys and pay Plaid directly (see [Bring your own Plaid keys](docs/self-hosting.md#bring-your-own-plaid-keys)).

## Repository layout

| Path | What it is |
|------|------------|
| `apps/web` | Web app (Next.js App Router, React 19, Tailwind v4, Zustand + React Query) |
| `apps/api` | API routes, services, and Prisma schema (Next.js, Prisma 6, Postgres) |
| `apps/mcp` | MCP server (Express + `@modelcontextprotocol/sdk`) |
| `apps/desktop` | Desktop app (Electron, local SQLite) |
| `apps/extension` | Browser extension (WXT + React) |
| `apps/ios` | iOS app (SwiftUI) |
| `apps/marketing` | Static marketing site |
| `packages/*` | Shared code: OpenAPI spec, TS client, MCP contracts, UI, logging, utilities |
| `infra/` | Optional infrastructure for parked or experimental features |

## Development

```bash
pnpm install
cp .env.example .env            # then fill in values; see apps/*/.env.example
./start-database.sh             # local Postgres in Docker
pnpm db:migrate:dev
pnpm dev
```

Common commands:

```bash
pnpm dev               # Start dev servers (add --ext true for the extension)
pnpm build             # Build all apps and packages
pnpm lint:fix          # Lint and format
pnpm typecheck         # TypeScript checks
pnpm db:studio         # Prisma Studio for apps/api
```

Engineering conventions live in [AGENTS.md](AGENTS.md) and [docs/patterns](docs/patterns). Read them before opening a PR.

## License

Moat Finance is licensed under the [GNU Affero General Public License v3.0](LICENSE). You can use, modify, and self-host it freely. If you run a modified version as a network service for other people, you must make your source code available to those users under the same license.

"Moat Finance" and the Moat logo are trademarks of Moat Finance LLC. Forks should use their own name and branding.
