import type { LogEnv } from "./types";

const LOG_ENVS: readonly LogEnv[] = ["local", "preview", "production"];

function isLogEnv(value: string): value is LogEnv {
	return (LOG_ENVS as readonly string[]).includes(value);
}

/**
 * Resolution order:
 * 1. `APP_ENV` — explicit override for any host (self-hosted, Docker).
 * 2. `VERCEL_ENV=preview` — Vercel preview deployments.
 * 3. `NODE_ENV=production` → production, otherwise local.
 */
export function resolveLogEnv(): LogEnv {
	const appEnv = process.env.APP_ENV?.trim().toLowerCase();
	if (appEnv && isLogEnv(appEnv)) {
		return appEnv;
	}

	if (process.env.VERCEL_ENV === "preview") {
		return "preview";
	}

	if (process.env.NODE_ENV === "production") {
		return "production";
	}

	return "local";
}
