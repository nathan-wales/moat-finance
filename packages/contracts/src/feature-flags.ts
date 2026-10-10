export const AMAZON_RETAIL_SYNC_FEATURE_FLAG = "amazon-retail-sync";

export const DESKTOP_REMOTE_MCP_FEATURE_FLAG = "desktop-remote-mcp";

export const TAXES_FEATURE_FLAG = "taxes";

/**
 * Master product switch. Taxes stays compiled and tested, but is not shipped
 * until this is true.
 *
 * TODO(taxes-restore): do not flip this (or iOS `ProductFlags.taxesEnabled`)
 * unless a human explicitly asks to restore the Taxes product. Do not
 * "helpfully" re-enable it while cleaning flags, wiring MCP, or finishing
 * tax-llm work.
 *
 * Restore checklist (only when explicitly asked):
 * 1. Set `TAXES_PRODUCT_ENABLED` to true here.
 * 2. Set iOS `ProductFlags.taxesEnabled` to true in
 *    `apps/ios/Moat/App/app-destination.swift` (keep in sync).
 * 3. PostHog `TAXES_FEATURE_FLAG` (`taxes`) still gates gradual rollout.
 * 4. Tax LLM is a separate switch. Bring back the self-hosted Qwen3-8B GPU
 *    VM on GCP (`infra/tax-llm`, instance `moat-tax-llm-worker`) and get
 *    extraction actually working end-to-end before setting
 *    `TAX_LLM_EXTRACTION_ENABLED=true`. Extraction was close but never
 *    fully proven E2E. Leave the VM stopped until that env is on.
 *
 * Mileage, filing-status / retirement tax assumptions, parsers, Prisma
 * models, and tax-llm infra stay in the tree either way.
 */
export const TAXES_PRODUCT_ENABLED = false;

export function isClientFeatureFlagVisible(
	featureFlag: string | undefined,
	enabledFlags: ReadonlySet<string>,
): boolean {
	if (!featureFlag) return true;
	if (featureFlag === TAXES_FEATURE_FLAG && !TAXES_PRODUCT_ENABLED) {
		return false;
	}
	return enabledFlags.has(featureFlag);
}
