# Self-hosting Moat Finance

Moat Finance is free to self-host. You run your own copy, your data lives in a database you control, and nothing goes through our servers.

> **Don't want to run anything?** The Moat desktop app (`apps/desktop`) keeps everything in a local encrypted SQLite database on your computer and needs no backend. Self-host when you want browser access from several devices, a shared household, the iOS app, or a remote MCP endpoint for AI assistants.

## Choose how to host it

These are two options we document, not the only ones. Anything that runs Node.js apps and a Postgres 16 database will work (Railway, Render, Fly.io, a home server, and so on). If you're less familiar with hosting, pick one of these two.

| | **Option A: Docker** | **Option B: Vercel + Neon** |
|---|---|---|
| Best for | The simplest setup | A free, always-on setup in the cloud |
| Where it runs | One computer you control: a home server, NAS, spare Mac, or a VPS | Vercel (apps) and Neon (Postgres database) |
| Setup | One `.env` file and one command. Secrets are generated for you. | Three Vercel projects (web, API, MCP), each with its own environment variables, plus a Neon database |
| Domain | Optional. `localhost` works on that machine. | **Required** (about $10/year). Web and API must share sub-domains of one domain for sign-in to work. |
| HTTPS | You add it (Caddy or Cloudflare Tunnel; see below) | Automatic |
| Cost | Free on hardware you already own, or about $5–10/month for a VPS | **$0** on Vercel's Hobby plan and Neon's free plan (500 MB of storage), plus the domain |
| Limits | Your machine's uptime | Vercel Hobby is for personal, non-commercial use and runs scheduled jobs at most once a day (Moat's already run daily). Neon's free plan includes 500 MB of storage, which is plenty for one household. |
| Needs on your computer | Docker Desktop (or Docker Engine) | A browser, plus Node.js and pnpm once to run database migrations |

