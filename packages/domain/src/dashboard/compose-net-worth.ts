import {
	shouldDefaultAccountInNetWorth,
	signedAccountBalanceForNetWorth,
} from "./account-net-worth";

export type NetWorthPlaidAccount = {
	id: string;
	type: string;
	subtype: string | null;
	currentBalance: number | null;
};

export type NetWorthProfileAccount = {
	id: string;
	includedInNetWorth: boolean;
};

export type NetWorthInvestment = {
	id: string;
	startingBalance: number;
};

export type NetWorthRealEstate = {
	id: string;
	currentEstimatedValue: number;
	currentLoanBalance: number;
};

export type NetWorthProfileAsset = {
	id: string;
	type: string;
	estimatedValue: number;
	includeInNetWorth: boolean;
};

export type NetWorthComponentSource = "PLAID" | "INVESTMENT" | "REAL_ESTATE";

export type NetWorthComponent = {
	source: NetWorthComponentSource;
	sourceId: string;
	balance: number;
};

export type ComposeNetWorthInput = {
	plaidAccounts: NetWorthPlaidAccount[];
	profileAccounts?: NetWorthProfileAccount[];
	investments?: NetWorthInvestment[];
	realEstate?: NetWorthRealEstate[];
	profileAssets?: NetWorthProfileAsset[];
};

function findProfileAccount(
	profileAccounts: NetWorthProfileAccount[],
	plaidAccountId: string,
) {
	return profileAccounts.find(
		(account) =>
			account.id === plaidAccountId || account.id === `plaid-${plaidAccountId}`,
	);
}

export function shouldIncludePlaidAccountInNetWorth(
	profileAccounts: NetWorthProfileAccount[],
	account: Pick<NetWorthPlaidAccount, "id" | "type" | "subtype">,
): boolean {
	return (
		findProfileAccount(profileAccounts, account.id)?.includedInNetWorth ??
		shouldDefaultAccountInNetWorth(account)
	);
}

export function composeNetWorthComponents(
	input: ComposeNetWorthInput,
): NetWorthComponent[] {
	const profileAccounts = input.profileAccounts ?? [];
	const investments = input.investments ?? [];
	const realEstate = input.realEstate ?? [];
	const profileAssets = (input.profileAssets ?? []).filter(
		(asset) => asset.includeInNetWorth && asset.type !== "Real estate",
	);

	const includedPlaidAccounts = input.plaidAccounts.filter((account) =>
		shouldIncludePlaidAccountInNetWorth(profileAccounts, account),
	);

	return [
		...includedPlaidAccounts.map((account) => ({
			source: "PLAID" as const,
			sourceId: account.id,
			balance: signedAccountBalanceForNetWorth(
				account.type,
				account.currentBalance ?? 0,
			),
		})),
		...investments.map((investment) => ({
			source: "INVESTMENT" as const,
			sourceId: investment.id,
			balance: investment.startingBalance,
		})),
		...realEstate.map((property) => ({
			source: "REAL_ESTATE" as const,
			sourceId: property.id,
			balance: property.currentEstimatedValue - property.currentLoanBalance,
		})),
		...profileAssets.map((asset) => ({
			source: "REAL_ESTATE" as const,
			sourceId: `profile-asset-${asset.id}`,
			balance: asset.estimatedValue,
		})),
	];
}

export function sumNetWorthComponents(components: NetWorthComponent[]): number {
	return components.reduce((sum, component) => sum + component.balance, 0);
}
