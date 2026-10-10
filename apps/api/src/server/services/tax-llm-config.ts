import { FORM_SCHEMA_VERSION, TAXES_PRODUCT_ENABLED } from "@moat/contracts";
import {
	TAX_LLM_DEFAULT_KEY_VERSION,
	TAX_LLM_MODEL,
	TAX_LLM_MODEL_REVISION,
} from "@moat/domain";
import { resolveInternalApiOrigin } from "~/server/lib/internal-api-origin";

export function isTaxLlmExtractionEnabled(
	env: Record<string, string | undefined> = process.env,
): boolean {
	// TODO(taxes-restore): product is parked (`TAXES_PRODUCT_ENABLED`).
	// Extraction also needs the GCP GPU VM (`infra/tax-llm`, Qwen3-8B / vLLM
	// on `moat-tax-llm-worker`) healthy. E2E was close but never fully
	// proven. Do not enable unless a human explicitly asks to restore Taxes.
	return (
		TAXES_PRODUCT_ENABLED &&
		env.TAX_LLM_EXTRACTION_ENABLED === "true" &&
		Boolean(env.TAX_LLM_CONTROLLER_URL?.trim()) &&
		Boolean(
			env[`TAX_LLM_ENCRYPTION_KEY_${taxLlmActiveKeyVersion(env)}`]?.trim(),
		)
	);
}

export function taxLlmActiveKeyVersion(
	env: Record<string, string | undefined> = process.env,
): string {
	return (
		env.TAX_LLM_ENCRYPTION_KEY_VERSION?.trim() || TAX_LLM_DEFAULT_KEY_VERSION
	);
}

export function taxLlmControllerUrl(
	env: Record<string, string | undefined> = process.env,
): string {
	const url = env.TAX_LLM_CONTROLLER_URL?.trim();
	if (!url) {
		throw new Error("TAX_LLM_CONTROLLER_URL is not configured");
	}
	return url.replace(/\/$/, "");
}

export function taxLlmRuntimeServiceAccounts(
	env: Record<string, string | undefined> = process.env,
): string[] {
	const value = env.TAX_LLM_RUNTIME_SERVICE_ACCOUNT?.trim();
	if (!value) return [];
	return value
		.split(",")
		.map((entry) => entry.trim())
		.filter((entry) => entry.length > 0);
}

export function taxLlmAudience(
	env: Record<string, string | undefined> = process.env,
): string {
	const configured = env.TAX_LLM_PARSE_AUDIENCE?.trim();
	if (configured) return configured.replace(/\/$/, "");
	return resolveInternalApiOrigin(env);
}

export function taxLlmModelMetadata() {
	return {
		provider: "self-hosted" as const,
		model: TAX_LLM_MODEL,
		modelRevision: TAX_LLM_MODEL_REVISION,
		schemaVersion: FORM_SCHEMA_VERSION,
	};
}