**Our recommendation:** Docker is the easiest because there's only one place to configure everything. Choose Vercel + Neon if you don't have a machine that stays on and you want it free. If you use [Claude Code](https://claude.com/claude-code) or another coding agent, it can do either setup for you. Point it at this guide.

Plaid bank sync, the iOS app, and AI assistants work the same way on both options.

## Option A: Docker

Run the full stack (web app, API, MCP server, Postgres, and scheduled jobs) on one machine with Docker Compose.

### What you get

| Service    | Port (host) | What it is |
|------------|-------------|------------|
| `web`      | 3000        | Next.js web app: the UI you open in a browser |
| `api`      | 3001        | Next.js API: all business logic and database access |
| `mcp`      | 3010        | MCP server for AI assistants (`/mcp`) |
| `postgres` | not exposed | Postgres 16, data in the `moat_postgres-data` volume |
| `migrate`  | none        | One-shot `prisma migrate deploy`, runs before `api` and `mcp` start |
| `cron`     | none        | Runs the scheduled jobs listed in `apps/api/vercel.json` (`crons`) |

### Prerequisites

- Docker Engine 24+ with the Compose v2 plugin (`docker compose version`), or Docker Desktop
- About 8 GB free disk for images, and 4 GB RAM available to Docker for the first build
- `openssl` (used by the secret generator)
- Git

### Quickstart

```bash
git clone https://github.com/<you>/moat-finance.git
cd moat-finance
cp .env.self-host.example .env
./scripts/self-host/generate-secrets.sh   # fills POSTGRES_PASSWORD, AUTH_SECRET, ENCRYPTION_KEY, CRON_SECRET, MCP_TOKEN_PEPPER
docker compose up -d --build
```

The first build takes several minutes. When it finishes:

```bash
docker compose ps            # api, web, mcp should be "healthy"; migrate "Exited (0)"
open http://localhost:3000   # create your account at /auth/register
```

Sign-up uses email and password by default. Google sign-in is optional (see [Configuration](#configuration-reference)).

**Back up `.env`, and especially `ENCRYPTION_KEY`.** Bank-connection tokens and 2FA secrets are encrypted with it. If you lose it, that data can't be recovered.

#### Optional: demo mode

The public demo (`/overview?demoMode=true`, or "Try Demo" on the sign-in page) reads a seeded demo workspace. Seed it once (idempotent; also upserts the default categories):

```bash
docker compose run --rm migrate ./node_modules/.bin/tsx prisma/seed.ts
```

#### Lock down sign-ups

Anyone who can reach your web app can create an account and, with your Plaid keys, link their own banks. Once your own account exists, close sign-ups:

1. Create your account at `/auth/register` (and any household members' accounts).
2. In `.env`, set `SIGNUPS_ENABLED=false`. To let specific people sign up later, list them in `SIGNUP_ALLOWED_EMAILS=alice@example.com,bob@example.com`.
3. Apply it: `docker compose up -d api` (the API enforces the policy; no rebuild needed). On Vercel, set the same variables on the API project and redeploy it.

New accounts are then refused with "Sign-ups are closed on this instance" for email/password registration and for first-time Google or Apple sign-in, on web, desktop, and iOS. Existing users sign in normally, and demo mode (`/overview?demoMode=true`) keeps working because it never creates users.

## Option B: Vercel + Neon

Run the web app, API, and MCP server as three Vercel projects from your fork, with the database on Neon. This mirrors how the hosted moatfinance.ai instance runs.

You'll need:

- A GitHub account, and your own **fork** of this repository (Vercel deploys from it)
- A [Vercel](https://vercel.com) account (Hobby plan is fine for personal use)
- A [Neon](https://neon.tech) account (free plan is fine)
- **A domain you own**, for example `example.com`. You'll use `app.`, `api.`, and `mcp.` sub-domains. You can buy one in Vercel (Domains) or from any registrar.
- Node.js 22+ and pnpm on your computer, once, to run database migrations

The steps below use `example.com`. Replace it with your domain everywhere.

### B1. Create the database on Neon

1. Create a Neon project (Postgres 16 or newer, in a region near your Vercel region).
2. On the project dashboard, open **Connect** and copy two connection strings:
   - **Pooled** (the host contains `-pooler`): use it for `DATABASE_URL`.
   - **Direct** (turn connection pooling off): use it for `DIRECT_URL`. Migrations need a direct connection.

### B2. Generate your secrets

Run these once and keep the output somewhere safe, such as a password manager. The same values are shared across projects.

```bash
openssl rand -base64 32   # AUTH_SECRET
openssl rand -hex 32      # ENCRYPTION_KEY (must be exactly 64 hex characters)
openssl rand -base64 32   # CRON_SECRET
openssl rand -base64 48   # MCP_TOKEN_PEPPER (at least 32 characters)
```

**Back up `ENCRYPTION_KEY`.** Bank-connection tokens and 2FA secrets are encrypted with it. If you lose it, that data can't be recovered.

### B3. Run the database migrations

From your computer, in your fork:

```bash
git clone https://github.com/<you>/moat-finance.git
cd moat-finance
pnpm install
DATABASE_URL='<pooled url>' DIRECT_URL='<direct url>' pnpm db:migrate:deploy
```

Optional: seed the public demo workspace (`/overview?demoMode=true`):

```bash
cd apps/api
DATABASE_URL='<pooled url>' DIRECT_URL='<direct url>' pnpm exec tsx prisma/seed.ts
```

Repeat the migrate step whenever you pull a new version that adds migrations (`apps/api/prisma/migrations`). Run it **before** Vercel deploys the new API.

### B4. Allow Git deploys in your fork

The repository's `vercel.json` files turn off Git-triggered deploys because the hosted instance deploys through GitHub Actions. In your fork, delete this block from `apps/api/vercel.json`, `apps/web/vercel.json`, and `apps/mcp/vercel.json` and commit the change:

```json
"git": {
	"deploymentEnabled": false
}
```

### B5. Create three Vercel projects

In Vercel, choose **Add New → Project** and import your fork three times, once per app. For each one, set **Root Directory** as shown and leave the framework and build settings as Vercel detects them (each app's `vercel.json` provides the build command). Add the environment variables before the first deploy.

**API project** (Root Directory `apps/api`, domain `api.example.com`):

| Variable | Value |
|----------|-------|
| `DATABASE_URL` | Neon pooled connection string |
| `DIRECT_URL` | Neon direct connection string |
| `AUTH_SECRET` | from B2 |
| `ENCRYPTION_KEY` | from B2 |
| `CRON_SECRET` | from B2. Vercel sends it automatically when it runs the scheduled jobs in `apps/api/vercel.json`. |
| `MCP_TOKEN_PEPPER` | from B2 |
| `WEB_ORIGIN` | `https://app.example.com` |
| `APP_BASE_URL` | `https://app.example.com` |
| `SIGNUPS_ENABLED` | Leave unset until you've created your account, then `false` (see [Lock down sign-ups](#lock-down-sign-ups)) |
| Plaid (optional) | `PLAID_CLIENT_ID`, `PLAID_SECRET`, `PLAID_ENV`, `PLAID_COUNTRY_CODES`, and `PLAID_WEBHOOK=https://api.example.com/api/webhooks/plaid` (see [Bring your own Plaid keys](#bring-your-own-plaid-keys)) |

**Web project** (Root Directory `apps/web`, domain `app.example.com`):

| Variable | Value |
|----------|-------|
| `AUTH_SECRET` | same value as the API |
| `ENCRYPTION_KEY` | same value as the API |
| `AUTH_URL` | `https://app.example.com` |
| `NEXT_PUBLIC_API_URL` | `https://api.example.com` |
| `NEXT_PUBLIC_MCP_URL` | `https://mcp.example.com/mcp` |
| `AUTH_COOKIE_DOMAIN` | `.example.com` (note the leading dot). **Required:** this is what lets the API read your sign-in session. |

**MCP project** (Root Directory `apps/mcp`, domain `mcp.example.com`):

| Variable | Value |
|----------|-------|
| `DATABASE_URL` | Neon pooled connection string |
| `MCP_TOKEN_PEPPER` | same value as the API |
| `MCP_BASE_URL` | `https://mcp.example.com` |
| `WEB_APP_URL` | `https://app.example.com` |

Optional integrations (Google sign-in, Resend email, OpenAI, PostHog, Axiom, Upstash) use the same variable names as the [configuration reference](#optional-integrations). Put them on the API project, plus `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` on the web project if you enable Google sign-in. Setting `AUTH_GOOGLE_ID` on the API also makes `AUTH_GOOGLE_ID_IOS` required there; if you don't use the iOS app, set it to the same value as `AUTH_GOOGLE_ID`.

`NEXT_PUBLIC_*` variables are built into the web app, so redeploy the web project after you change them.

### B6. Add your domains and deploy

1. In each project, open **Settings → Domains** and add its sub-domain (`api.`, `app.`, `mcp.`). Follow Vercel's DNS instructions if the domain isn't managed by Vercel.
2. Deploy the **API first**, then web and MCP.
3. Open `https://app.example.com/auth/register` and create your account.
4. Lock down sign-ups: set `SIGNUPS_ENABLED=false` on the API project and redeploy it.

Why the domain matters: on default `*.vercel.app` addresses, browsers won't share the sign-in cookie between the web and API projects, so you can't stay signed in. Sub-domains of one domain you own fix that.

### B7. Keeping it updated

1. Sync your fork with this repository (GitHub's **Sync fork** button).
2. If the update adds migrations, run step B3's migrate command.
3. Vercel redeploys automatically from your fork's `main` branch.

Back up your data with Neon's built-in restore history, or run `pg_dump "<direct url>" > moat-backup.sql` from your computer.

## iOS app

The iOS app (`apps/ios`) works with either option, but Apple only lets you install your own build in a few ways.

**You'll need:**

- A Mac with Xcode
- An **Apple Developer Program** membership ($99/year) to distribute through **TestFlight**. Without it, you can still install the app on your own iPhone straight from Xcode with a free Apple ID, but Apple expires those installs after 7 days and you'll need to reinstall.
- Your instance reachable over **HTTPS** from your phone: `https://api.example.com` on Vercel, or a reverse proxy or Cloudflare Tunnel with Docker (see [Reverse proxy and HTTPS](#reverse-proxy-and-https))

**Point the app at your instance and your Apple account:**

1. Copy `apps/ios/Moat/Config/Secrets.xcconfig.example` to `Secrets.xcconfig` (it's gitignored) and set:

   ```
   API_BASE_URL = https:\/\/api.example.com
   WEB_BASE_URL = https:\/\/app.example.com
   PRODUCT_BUNDLE_IDENTIFIER = com.yourname.moat
   ```

2. In Xcode, open `apps/ios/Moat.xcodeproj`, select the **Moat** target → **Signing & Capabilities**, and choose your own **Team**. Use a bundle ID you own: Apple won't let you sign with `com.moatfinance.*`.
3. Sign-in with email and password works out of the box. Google sign-in on iOS needs your own iOS OAuth client (`GID_CLIENT_ID` in `Secrets.xcconfig`, and `AUTH_GOOGLE_ID_IOS` on the API). Sign in with Apple needs the capability on your paid developer account.

**Install it with TestFlight (personal use):**

1. In [App Store Connect](https://appstoreconnect.apple.com), create an app record with your bundle ID.
2. In Xcode, choose **Product → Archive**, then **Distribute App → App Store Connect → Upload**.
3. In App Store Connect → **TestFlight**, add yourself and your household as **internal testers**. Internal testing doesn't need App Review, and each build lasts 90 days.
4. Install the **TestFlight** app on your iPhone and accept the invite.

You don't need to publish to the App Store. TestFlight on your own account is enough for you and your household.

## Configuration reference

> This section describes the Docker `.env` file. On Vercel, the same variables go on each project as described in [Option B](#b5-create-three-vercel-projects); `PUBLIC_WEB_URL`, `PUBLIC_API_URL`, and `PUBLIC_MCP_URL` are Docker shortcuts that map to the per-project values listed there.

All configuration lives in the root `.env`. Compose passes it to every app container and also uses it for `${...}` interpolation in `docker-compose.yml`. `.env.self-host.example` is the annotated template.

### Required

| Variable | Notes |
|----------|-------|
| `POSTGRES_PASSWORD` | Password for the bundled Postgres. Generated. |
| `AUTH_SECRET` | Auth.js session signing secret, shared by web and API. Generated. |
| `ENCRYPTION_KEY` | Exactly 64 hex characters (32 bytes) for AES-256-GCM. Generated. |
| `CRON_SECRET` | Bearer token for `/api/cron/*`. Generated. |
| `MCP_TOKEN_PEPPER` | At least 32 characters, used to hash MCP access tokens. Generated. |
| `DATABASE_URL`, `DIRECT_URL` | Optional overrides. Leave them unset to use the bundled Postgres. Set both to use an external Postgres 16. `DIRECT_URL` must be a direct (unpooled) connection because migrations use it. |
| `PUBLIC_WEB_URL` | Browser URL of the web app. Default `http://localhost:3000`. Used for CORS, Auth.js, and links. |
| `PUBLIC_API_URL` | Browser URL of the API. Default `http://localhost:3001`. **Built into the web bundle.** |
| `PUBLIC_MCP_URL` | Public URL of the MCP server, without `/mcp`. Default `http://localhost:3010`. |
| `WEB_PORT`, `API_PORT`, `MCP_PORT` | Host ports Compose publishes. |

### Self-host switches

| Variable | Notes |
|----------|-------|
| `ADMIN_EMAILS` | Comma-separated emails that can use the admin routes (community-tip and prompt moderation). Leave empty for no admins. |
| `CORS_ALLOWED_ORIGINS` | Comma-separated extra browser origins the API accepts, in addition to `PUBLIC_WEB_URL`. |
| `AUTH_COOKIE_DOMAIN` | Leave unset for a host-only cookie. Set it to `.example.com` only when web and API run on sibling subdomains and must share the session cookie. |
| `SIGNUPS_ENABLED` | Sign-ups are open unless this is exactly `false`. Set it to `false` after you create your account. See [Lock down sign-ups](#lock-down-sign-ups). |
| `SIGNUP_ALLOWED_EMAILS` | Comma-separated emails that can still create an account while `SIGNUPS_ENABLED=false` (case-insensitive). |

### Optional integrations

Uncomment a block in `.env` to turn that integration on. Leave unused variables **commented out, not set to an empty value**.

| Integration | Variables | Without it |
|-------------|-----------|------------|
| Plaid (bank sync, [your own keys](#bring-your-own-plaid-keys)) | `PLAID_CLIENT_ID`, `PLAID_SECRET`, `PLAID_ENV`, `PLAID_COUNTRY_CODES`, `PLAID_WEBHOOK`, `PLAID_REDIRECT_URI` | Use CSV import and manual accounts |
| Google sign-in | `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `AUTH_GOOGLE_ID_IOS` | Email and password only |
| Resend (email) | `RESEND_API_KEY`, `EMAIL_FROM`, `FEEDBACK_RECIPIENT` | No invite, alert, or recovery emails |
| OpenAI | `OPENAI_API_KEY` | No built-in AI features. Your own assistant can still connect over MCP. |
| PostHog | `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST`, `POSTHOG_API_KEY`, `POSTHOG_HOST` | No analytics, and feature flags fall back to their defaults (see below) |
| Axiom | `AXIOM_TOKEN`, `AXIOM_DATASET` | Logs go only to `docker compose logs` |
| Upstash Redis | `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | MCP requests are not rate limited |
| Logo.dev | `NEXT_PUBLIC_LOGO_DEV_PUBLISHABLE_KEY` | Generic institution icons |

**`NEXT_PUBLIC_*` values and `PUBLIC_API_URL` / `PUBLIC_MCP_URL` are built into the web app's JavaScript.** After you change any of them, rebuild the web image with `docker compose build web && docker compose up -d web`. Every other variable only needs `docker compose up -d`, which recreates any container whose config changed.

### Features that are off without PostHog

Server-side feature flags are evaluated through PostHog. Without PostHog every flag uses its default, which is **off**. That affects:

- `desktop-remote-mcp`: the remote MCP tunnel for the desktop app
- `amazon-retail-sync`: Amazon order sync through the browser extension

You can point the PostHog variables at your own PostHog project (cloud or self-hosted) and create these flags there.

## Reverse proxy and HTTPS

Put a TLS-terminating proxy in front of the stack for anything beyond localhost. A common layout uses one hostname per service:

```
https://moat.example.com      -> web:3000
https://api.moat.example.com  -> api:3001
https://mcp.moat.example.com  -> mcp:3010
```

Set these values in `.env`, then rebuild web:

```env
PUBLIC_WEB_URL=https://moat.example.com
PUBLIC_API_URL=https://api.moat.example.com
PUBLIC_MCP_URL=https://mcp.moat.example.com
# Only needed if the API must read the session cookie on a sibling subdomain:
AUTH_COOKIE_DOMAIN=.moat.example.com
```

```bash
docker compose build web && docker compose up -d
```

### Caddy example

Caddy obtains and renews Let's Encrypt certificates automatically. This `Caddyfile` assumes Caddy runs on the same host and reaches the published ports:

```caddyfile
moat.example.com {
	reverse_proxy 127.0.0.1:3000
}

api.moat.example.com {
	reverse_proxy 127.0.0.1:3001
}

mcp.moat.example.com {
	reverse_proxy 127.0.0.1:3010 {
		# MCP uses streaming HTTP responses; don't buffer them.
		flush_interval -1
	}
}
```

Once the proxy is in place, publish the app ports on loopback only so they aren't reachable directly. You can do this with a `docker-compose.override.yml`:

```yaml
services:
  web: { ports: !override ["127.0.0.1:3000:3000"] }
  api: { ports: !override ["127.0.0.1:3001:3001"] }
  mcp: { ports: !override ["127.0.0.1:3010:3010"] }
```

### Cloudflare Tunnel

To expose the stack without opening inbound ports:

1. In the Cloudflare dashboard, open **Zero Trust → Networks → Tunnels** and create a tunnel. Copy its token.
2. Add public hostnames that point at the containers: `moat.example.com → http://web:3000`, `api.moat.example.com → http://api:3001`, and `mcp.moat.example.com → http://mcp:3010`.
3. Add a `cloudflared` service in `docker-compose.override.yml`:

   ```yaml
   services:
     cloudflared:
       image: cloudflare/cloudflared:2024.12.2
       command: tunnel --no-autoupdate run
       environment:
         TUNNEL_TOKEN: ${CLOUDFLARE_TUNNEL_TOKEN}
       restart: unless-stopped
   ```

4. Add `CLOUDFLARE_TUNNEL_TOKEN=...` to `.env`, set the `PUBLIC_*` URLs to the https hostnames, then rebuild web and run `docker compose up -d`.

## Connecting an AI assistant (MCP)

The MCP endpoint is `${PUBLIC_MCP_URL}/mcp`, for example `https://mcp.moat.example.com/mcp`. It accepts two kinds of credentials:

- **Personal access token (works everywhere).** In the web app, open **Settings → AI access** and create a token. Configure your client to send `Authorization: Bearer <token>` to the MCP URL. For Claude Code:

  ```bash
  claude mcp add --transport http moat https://mcp.moat.example.com/mcp \
    --header "Authorization: Bearer <token>"
  ```

  Cursor and other clients that read `mcp.json` take the same URL and header.

- **OAuth (Claude, ChatGPT, Cursor connectors).** Hosted assistants register dynamically and send you to `${PUBLIC_WEB_URL}/mcp` to approve access. They can only reach a public HTTPS URL, so set up a [reverse proxy](#reverse-proxy-and-https) or [Cloudflare Tunnel](#cloudflare-tunnel) first. Allowed redirect hosts default to the official clients. Override them with `MCP_OAUTH_*_REDIRECT_HOSTS` (see `apps/mcp/.env.example`).

## Bring your own Plaid keys

Moat has no billing and no shared Plaid account. Automatic bank sync uses **your own Plaid developer account**, and you pay Plaid directly for any usage under it. Without Plaid, use CSV import and manual accounts.

### 1. Create a Plaid account

1. Sign up at <https://dashboard.plaid.com/signup>.
2. Under **Developers → Keys**, copy your `client_id` and the secret for the environment you want.
   - **Sandbox** is free and uses fake banks (log in with `user_good` / `pass_good`). Start here.
   - **Production** connects real banks. Plaid must approve your account for production access first (company profile, use-case questionnaire, and for many US banks an OAuth registration). Approval can take days. Plaid bills you per connected Item and product.
   - Plaid has retired its old `development` environment. Use `sandbox` or `production`.
3. Moat requests the **Transactions** product (required) and **Investments** (optional, used when available). Make sure both are enabled for your account in the Plaid dashboard.

### 2. Configure `.env`

```env
PLAID_CLIENT_ID=your-client-id
PLAID_SECRET=your-secret-for-this-environment
PLAID_ENV=sandbox                      # or production
PLAID_COUNTRY_CODES=US                 # comma-separated, e.g. US,CA

# Webhook (recommended on HTTPS). See below.
PLAID_WEBHOOK=https://api.moat.example.com/api/webhooks/plaid

# Optional. Leave unset for the web app. See below.
# PLAID_REDIRECT_URI=
```

Then run `docker compose up -d api`. These are API-side settings, so no web rebuild is needed.

### 3. Register the webhook URL

Plaid notifies Moat about new transactions through a webhook. The value to use is:

```
<PUBLIC_API_URL>/api/webhooks/plaid
```

For example, `https://api.moat.example.com/api/webhooks/plaid`. (`/api/webhook/plaid` and `/api/plaid/webhook` are aliases for the same handler.)

- The webhook URL is sent to Plaid in each Link token, so you don't need to enter it in the Plaid dashboard. If you set `PLAID_WEBHOOK`, that value is used. If it's unset and `PUBLIC_API_URL` starts with `https://`, Moat derives the URL above from it. Otherwise no webhook is registered.
- Plaid stores the webhook on each connected bank (Item) when it is linked. **Set the webhook before linking banks.** Items linked earlier keep their old webhook (or none).
- Plaid must reach the URL over public HTTPS, so set up a [reverse proxy](#reverse-proxy-and-https) or [Cloudflare Tunnel](#cloudflare-tunnel) first. Requests are verified with Plaid's signed `Plaid-Verification` header using your keys. Nothing else needs to be configured.
- Without a webhook, bank sync still works: the daily `cron` jobs (balance sync, transaction fallback, sync-job processing) run at 07:00 UTC, and users can refresh manually.

### 4. OAuth redirect URI (optional)

Many large US banks connect through OAuth. In the web app, Plaid Link handles the OAuth step in a pop-up window, so **leave `PLAID_REDIRECT_URI` unset** for a browser-only setup. Moat's web app does not implement an OAuth return page.

If you do set `PLAID_REDIRECT_URI` (for example for a native mobile build of your own), it is passed to Plaid as `redirect_uri` on every Link token. It must exactly match an entry under **Developers → API → Allowed redirect URIs** in the Plaid dashboard, and must be HTTPS in production. Otherwise Link token creation fails.

### Optional: real-time balances

Plaid charges for on-demand balance calls (`/accounts/balance/get`). They are off by default and only available to user IDs in `ADMIN_USER_IDS` (comma-separated). Set `ENABLE_REALTIME_BALANCE_SYNC=true` to turn them on for every user. Without them, balances come from the transaction sync and the daily balance job.

### Optional: MX and Finicity

Plaid is the default and only required provider. The API also contains adapters for MX and Finicity (Mastercard Open Banking). They are off unless explicitly enabled, need their own commercial agreements, and are less complete than the Plaid integration. Most self-hosters should skip them.

| Provider | Enable with | Credentials and settings |
|----------|-------------|--------------------------|
| MX | `ENABLE_MX_CONNECTIONS=true` | `MX_CLIENT_ID`, `MX_API_KEY`, `MX_CONNECT_WIDGET_URL`, optional `MX_BASE_URL` (default `https://api.mx.com`). Webhooks: `MX_WEBHOOK_BASIC_AUTH_USERNAME`, `MX_WEBHOOK_BASIC_AUTH_PASSWORD` (required in production when `MX_CLIENT_ID` is set). Webhook URL: `<PUBLIC_API_URL>/api/webhooks/mx` |
| Finicity | `ENABLE_FINICITY_CONNECTIONS=true` | `FINICITY_PARTNER_ID`, `FINICITY_PARTNER_SECRET`, `FINICITY_APP_KEY`, `FINICITY_CONNECT_URL`, optional `FINICITY_BASE_URL` (default `https://api.finicity.com`). Webhooks: `FINICITY_WEBHOOK_SECRET` (required in production when `FINICITY_APP_KEY` is set). Webhook URL: `<PUBLIC_API_URL>/api/webhooks/finicity` |

### Desktop app

The desktop app talks to Plaid directly, not through a server. Its Plaid keys are compiled into the build: put `PLAID_CLIENT_ID`, `PLAID_SECRET`, and `PLAID_ENV` in `apps/desktop/.env` (see `apps/desktop/.env.example`) before `pnpm --filter moat-desktop run dist:mac` (or `dist:win` / `dist:linux`). Production desktop builds fail if the keys are missing. Don't distribute a build that contains your keys to people you don't trust with them.

## Scheduled jobs

`apps/api/vercel.json` is the single source of truth for scheduled jobs: its `crons` array (`{ path, schedule }`, UTC) is read directly by Vercel for hosted deploys, and `scripts/self-host/crontab` is generated from it for the `cron` container. Each job sends an HTTP GET to the `api` service with `Authorization: Bearer $CRON_SECRET`. After the `crons` array changes, regenerate the crontab:

```bash
node scripts/self-host/generate-crontab.mjs && docker compose restart cron
```

Run a job by hand:

```bash
docker compose exec cron sh /self-host/run-cron.sh /api/cron/scheduled-balance-sync
docker compose logs cron
```

The API also exposes cleanup endpoints that are not scheduled by default: `cleanup-demo-sessions`, `cleanup-expired-2fa-tokens`, `cleanup-expired-auth-sessions`, and `cleanup-raw-webhook-payloads` under `/api/cron/`. Add them to the `crons` array in `apps/api/vercel.json` (then regenerate the crontab) if you want them to run.

## Backups

All state lives in Postgres plus your `.env`. The `ENCRYPTION_KEY` in `.env` is required to read the encrypted columns.

```bash
# Back up
docker compose exec -T postgres pg_dump -U moat -d moat -Fc > moat-$(date +%F).dump

# Restore into a fresh stack (this replaces existing data)
docker compose up -d postgres
docker compose exec -T postgres pg_restore -U moat -d moat --clean --if-exists < moat-2026-01-01.dump
docker compose up -d
```

Schedule the backup command with your host's cron and copy the dumps off the machine.

## Upgrading

```bash
git pull
docker compose build
docker compose up -d          # migrate runs `prisma migrate deploy` before api/mcp start
docker compose logs migrate   # confirm "All migrations have been successfully applied."
```

Take a backup before you upgrade. Migrations only move forward.

## Troubleshooting

- **`docker compose ps` shows `migrate` exited with a non-zero code.** Run `docker compose logs migrate`. The usual cause is a wrong `DATABASE_URL` or `DIRECT_URL` for an external database.
- **Login loops or the API returns 401.** Make sure `PUBLIC_WEB_URL` matches the URL in the browser, that `PUBLIC_API_URL` was set *before* the web build, and that `AUTH_COOKIE_DOMAIN` is either unset or covers both hostnames.
- **CORS errors in the browser console.** Add the origin to `CORS_ALLOWED_ORIGINS`.
- **API fails to start with `Production startup failed: required environment variables are missing`.** The error lists the missing keys. Some are required only when a related integration is configured. For example, `AUTH_GOOGLE_ID_IOS` is required when `AUTH_GOOGLE_ID` is set.

## Forking: things to rename

If you fork Moat and ship your own builds, replace these values, which belong to the upstream project:

- **Apple Team ID `8VDD3425PX`** and **bundle IDs `com.moatfinance.*`** in `apps/ios` (`Moat.xcodeproj/project.pbxproj`, entitlements, and App Group IDs) and in `apps/desktop` (`package.json` → `build.appId` `com.moatfinance.desktop`, plus signing and notarization config).
- **Desktop auto-update URL** in `apps/desktop/package.json` → `build.publish.url` (`https://downloads.moatfinance.ai/updates`). Point it at your own update server, or remove it.
- **Desktop API and web defaults.** Packaged desktop builds fall back to `https://api.moatfinance.ai` / `https://app.moatfinance.ai` for cloud endpoints (vault recovery, feedback, remote MCP). Set `MOAT_API_URL` / `VITE_MOAT_API_URL` and `MOAT_WEB_URL` at build time (see `apps/desktop/.env.example`) to point at your own server.
- **GitHub workflows** in `.github/workflows/` need no repository secrets: `ci.yml` (lint, typecheck, API contract tests), `security.yml`, and the manual Plaid Golden mock-server suites. Add your own release workflows if you ship signed builds.
- **Marketing domain `moatfinance.ai`** in `apps/marketing`, email templates (`apps/api/src/lib/email/`), support addresses, and any defaults that still reference `app.moatfinance.ai` or `mcp.moatfinance.ai`.
- **Browser extension ID** (`NEXT_PUBLIC_MOAT_RETAIL_EXTENSION_ID`) if you publish your own build of `apps/extension`.

## How the images are built

- `apps/api/Dockerfile`, `apps/web/Dockerfile`, and `apps/mcp/Dockerfile` all build from the repo root with a byte-identical `base` + `deps` stage. Docker builds the dependency install once, and all three images share it.
- Web and API run `next start` from the workspace. MCP is bundled to CommonJS with `scripts/self-host/build-mcp.mjs`, because `apps/mcp` (ESM) imports TypeScript from `apps/api` (CommonJS).
- Containers run as the unprivileged `node` user. The `cron` container runs busybox `crond` as root inside a minimal Alpine image that only has `curl`.
