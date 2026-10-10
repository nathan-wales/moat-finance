# Add Redis Rate Limiting to MCP App

Currently the MCP app uses **in-memory rate limiting** for all environments. This works fine for a single-instance deployment but won't be consistent across multiple instances (e.g., multiple Vercel serverless function replicas). When traffic grows, swap in Upstash Redis.

## Why Upstash?

- Serverless-friendly: HTTP-based, no persistent connection required
- Free tier is sufficient for low traffic
- Already wired into the codebase — just needs credentials

## Steps

### 1. Create an Upstash Redis database

1. Go to [console.upstash.com](https://console.upstash.com)
2. Create a new **Redis** database (choose the same region as your Vercel deployment, e.g. `us-east-1`)
3. Copy the **REST URL** and **REST Token** from the database details page

### 2. Add environment variables

Add to the MCP app's Vercel environment variables (Settings → Environment Variables):

```
UPSTASH_REDIS_REST_URL=https://<your-db>.upstash.io
UPSTASH_REDIS_REST_TOKEN=<your-token>
```

Also add to `apps/mcp/.env` for local testing if desired.

### 3. Re-enable the production guard

In `apps/mcp/src/rate-limit/rate-limit.ts`, the `getRedis()` function currently falls back to in-memory for all environments. Restore the production enforcement by adding the guard back:

```ts
function getRedis(): Redis | null {
  if (redisClient) return redisClient;
  const env = getEnv();
  if (!env.UPSTASH_REDIS_REST_URL || !env.UPSTASH_REDIS_REST_TOKEN) {
    if (env.NODE_ENV === "production") {
      throw new Error("Upstash Redis is required for MCP rate limiting");
    }
    return null;
  }
  redisClient = new Redis({
    url: env.UPSTASH_REDIS_REST_URL,
    token: env.UPSTASH_REDIS_REST_TOKEN,
  });
  return redisClient;
}
```

### 4. Verify locally

```bash
UPSTASH_REDIS_REST_URL=<url> UPSTASH_REDIS_REST_TOKEN=<token> pnpm --filter @moat/mcp run dev
```

Hit the `/oauth/register` endpoint a few times and confirm requests start getting rate-limited after the configured threshold.

### 5. Deploy

```bash
git push
```

Vercel will pick up the new env vars and the Redis client will be used automatically.

## Rate limit configuration

Current defaults (in `rate-limit.ts`):

| Context | Default limit | Window |
|---|---|---|
| Tool calls (per user) | 60 req/min | 1 minute |
| Anonymous OAuth ops | 60 req/min | 1 minute |

Adjust the `limit` passed to `checkRateLimitByIdentifier` or expose per-tool overrides in `getToolRateLimit()` in `registry.ts` as needed.
