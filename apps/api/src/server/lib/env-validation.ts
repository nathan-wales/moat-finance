/**
 * Centralized production environment validation.
 *
 * Call `validateProductionConfig()` at API startup (e.g., in the Next.js
 * custom server or as an import side-effect in the API entry point).
 *
 * Rules:
 * - In production, missing required secrets cause an error that prevents requests
 *   from being served (fail-closed).
 * - In non-production, missing optional provider secrets log a warning only.
 * - Never log secret values — only log whether they are present or absent.
 */

import { TAXES_PRODUCT_ENABLED } from "@moat/contracts";
import { logger } from "~/lib/logger";

type SecretRule = {
	/** Environment variable name */
	key: string;
	/** Human-readable description shown in error messages */
	description: string;
	/** Minimum accepted length for secrets where entropy matters. */
	minLength?: number;
	/**
	 * Optional: return true only when this secret is required (e.g. feature flag is enabled).
	 * If omitted, the secret is always required in production.
	 */
	requiredWhen?: () => boolean;
};

const PRODUCTION_REQUIRED: SecretRule[] = [
	{
		key: "AUTH_SECRET",
		description: "NextAuth signing secret",
	},
	{
		key: "ENCRYPTION_KEY",
		description:
			"AES-256-GCM encryption key for provider tokens and 2FA secrets",
	},
	{
		key: "CRON_SECRET",
		description: "Cron job authorization secret",
	},
	{
		key: "MCP_TOKEN_PEPPER",
		description: "MCP personal access token hashing pepper",
		minLength: 32,
	},
	{
		key: "TAX_R2_ACCOUNT_ID",
		description: "Cloudflare account ID for private tax-file R2 storage",
		// Taxes is a parked product; R2 is only needed once it is re-enabled.
		requiredWhen: () => TAXES_PRODUCT_ENABLED,
	},
	{
		key: "TAX_R2_ACCESS_KEY_ID",
		description: "R2 API token access key scoped to the tax-files bucket",
		// Taxes is a parked product; R2 is only needed once it is re-enabled.
		requiredWhen: () => TAXES_PRODUCT_ENABLED,
	},
	{
		key: "TAX_R2_SECRET_ACCESS_KEY",
		description: "R2 API token secret scoped to the tax-files bucket",
		// Taxes is a parked product; R2 is only needed once it is re-enabled.
		requiredWhen: () => TAXES_PRODUCT_ENABLED,
	},
	{
		key: "TAX_R2_BUCKET",
		description:
			"Private R2 bucket name for tax documents (not the downloads CDN)",
		// Taxes is a parked product; R2 is only needed once it is re-enabled.
		requiredWhen: () => TAXES_PRODUCT_ENABLED,
	},
	{
		key: "AUTH_GOOGLE_ID_IOS",
		description: "iOS Google OAuth client ID for native token verification",
		requiredWhen: () => !!process.env.AUTH_GOOGLE_ID,
	},
	// Plaid (bring your own keys) — the client ID and secret must be set together
	{
		key: "PLAID_CLIENT_ID",
		description: "Plaid client ID",
		requiredWhen: () =>
			!!process.env.PLAID_SECRET || !!process.env.PLAID_WEBHOOK,
	},
	{
		key: "PLAID_SECRET",
		description: "Plaid secret key",
		requiredWhen: () =>
			!!process.env.PLAID_CLIENT_ID || !!process.env.PLAID_WEBHOOK,
	},
	// Finicity — required when Finicity webhook is enabled
	{
		key: "FINICITY_WEBHOOK_SECRET",
		description: "Finicity webhook signature secret",
		requiredWhen: () => !!process.env.FINICITY_APP_KEY,
	},
	// MX — required when MX webhook is enabled
	{
		key: "MX_WEBHOOK_BASIC_AUTH_USERNAME",
		description: "MX webhook basic auth username",
		requiredWhen: () => !!process.env.MX_CLIENT_ID,
	},
	{
		key: "MX_WEBHOOK_BASIC_AUTH_PASSWORD",
		description: "MX webhook basic auth password",
		requiredWhen: () => !!process.env.MX_CLIENT_ID,
	},
	// GitHub feedback sync — required when explicitly enabled
	{
		key: "GITHUB_FEEDBACK_TOKEN",
		description: "GitHub fine-grained PAT for feedback issue creation",
		requiredWhen: () => process.env.GITHUB_FEEDBACK_ENABLED === "true",
	},
	{
		key: "GITHUB_FEEDBACK_OWNER",
		description: "GitHub organization or user that owns the feedback repo",
		requiredWhen: () =>
			process.env.GITHUB_FEEDBACK_ENABLED === "true" &&
			!process.env.GITHUB_FEEDBACK_REPO_OWNER,
	},
	{
		key: "GITHUB_FEEDBACK_REPO",
		description: "GitHub repository name for feedback issues",
		requiredWhen: () =>
			process.env.GITHUB_FEEDBACK_ENABLED === "true" &&
			!process.env.GITHUB_FEEDBACK_REPO_NAME,
	},
	{
		key: "GITHUB_FEEDBACK_REPO_OWNER",
		description: "GitHub organization or user that owns the feedback repo",
		requiredWhen: () =>
			process.env.GITHUB_FEEDBACK_ENABLED === "true" &&
			!process.env.GITHUB_FEEDBACK_OWNER,
	},
	{
		key: "GITHUB_FEEDBACK_REPO_NAME",
		description: "GitHub repository name for feedback issues",
		requiredWhen: () =>
			process.env.GITHUB_FEEDBACK_ENABLED === "true" &&
			!process.env.GITHUB_FEEDBACK_REPO,
	},
];

