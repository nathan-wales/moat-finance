export const TRANSACTIONS_HREF = "/transactions";
export const RULES_HREF = "/rules";
export const IMPORT_HREF = "/transactions/import";

export type TransactionsNavSelection =
	| "transactions"
	| "rules"
	| "import"
	| null;

function matchesPath(pathname: string, href: string): boolean {
	return pathname === href || pathname.startsWith(`${href}/`);
}

export function getTransactionsNavSelection(
	pathname: string,
): TransactionsNavSelection {
	if (matchesPath(pathname, IMPORT_HREF) || matchesPath(pathname, "/import")) {
		return "import";
	}
	if (matchesPath(pathname, RULES_HREF)) {
		return "rules";
	}
	if (pathname === TRANSACTIONS_HREF) {
		return "transactions";
	}
	return null;
}

export function isTransactionsNavChildActive(
	selection: TransactionsNavSelection,
): boolean {
	return selection === "rules" || selection === "import";
}
