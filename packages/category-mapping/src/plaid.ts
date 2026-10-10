/**
 * Plaid Personal Finance Category v2 → Moat category name.
 * Pure mapping — no DB or Plaid SDK dependency.
 */

export type PlaidPersonalFinanceCategory = {
	primary?: string | null;
	detailed?: string | null;
};

export type PlaidCategoryInput = {
	personal_finance_category?: PlaidPersonalFinanceCategory | null;
};

/**
 * Detailed-level overrides checked before the primary mapping.
 * Used when a specific Plaid sub-category maps to a different app category
 * than its parent primary would produce.
 */
export const PLAID_DETAILED_TO_APP_CATEGORY: Record<string, string> = {
	FOOD_AND_DRINK_GROCERIES: "Groceries",
	TRANSPORTATION_GAS: "Gas",
	LOAN_PAYMENTS_CAR_PAYMENT: "Auto & Transport",
	TRAVEL_FLIGHTS: "Flights",
	LOAN_PAYMENTS_MORTGAGE_PAYMENT: "Mortgage & Rent",
	LOAN_PAYMENTS_CREDIT_CARD_PAYMENT: "Credit card payment",
	GOVERNMENT_AND_NON_PROFIT_TAX_PAYMENT: "Taxes",
	GOVERNMENT_AND_NON_PROFIT_DONATIONS: "Gifts & Donations",
	INCOME_DIVIDENDS: "Investments",
	INCOME_INTEREST_EARNED: "Investments",
	INCOME_INTEREST_OTHER: "Investments",
	INCOME_CAPITAL_GAINS: "Investments",
	INCOME_LONG_TERM_CAPITAL_GAIN: "Investments",
	INCOME_SHORT_TERM_CAPITAL_GAIN: "Investments",
	PERSONAL_CARE_GYMS_AND_FITNESS_CENTERS: "Sports & Fitness",
	GENERAL_MERCHANDISE_CLOTHING_AND_ACCESSORIES: "Clothing",
	GENERAL_MERCHANDISE_PET_SUPPLIES: "Pets",
	MEDICAL_VETERINARY_SERVICES: "Pets",
};

/**
 * Maps every Plaid PFCv2 primary category to an app category name.
 * Detailed overrides above take precedence for specific sub-categories.
 */
export const PLAID_PRIMARY_TO_APP_CATEGORY: Record<string, string> = {
	INCOME: "Salary",
	FOOD_AND_DRINK: "Eating Out",
	ENTERTAINMENT: "Entertainment",
	TRANSPORTATION: "Auto & Transport",
	TRAVEL: "Travel",
	TRANSFER_IN: "Transfer",
	TRANSFER_OUT: "Transfer",
	LOAN_DISBURSEMENTS: "Loans",
	LOAN_PAYMENTS: "Loans",
	GENERAL_MERCHANDISE: "Shopping",
	HOME_IMPROVEMENT: "Home",
	MEDICAL: "Health & Medical",
	PERSONAL_CARE: "Health & Medical",
	GENERAL_SERVICES: "Business Services",
	GOVERNMENT_AND_NON_PROFIT: "Taxes",
	BANK_FEES: "Fees",
	RENT_AND_UTILITIES: "Bills & Utilities",
	OTHER: "Uncategorized",
};

export function mapPlaidCategory(tx: PlaidCategoryInput): string {
	const detailed = tx.personal_finance_category?.detailed;
	if (detailed && PLAID_DETAILED_TO_APP_CATEGORY[detailed]) {
		return PLAID_DETAILED_TO_APP_CATEGORY[detailed] as string;
	}

	const primary = tx.personal_finance_category?.primary;
	if (primary && PLAID_PRIMARY_TO_APP_CATEGORY[primary]) {
		return PLAID_PRIMARY_TO_APP_CATEGORY[primary] as string;
	}

	return "Uncategorized";
}