const OPTIONAL_OBSERVABILITY: SecretRule[] = [
	{
		key: "AXIOM_TOKEN",
		description: "Axiom ingest API token",
	},
	{
		key: "AXIOM_DATASET",
		description: "Axiom dataset name (e.g. moat_finance)",
	},
];

const OPTIONAL_TAX_PARSER: SecretRule[] = [
	{
		key: "DOCLING_PARSER_URL",
		description: "Private Docling Cloud Run parser URL",
	},
];

const OPTIONAL_TAX_PARSER_WHEN_URL_SET: SecretRule[] = [
	{
		key: "DOCLING_RUNTIME_SERVICE_ACCOUNT",
		description:
			"Cloud Run runtime service account allowed to drain parse jobs",
	},
	{
		key: "DOCLING_PARSE_AUDIENCE",
		description: "Google identity token audience for the Moat tax-parse API",
	},
];

const OPTIONAL_TAX_LLM_WHEN_ENABLED: SecretRule[] = [
	{
		key: "TAX_LLM_CONTROLLER_URL",
		description: "Cloud Run controller URL for the tax LLM worker",
	},
	{
		key: "TAX_LLM_ENCRYPTION_KEY_v1",
		description: "AES-256-GCM key for tax LLM queue payloads (Base64)",
	},
	{
		key: "TAX_LLM_RUNTIME_SERVICE_ACCOUNT",
		description: "Service account allowed to persist tax LLM results",
	},
];

let validated = false;

export function resetProductionConfigValidationForTests(): void {
	if (process.env.NODE_ENV !== "test") {
		throw new Error("resetProductionConfigValidationForTests is test-only");
	}
	validated = false;
}

/**
 * Validate that all required production secrets are present.
 *
 * In production: throws if any required secret is missing (fail-closed).
 * In non-production: logs a warning for any missing secret.
 *
 * Call once at startup. Subsequent calls are no-ops.
 */
