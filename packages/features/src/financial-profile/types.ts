import type {
	FinancialProfileData,
	FinancialProfileRecord,
	ForecastAssumptions,
	IncomeSource,
	InsurancePolicy,
	InsurancePolicyType,
	InsurancePolicyV2,
	PlanningNote,
	ProfileAccount,
	ProfileAsset,
	ProfileInvestment,
	ProfileLiability,
	TaxProfile,
	TaxProfileRecommendations,
} from "@moat/contracts";

// Re-export all types from contracts so section components can use them
export type {
	FinancialProfileData,
	FinancialProfileRecord,
	ForecastAssumptions,
	IncomeSource,
	InsurancePolicy,
	InsurancePolicyType,
	InsurancePolicyV2,
	PlanningNote,
	ProfileAccount,
	ProfileAsset,
	ProfileInvestment,
	ProfileLiability,
	TaxProfile,
	TaxProfileRecommendations,
};

// Local aliases matching the web app's naming convention
export type FinancialProfile = FinancialProfileRecord;
export type Account = ProfileAccount;
export type Asset = ProfileAsset;
export type Liability = ProfileLiability;
export type Investment = ProfileInvestment;
