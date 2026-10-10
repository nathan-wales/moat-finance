/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
import "./src/env.js";

/** @type {import("next").NextConfig} */
const config = {
	// Inlined for the Golden Playwright Link seam. Unset in production.
	env: {
		NEXT_PUBLIC_E2E: process.env.NEXT_PUBLIC_E2E,
	},
	// Dev `/api/v1` proxy lives in `src/app/api/v1/[...path]/route.ts`.
	// Next rewrites use a 30s proxyTimeout (ignored/unreliable under turbo),
	// which aborts long Plaid syncs with a socket hang up.
	// Avoid 308 loops: Chrome may cache a slash-adding redirect while Next
	// otherwise 308s `/path/` back to `/path`.
	skipTrailingSlashRedirect: true,
};

export default config;
