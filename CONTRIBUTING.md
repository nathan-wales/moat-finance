# Contributing to Moat Finance

Thanks for helping build Moat Finance. This guide covers how to propose changes and what reviewers look for.

## Before you start

- **Bugs:** open an issue with steps to reproduce, the expected vs. actual behavior, and whether you run self-hosted, desktop, or hosted.
- **Features:** open an issue or discussion first so we can agree on scope before you write code.
- **Security issues:** do **not** open a public issue. Follow [SECURITY.md](SECURITY.md).

## Development setup

```bash
pnpm install
cp .env.example .env    # see apps/*/.env.example for per-app values
./start-database.sh     # local Postgres in Docker
pnpm db:migrate:dev
pnpm dev
```

Never point local development at a production database or production provider keys. Use Plaid's sandbox environment for bank-sync work.

## Conventions

Read [AGENTS.md](AGENTS.md) and the relevant guide in [docs/patterns](docs/patterns). The essentials:

- **Authorization is server-side.** Gate every write in the API layer with `withAuth` or `withDemoOrAuth`. Hiding a button is not access control.
- **Handlers call services; services own business logic and Prisma.** Don't add Prisma to `apps/web`.
- **No PII in logs or analytics.** Never log emails, account numbers, routing numbers, raw transaction descriptions, or tokens.
- **Zustand for UI state, React Query for server state.** Don't introduce new state libraries.
- **kebab-case file names**, and `~/` imports in `apps/web`.
- **Prefer existing patterns.** Add a new abstraction only when a second concrete use case exists.

## Pull requests

- Keep each PR single-purpose. Don't mix refactors with behavior changes.
- Run `pnpm lint:fix` and the relevant typechecks and tests before pushing.
- Include migrations for schema changes (`pnpm db:migrate:dev`) and never edit an applied migration.
- Use commit and PR titles like `feat (web): adds goal progress chart`, `fix (api): handles empty plaid cursor`, or `chore: bumps prisma`.
- Describe what changed, why, and how you tested it. Add screenshots for UI changes.

## License of contributions

By submitting a contribution, you agree that it is licensed under the project's [PolyForm Shield License 1.0.0](LICENSE), and you grant Moat Finance LLC a perpetual, worldwide, royalty-free, irrevocable license to use, modify, sublicense, and relicense your contribution as part of Moat Finance under any terms. You confirm you have the right to make the contribution.

## Code of conduct

Participation is governed by our [Code of Conduct](CODE_OF_CONDUCT.md).
