export type NetWorthAccountFields = {
	type: string;
	subtype: string | null;
	currentBalance: number | null;
};

/** Loans and mortgages default out — real estate already counts as equity. */
export function shouldDefaultAccountInNetWorth(
	account: Pick<NetWorthAccountFields, "type" | "subtype">,
): boolean {
	const normalizedType = account.type.toLowerCase();
	const normalizedSubtype = account.subtype?.toLowerCase() ?? "";
	return normalizedType !== "loan" && !normalizedSubtype.includes("mortgage");
}

/** Credit and loan balances are liabilities; store/sum them as negatives. */
export function signedAccountBalanceForNetWorth(
	type: string,
	currentBalance: number,
): number {
	const normalizedType = type.toLowerCase();
	if (normalizedType === "credit" || normalizedType === "loan") {
		return -currentBalance;
	}
	return currentBalance;
}

export function accountNetWorthContribution(
	account: NetWorthAccountFields,
): number {
	if (account.currentBalance === null) return 0;
	if (!shouldDefaultAccountInNetWorth(account)) return 0;
	return signedAccountBalanceForNetWorth(account.type, account.currentBalance);
}
