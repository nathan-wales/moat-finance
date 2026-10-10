# syntax=docker/dockerfile:1
#
# Moat Finance web app (Next.js App Router on port 3000).
# Build from the repo root:  docker build -f apps/web/Dockerfile .
#
# The first two stages (base, deps) are byte-identical across
# apps/{api,web,mcp}/Dockerfile so BuildKit shares one dependency install.

ARG NODE_VERSION=22

FROM node:${NODE_VERSION}-bookworm-slim AS base
RUN apt-get update \
	&& apt-get install -y --no-install-recommends openssl ca-certificates \
	&& rm -rf /var/lib/apt/lists/*
ENV PNPM_HOME=/pnpm \
	PATH=/pnpm:$PATH \
	CI=1 \
	NEXT_TELEMETRY_DISABLED=1 \
	ELECTRON_SKIP_BINARY_DOWNLOAD=1 \
	PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
RUN corepack enable && corepack prepare pnpm@8.10.0 --activate
WORKDIR /repo

# Download every package in the lockfile into the store (cached until the lockfile changes),
# then install only what web, api, and mcp need from that store.
FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
RUN --mount=type=cache,id=moat-pnpm-store,target=/pnpm/store \
	pnpm config set store-dir /pnpm/store \
	&& pnpm fetch --frozen-lockfile
COPY . .
# The root `prepare` script runs `git config core.hooksPath` (dev-only); a
# temporary no-op git shim lets it pass in an image that has no .git.
RUN --mount=type=cache,id=moat-pnpm-store,target=/pnpm/store \
	printf '#!/bin/sh\nexit 0\n' > /usr/local/bin/git && chmod +x /usr/local/bin/git \
	&& pnpm config set store-dir /pnpm/store \
	&& pnpm install --frozen-lockfile --offline \
		--filter "moat-web..." --filter "moat-api..." --filter "@moat/mcp..." \
	&& pnpm --filter moat-api exec prisma generate \
	&& rm /usr/local/bin/git

# ── Web build ────────────────────────────────────────────────────────────────
# NEXT_PUBLIC_* values are inlined into the browser bundle at build time,
# so they are build args (docker-compose.yml passes them from .env).
FROM deps AS build
ARG NEXT_PUBLIC_API_URL=http://localhost:3001
ARG NEXT_PUBLIC_MCP_URL=http://localhost:3010/mcp
ARG NEXT_PUBLIC_POSTHOG_KEY=
ARG NEXT_PUBLIC_POSTHOG_HOST=
ARG NEXT_PUBLIC_LOGO_DEV_PUBLISHABLE_KEY=
ARG NEXT_PUBLIC_MOAT_RETAIL_EXTENSION_ID=
ARG NEXT_PUBLIC_APP_VERSION=self-hosted
ENV NODE_ENV=production \
	SKIP_ENV_VALIDATION=1 \
	NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
	NEXT_PUBLIC_MCP_URL=$NEXT_PUBLIC_MCP_URL \
	NEXT_PUBLIC_POSTHOG_KEY=$NEXT_PUBLIC_POSTHOG_KEY \
	NEXT_PUBLIC_POSTHOG_HOST=$NEXT_PUBLIC_POSTHOG_HOST \
	NEXT_PUBLIC_LOGO_DEV_PUBLISHABLE_KEY=$NEXT_PUBLIC_LOGO_DEV_PUBLISHABLE_KEY \
	NEXT_PUBLIC_MOAT_RETAIL_EXTENSION_ID=$NEXT_PUBLIC_MOAT_RETAIL_EXTENSION_ID \
	NEXT_PUBLIC_APP_VERSION=$NEXT_PUBLIC_APP_VERSION
RUN pnpm --filter moat-web run build \
	&& rm -rf apps/web/.next/cache

FROM build AS runner
ENV NODE_ENV=production \
	PORT=3000 \
	HOSTNAME=0.0.0.0
RUN chown -R node:node /repo/apps/web/.next
USER node
WORKDIR /repo/apps/web
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=5 \
	CMD node -e "fetch('http://127.0.0.1:3000/',{redirect:'manual'}).then(r=>process.exit(r.status<500?0:1)).catch(()=>process.exit(1))"
CMD ["./node_modules/.bin/next", "start", "-H", "0.0.0.0", "-p", "3000"]
