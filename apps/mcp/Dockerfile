# syntax=docker/dockerfile:1
#
# Moat Finance MCP server (Express HTTP transport on port 3010, run with tsx).
# Build from the repo root:  docker build -f apps/mcp/Dockerfile .
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

# ── MCP build + runtime ──────────────────────────────────────────────────────
# apps/mcp is ESM and imports TypeScript from apps/api (CommonJS); running it
# with tsx fails on those named imports. scripts/self-host/build-mcp.mjs bundles
# the HTTP server to CommonJS (like Vercel compiles it). npm deps and the
# generated Prisma client stay external, so the workspace node_modules are kept.
FROM deps AS runner
RUN node scripts/self-host/build-mcp.mjs
ENV NODE_ENV=production \
	MCP_PORT=3010
USER node
WORKDIR /repo/apps/mcp
EXPOSE 3010
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=5 \
	CMD node -e "fetch('http://127.0.0.1:3010/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "--enable-source-maps", "dist/server.cjs"]
