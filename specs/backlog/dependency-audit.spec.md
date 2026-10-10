# Dependency Audit

## Status

Active triage. Last reviewed June 17, 2026 against CI output from `.github/workflows/security.yml`.

## CI enforcement

The **Dependency Audit** job in [`.github/workflows/security.yml`](../../.github/workflows/security.yml) runs on every:

- **Push** to `main` or `staging`
- **Pull request** targeting `main` or `staging`

After `pnpm install --frozen-lockfile`, it runs:

```bash
pnpm audit --audit-level=high --prod
```

The job **fails** when any **high** or **critical** production dependency vulnerability is reported. Moderate and low findings are listed but do not fail CI.

Reproduce locally with the same command from the repo root.

## Last audit snapshot

As of the most recent CI run:

| Severity  | Count |
|-----------|-------|
| Critical  | 0     |
| High      | 29    |
| Moderate  | 46    |
| Low       | 8     |
| **Total** | **83** |

Many high findings are duplicate advisories for the same root package (e.g. ~12 axios entries, ~8 Next.js entries). Triage by **root cause**, not advisory count.

## Recommended fixes (prioritized)

### P0 — Fix now

#### Next.js `15.5.15` → `>=15.5.18`

| | |
|---|---|
| **Apps** | `apps/web`, `apps/api` (also via `next-auth`) |
| **Risk** | High — internet-facing app with auth middleware in `apps/web/src/middleware.ts`. Several advisories are middleware/proxy bypass, SSRF, and DoS (e.g. GHSA-267c, GHSA-492v, GHSA-26hh, GHSA-c4j6). |
| **Action** | Bump `next` in `apps/web/package.json` and `apps/api/package.json` to at least **15.5.18**. Run typecheck and smoke-test auth redirects / 2FA gating. |

#### axios `1.15.0` (via `plaid@41.4.0`) → `>=1.16.0`

| | |
|---|---|
| **Apps** | `apps/api`, `apps/desktop` (server-side Plaid HTTP). Also listed under `apps/web` because `plaid` is in its `package.json`, but web source does not import `plaid` directly. |
| **Risk** | High — Plaid SDK uses axios in the API and desktop main process for outbound HTTP. Advisories include prototype pollution gadgets, proxy credential leaks, `NO_PROXY` bypass, and request hijacking. |
| **Action** | Add a root `pnpm.overrides` entry for `axios@>=1.16.0`, or upgrade `plaid` when upstream bumps axios. Consider removing unused `plaid` from `apps/web/package.json` to reduce audit noise. |

### P1 — Fix soon

#### form-data `4.0.5` → `>=4.0.6`

| | |
|---|---|
| **Apps** | `apps/api` — via `plaid → axios → form-data` and `openai → form-data` |
| **Risk** | Medium — CRLF injection in multipart field names (GHSA-hmw2-7cc7-3qxx). Relevant for server-side multipart (OpenAI agent provider, Plaid HTTP). |
| **Action** | Add `pnpm.overrides` for `form-data@>=4.0.6` alongside the axios override. |

### P2 — Opportunistic

#### @vercel/blob `0.27.3` → undici `5.29.0`

| | |
|---|---|
| **Apps** | `apps/api` — feedback screenshot upload (`pages/api/v1/feedback/upload-screenshot.ts`) |
| **Risk** | Low — undici advisories target **WebSocket** client behavior; `@vercel/blob` uses undici for ordinary HTTP `put()`. Unlikely exploitable in current usage. |
| **Action** | Upgrade `@vercel/blob` when a release pulls in `undici >= 6.24.0`. No override needed unless CI must pass before upstream ships. |

### P3 — Track upstream (do not override yet)

#### protobufjs `7.5.5` (via `posthog-js` → OpenTelemetry)

| | |
|---|---|
| **Apps** | `apps/web` — client bundle only |
| **Risk** | Low — deep transitive dep for OTLP log export inside PostHog. CVEs target protobuf code generation / `toObject` / recursive `Any` parsing, not typical analytics traffic. |
| **Action** | Upgrade `posthog-js` when upstream updates the OpenTelemetry chain. Avoid manual `protobufjs` overrides. |

#### hono `4.12.12` + fast-uri `3.1.0` (via `@modelcontextprotocol/sdk`)

| | |
|---|---|
| **Apps** | `apps/mcp`, `apps/desktop` |
| **Risk** | Low — MCP HTTP transport uses **Express** (`apps/mcp/src/transports/http.ts`); desktop gateway uses raw `node:http`. hono CORS and fast-uri (inside `ajv`) are transitive SDK deps, not directly on our HTTP stack. |
| **Action** | Upgrade `@modelcontextprotocol/sdk` when it pulls patched hono / ajv / fast-uri. |

## Out of scope for this spec

- **Moderate and low** findings — reported by audit but do not fail CI.
- **Manual overrides** for deep transitive chains (protobufjs, hono) unless a CI blocker forces it and upstream has no fix.

## Definition of done

CI **Dependency Audit** job passes (`pnpm audit --audit-level=high --prod` exits 0) after:

1. Next.js bumped to `>=15.5.18` in web and api
2. axios overridden to `>=1.16.0` (or Plaid upgraded)
3. form-data overridden to `>=4.0.6` (if still flagged after axios fix)

Remaining P2/P3 items may still appear in audit output until upstream packages update; document any accepted residual risk here when deferring.

## Verification

```bash
pnpm install
pnpm audit --audit-level=high --prod
pnpm --filter moat-web run typecheck
pnpm --filter moat-api run typecheck
```
