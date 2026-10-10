import type { FinancialProfileData } from "@moat/contracts";

function isPlaidInvestmentId(investmentId: string): boolean {
	return investmentId.startsWith("plaid-") || investmentId.startsWith("plaid_");
}

function manualInvestmentAccountId(investmentId: string): string {
	return `investment-acct-${investmentId}`;
}

export function stripManualInvestmentFromProfile(
	data: FinancialProfileData,
	investmentId: string,
): FinancialProfileData {
	if (isPlaidInvestmentId(investmentId)) return data;

	const accountId = manualInvestmentAccountId(investmentId);
	const removedAccountLinks = new Set<string>([accountId]);

	for (const investment of data.investments) {
		if (investment.id === investmentId && investment.accountLink) {
			removedAccountLinks.add(investment.accountLink);
		}
	}

	return {
		...data,
		investments: data.investments.filter(
			(investment) => investment.id !== investmentId,
		),
		accounts: data.accounts.filter(
			(account) => !removedAccountLinks.has(account.id),
		),
	};
}

export function pruneMissingManualInvestmentsFromProfile(
	data: FinancialProfileData,
	canonicalInvestmentIds: ReadonlySet<string>,
): FinancialProfileData {
	const orphanInvestmentIds = new Set(
		data.investments
			.filter(
				(investment) =>
					!isPlaidInvestmentId(investment.id) &&
					!canonicalInvestmentIds.has(investment.id),
			)
			.map((investment) => investment.id),
	);

	if (orphanInvestmentIds.size === 0) return data;

	let next = data;
	for (const investmentId of orphanInvestmentIds) {
		next = stripManualInvestmentFromProfile(next, investmentId);
	}
	return next;
}
