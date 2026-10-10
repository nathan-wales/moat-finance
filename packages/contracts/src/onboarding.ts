export type OnboardingPlaidAccount = {
	id: string;
	name: string;
	currentBalance: number | null;
	institutionName: string;
	plaidItemId?: string;
};

export type OnboardingInvestment = {
	id: string;
	name: string;
	type: string;
	startingBalance: number;
};

export type OnboardingRealEstateProperty = {
	id: string;
	name: string;
	currentEstimatedValue: number;
	currentLoanBalance: number;
};

export type OnboardingAccountSources = {
	plaidAccounts: OnboardingPlaidAccount[];
	investments: OnboardingInvestment[];
	realEstate: OnboardingRealEstateProperty[];
};
