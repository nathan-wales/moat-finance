import type {
	OnboardingInvestment,
	OnboardingPlaidAccount,
	OnboardingRealEstateProperty,
} from "@moat/contracts";
import type { ReactNode } from "react";

export type StepConnectAccountsProps = {
	connectAccountAction: ReactNode;
	addInvestmentAction: ReactNode;
	tertiaryAction?: ReactNode;
	onAccountConnected: () => void;
	currentAge?: number;
	retirementAge?: number;
	onProfileChange: (profile: {
		currentAge?: number;
		retirementAge?: number;
	}) => void;
	onProfileSave?: () => void;
};

export type ProfileInputsProps = {
	currentAge?: number;
	retirementAge?: number;
	onProfileChange: (profile: {
		currentAge?: number;
		retirementAge?: number;
	}) => void;
	onProfileSave?: () => void;
};

export type AccountListProps = {
	plaidAccounts: OnboardingPlaidAccount[];
	investments: OnboardingInvestment[];
	realEstateProperties: OnboardingRealEstateProperty[];
	hasAccounts: boolean;
	connectAccountAction: ReactNode;
	addInvestmentAction: ReactNode;
	tertiaryAction?: ReactNode;
};

export type ConnectAccountsPreviewProps = {
	hasAccounts: boolean;
	portfolioData:
		| import("@moat/contracts").PortfolioAllocationResponse
		| undefined;
	portfolioLoading: boolean;
	historyData:
		| import("@moat/contracts").BalanceSnapshotHistoryResponse
		| undefined;
	historyLoading: boolean;
	monthlyData: import("@moat/contracts").MonthlyAggregatesResponse | undefined;
	monthlyLoading: boolean;
};
