# Security Policy

Moat Finance handles highly sensitive financial data, so we take vulnerability reports seriously.

## Reporting a vulnerability

**Do not open a public issue.** Report privately through either channel:

- GitHub: **Security → Report a vulnerability** on this repository (private vulnerability reporting)
- Email: **support@moatfinance.ai** with the subject line `SECURITY`

Please include:

- the affected component (web, api, mcp, desktop, extension, iOS) and version or commit
- steps to reproduce or a proof of concept
- the impact you believe it has

We aim to acknowledge reports within 3 business days and to give a remediation timeline after triage. Please give us reasonable time to ship a fix before you disclose publicly. We're happy to credit you in the release notes.

## Scope

In scope: the code in this repository, including authentication, authorization (`withAuth` / `withDemoOrAuth`), MCP token handling, encryption at rest, and bank-provider integrations.

Out of scope:

- vulnerabilities in a self-hoster's own infrastructure configuration (reverse proxy, TLS, host OS)
- denial-of-service through resource exhaustion
- reports generated only by automated scanners, without a demonstrated impact

## Supported versions

Security fixes land on `main` and in the latest release. Self-hosters should stay current; see [docs/self-hosting.md](docs/self-hosting.md) for upgrade steps.

## Hardening checklist for self-hosters

- Generate unique values for `AUTH_SECRET`, `ENCRYPTION_KEY`, `CRON_SECRET`, and `MCP_TOKEN_PEPPER` (use `scripts/self-host/generate-secrets.sh`), and back up `ENCRYPTION_KEY` safely: encrypted fields can't be recovered without it.
- Serve the app over HTTPS only.
- Don't expose Postgres to the internet.
- Set `ADMIN_EMAILS` only to addresses you control.
- After creating your own account, set `SIGNUPS_ENABLED=false` (optionally with `SIGNUP_ALLOWED_EMAILS`) so strangers can't create accounts or link banks on your Plaid keys. See [Lock down sign-ups](docs/self-hosting.md#lock-down-sign-ups).
- Give AI assistants the narrowest MCP token scopes they need, and review the MCP audit log.
