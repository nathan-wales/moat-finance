// Pure repository interface for Plaid Accounts.
// No Prisma, no runtime dependencies.

export interface PlaidAccountSummary {
	id: string;
	plaidAccountId: string;
	plaidItemId: string;
	name: string;
	officialName: string | null;
	mask: string | null;
	type: string;
	subtype: string | null;
	currentBalance: number | null;
	availableBalance: number | null;
	currency: string;
	isActive: boolean;
	syncEnabled: boolean;
	isHidden: boolean;
	lastBalanceSyncAt: Date | null;
	monthlyContribution: number;
	annualReturnRate: number;
	notes: string | null;
	forecastInputsUserEdited: boolean;
}

export type UpdatePlaidForecastInputs = {
	monthlyContribution?: number;
	annualReturnRate?: number;
	notes?: string | null;
	name?: string;
};

export interface PlaidAccountRepository {
	listForItem(input: { plaidItemId: string }): Promise<PlaidAccountSummary[]>;
	listActiveForUser(input: { userId: string }): Promise<PlaidAccountSummary[]>;
	setHidden(input: {
		userId: string;
		plaidAccountId: string;
		isHidden: boolean;
	}): Promise<void>;
	updateForecastInputs(input: {
		userId: string;
		accountId: string;
		data: UpdatePlaidForecastInputs;
	}): Promise<PlaidAccountSummary>;
}
