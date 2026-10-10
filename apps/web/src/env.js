import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
	server: {
		AUTH_SECRET:
			process.env.NODE_ENV === "production"
				? z.string()
				: z.string().optional(),
		AUTH_GOOGLE_ID: z.string().optional(),
		AUTH_GOOGLE_SECRET: z.string().optional(),
		NODE_ENV: z
			.enum(["development", "test", "production"])
			.default("development"),
		ENCRYPTION_KEY: z.string().optional(),
		// Comma-separated admin allowlist (server-only; no default)
		ADMIN_EMAILS: z.string().optional(),
		// Session cookie Domain attribute (e.g. ".example.com"); unset = host-only
		AUTH_COOKIE_DOMAIN: z.string().optional(),
		// Axiom
		AXIOM_TOKEN: z.string().optional(),
		AXIOM_DATASET: z.string().optional(),
	},

	client: {
		// PostHog
		NEXT_PUBLIC_POSTHOG_KEY: z.string().optional(),
		NEXT_PUBLIC_POSTHOG_HOST: z.string().optional(),
		// Logo.dev (publishable key — safe for client-side img.logo.dev CDN usage)
		NEXT_PUBLIC_LOGO_DEV_PUBLISHABLE_KEY: z.string().optional(),
		// Moat Retail Sync Chrome extension id
		NEXT_PUBLIC_MOAT_RETAIL_EXTENSION_ID: z.string().optional(),
		NEXT_PUBLIC_APP_VERSION: z.string().optional(),
		NEXT_PUBLIC_E2E: z.literal("1").optional(),
		// Public MCP endpoint shown in AI-access setup (defaults to hosted)
		NEXT_PUBLIC_MCP_URL: z.string().optional(),
	},

	runtimeEnv: {
		AUTH_SECRET: process.env.AUTH_SECRET,
		AUTH_GOOGLE_ID: process.env.AUTH_GOOGLE_ID,
		AUTH_GOOGLE_SECRET: process.env.AUTH_GOOGLE_SECRET,
		NODE_ENV: process.env.NODE_ENV,
		ENCRYPTION_KEY: process.env.ENCRYPTION_KEY,
		ADMIN_EMAILS: process.env.ADMIN_EMAILS,
		AUTH_COOKIE_DOMAIN: process.env.AUTH_COOKIE_DOMAIN,
		NEXT_PUBLIC_MCP_URL: process.env.NEXT_PUBLIC_MCP_URL,
		// PostHog
		NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY,
		NEXT_PUBLIC_POSTHOG_HOST: process.env.NEXT_PUBLIC_POSTHOG_HOST,
		// Logo.dev
		NEXT_PUBLIC_LOGO_DEV_PUBLISHABLE_KEY:
			process.env.NEXT_PUBLIC_LOGO_DEV_PUBLISHABLE_KEY,
		NEXT_PUBLIC_MOAT_RETAIL_EXTENSION_ID:
			process.env.NEXT_PUBLIC_MOAT_RETAIL_EXTENSION_ID,
		NEXT_PUBLIC_APP_VERSION: process.env.NEXT_PUBLIC_APP_VERSION,
		NEXT_PUBLIC_E2E: process.env.NEXT_PUBLIC_E2E,
		// Axiom
		AXIOM_TOKEN: process.env.AXIOM_TOKEN,
		AXIOM_DATASET: process.env.AXIOM_DATASET,
	},
	skipValidation: !!process.env.SKIP_ENV_VALIDATION,
	emptyStringAsUndefined: true,
});
