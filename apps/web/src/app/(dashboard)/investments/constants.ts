export const INVESTMENT_TYPES = [
	{ value: "STOCKS", label: "Stocks" },
	{ value: "REAL_ESTATE", label: "Real Estate" },
	{ value: "ROTH_IRA", label: "Roth IRA" },
	{ value: "FOUR01K", label: "401(k)" },
	{ value: "HSA", label: "HSA" },
	{ value: "OTHER", label: "Other" },
] as const;

export type InvestmentTypeValue = (typeof INVESTMENT_TYPES)[number]["value"];