export function validateProductionConfig(): void {
	if (validated) return;
	validated = true;

	if (process.env.NODE_ENV !== "production") {
		// In dev/test, warn about any absent secrets that are always-required
		const alwaysRequired = PRODUCTION_REQUIRED.filter((r) => !r.requiredWhen);
		const missing = alwaysRequired.filter((r) => !process.env[r.key]);
		for (const rule of missing) {
			logger.warn(
				`[env] Missing secret in non-production: ${rule.key} (${rule.description})`,
				{
					feature: "config",
					operation: "validateProductionConfig",
					key: rule.key,
				},
			);
		}
		return;
	}

	// Production: collect all failures before throwing so we surface all issues at once
	const failures: string[] = [];

	for (const rule of PRODUCTION_REQUIRED) {
		const isRequired = rule.requiredWhen ? rule.requiredWhen() : true;
		if (!isRequired) continue;

		const value = process.env[rule.key];
		if (!value) {
			failures.push(`  ✗ ${rule.key} — ${rule.description}`);
			logger.error(`[env] MISSING REQUIRED SECRET: ${rule.key}`, {
				feature: "config",
				operation: "validateProductionConfig",
				key: rule.key,
				description: rule.description,
			});
			continue;
		}

		if (rule.minLength && value.length < rule.minLength) {
			failures.push(
				`  ✗ ${rule.key} — ${rule.description} must be at least ${rule.minLength} characters`,
			);
			logger.error(`[env] REQUIRED SECRET TOO SHORT: ${rule.key}`, {
				feature: "config",
				operation: "validateProductionConfig",
				key: rule.key,
				description: rule.description,
				minLength: rule.minLength,
			});
		}
	}

	if (failures.length > 0) {
		throw new Error(
			`Production startup failed: required environment variables are missing.\n${failures.join("\n")}\n\nSee apps/api/.env.example for setup instructions.`,
		);
	}

	logger.info(
		"[env] Production configuration validated — all required secrets present",
		{
			feature: "config",
			operation: "validateProductionConfig",
			checkedCount: PRODUCTION_REQUIRED.length,
		},
	);

	warnMissingOptionalObservability();
	warnMissingOptionalTaxParser();
	warnMissingOptionalTaxLlm();
}

function warnMissingOptionalObservability(): void {
	for (const rule of OPTIONAL_OBSERVABILITY) {
		if (process.env[rule.key]) {
			continue;
		}

		logger.warn(`[env] Missing optional observability config: ${rule.key}`, {
			feature: "config",
			operation: "validateProductionConfig",
			key: rule.key,
			description: rule.description,
		});
	}
}

function warnMissingOptionalTaxParser(): void {
	if (!TAXES_PRODUCT_ENABLED) return;
	for (const rule of OPTIONAL_TAX_PARSER) {
		if (process.env[rule.key]?.trim()) {
			continue;
		}

		logger.warn(
			`[env] Missing optional tax parser config: ${rule.key} — production will use the heuristic parser`,
			{
				feature: "tax-parse",
				operation: "validateProductionConfig",
				key: rule.key,
				description: rule.description,
			},
		);
		return;
	}

	for (const rule of OPTIONAL_TAX_PARSER_WHEN_URL_SET) {
		if (process.env[rule.key]?.trim()) {
			continue;
		}

		logger.warn(
			`[env] Missing tax parse drain config: ${rule.key} — async Docling jobs cannot authenticate`,
			{
				feature: "tax-parse",
				operation: "validateProductionConfig",
				key: rule.key,
				description: rule.description,
			},
		);
	}
}

function warnMissingOptionalTaxLlm(): void {
	if (!TAXES_PRODUCT_ENABLED) return;
	if (process.env.TAX_LLM_EXTRACTION_ENABLED !== "true") {
		return;
	}
	for (const rule of OPTIONAL_TAX_LLM_WHEN_ENABLED) {
		if (process.env[rule.key]?.trim()) {
			continue;
		}
		logger.warn(
			`[env] Missing tax LLM config: ${rule.key} — W-2 LLM extraction cannot run`,
			{
				feature: "tax-llm",
				operation: "validateProductionConfig",
				key: rule.key,
				description: rule.description,
			},
		);
	}
}

/**
 * Check if a single secret is available. Logs an error in production if missing.
 * Use this for lazy checks within handler code.
 */
export function requireSecret(key: string, description: string): string {
	const value = process.env[key];
	if (!value) {
		const msg = `Required secret ${key} (${description}) is not set`;
		logger.error(msg, { feature: "config", operation: "requireSecret", key });
		throw new Error(msg);
	}
	return value;
}
