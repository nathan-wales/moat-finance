import type { ManualInvestmentType } from "@moat/contracts";

export function mapProfileTypeToInvestmentType(
	type: string,
): ManualInvestmentType {
	const normalized = type.toLowerCase().trim();
	if (normalized.includes("401")) return "FOUR01K";
	if (normalized.includes("roth")) return "ROTH_IRA";
	if (normalized.includes("ira")) return "ROTH_IRA";
	if (normalized.includes("hsa")) return "HSA";
	if (normalized.includes("real")) return "REAL_ESTATE";
	if (
		normalized.includes("stock") ||
		normalized.includes("brokerage") ||
		normalized.includes("mutual")
	) {
		return "STOCKS";
	}
	return "OTHER";
}

export function investmentIdFromAccountId(accountId: string): string | null {
	const prefix = "investment-acct-";
	if (!accountId.startsWith(prefix)) return null;
	return accountId.slice(prefix.length);
}

/** Bare Plaid account id from profile account or investment id variants. */
export function barePlaidAccountId(id: string): string {
	return id.replace(/^plaid[-_]/, "");
}

/**
 * Canonical updateInvestment id for a synced Plaid account (`plaid_{bareId}`).
 * The investment list API uses underscores; profile merge may use hyphens.
 */
export function plaidInvestmentUpdateId(accountId: string): string {
	return `plaid_${barePlaidAccountId(accountId)}`;
}

export function findSyncedInvestmentForAccount<
	T extends { id: string; accountLink?: string },
>(investments: T[], accountId: string): T | null {
	const bareId = barePlaidAccountId(accountId);
	const candidates = new Set([
		accountId,
		bareId,
		`plaid-${bareId}`,
		`plaid_${bareId}`,
	]);
	return (
		investments.find((investment) => candidates.has(investment.id)) ??
		investments.find((investment) => investment.accountLink === accountId) ??
		null
	);
}
