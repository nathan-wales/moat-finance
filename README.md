# Moat Finance

**Free, self-hosted personal finance app.** Budgeting, investments, retirement planning, and a built-in MCP server so your AI assistant can reason over your real financial data, all running on infrastructure you control.

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

## Self-hosting

Pick whichever fits you. The [self-hosting guide](docs/self-hosting.md) walks through both.

- **Option A: Docker (easiest).** One machine (home server, NAS, spare Mac, or VPS), one config file, three commands:

  ```bash
  git clone https://github.com/tyler16smith/moat-finance.git
  cd moat-finance
  cp .env.self-host.example .env
  ./scripts/self-host/generate-secrets.sh
  docker compose up -d
  ```

  Then open http://localhost:3000.

- **Option B: Vercel + Neon (free).** Run the web app, API, and MCP server on Vercel's Hobby plan with a free Neon Postgres database (500 MB). It takes more setup (three Vercel projects and their environment variables) and needs your own domain. See [Option B](docs/self-hosting.md#option-b-vercel--neon).

Anything that runs Node.js and Postgres 16 works too. The **iOS app** works with either option: build it with your Apple Developer account and install it through TestFlight ([iOS setup](docs/self-hosting.md#ios-app)).

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

Moat Finance is licensed under the [PolyForm Shield License 1.0.0](LICENSE). You're free to use, modify, self-host, and share it, for personal use or inside your business. The one restriction: you can't use it to build or offer a product that competes with Moat Finance, such as reselling it as a hosted personal finance service. See the [license](LICENSE) for the exact terms.

Because of that restriction, Moat Finance is source-available rather than OSI-approved open source.

"Moat Finance" and the Moat logo are trademarks of Moat Finance LLC. Forks should use their own name and branding.
