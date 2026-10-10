import { categoryFromMerchantCategoryCode, normalizeMcc } from "./apple-mcc";

const APPLE_CATEGORY_TO_APP_CATEGORY: Record<string, string> = {
	RESTAURANTS: "Eating Out",
	FOOD_AND_DRINK: "Eating Out",
	GROCERIES: "Groceries",
	GAS: "Gas",
	TRANSPORTATION: "Auto & Transport",
	TRAVEL: "Travel",
	ENTERTAINMENT: "Entertainment",
	SHOPPING: "Shopping",
	GENERAL_MERCHANDISE: "Shopping",
	UTILITIES: "Bills & Utilities",
	RENT: "Mortgage & Rent",
	HEALTH: "Health & Medical",
	MEDICAL: "Health & Medical",
	EDUCATION: "Education",
	PERSONAL_CARE: "Health & Medical",
	FEES: "Fees",
	TAXES: "Taxes",
	INCOME: "Salary",
	TRANSFER: "Transfer",
	PAYMENT: "Credit card payment",
	OTHER: "Uncategorized",
};

export type AppleFinanceKitMappingReason =
	| "mapped_from_mcc"
	| "mapped_from_provider_category"
	| "mapped_from_transaction_type"
	| "no_provider_category"
	| "no_provider_category_signal"
	| "unsupported_transaction_type"
	| "unknown_mcc"
	| "invalid_mcc"
	| "unknown_named_category"
	| "primary_other"
	| "fk_fallback";

export type AppleFinanceKitCategoryMapping = {
	category: string;
	mappingReason: AppleFinanceKitMappingReason;
};

const MAPPABLE_TRANSACTION_TYPES = new Set([
	"fee",
	"atm",
	"transfer",
	"billpayment",
	"interest",
	"dividend",
	"deposit",
	"directdeposit",
	"withdrawal",
	"loan",
]);

function normalizeTransactionType(
	transactionType?: string | null,
): string | null {
	if (!transactionType?.trim()) return null;
	return transactionType
		.trim()
		.toLowerCase()
		.replace(/[\s_-]+/g, "");
}

function isCreditDirection(input: {
	creditDebitIndicator?: string | null;
	amount?: number | null;
}): boolean {
	const indicator = input.creditDebitIndicator?.trim().toLowerCase();
	if (indicator === "credit") return true;
	if (indicator === "debit") return false;
	if (typeof input.amount === "number") {
		return input.amount < 0;
	}
	return false;
}

function categoryFromTransactionType(input: {
	transactionType?: string | null;
	creditDebitIndicator?: string | null;
	amount?: number | null;
}): string | null {
	const type = normalizeTransactionType(input.transactionType);
	if (!type) return null;

	switch (type) {
		case "fee":
		case "atm":
			return "Fees";
		case "transfer":
		case "deposit":
		case "withdrawal":
			return "Transfer";
		case "directdeposit":
			return isCreditDirection(input) ? "Salary" : "Transfer";
		case "billpayment":
			return "Bills & Utilities";
		case "dividend":
			return "Investments";
		case "loan":
			return "Loans";
		case "interest":
			return isCreditDirection(input) ? "Salary" : "Fees";
		default:
			return null;
	}
}

function resolveProviderCategory(providerCategory: string): {
	category: string;
	mappingReason: AppleFinanceKitMappingReason;
} {
	const trimmed = providerCategory.trim();

	if (/^\d+$/.test(trimmed)) {
		const normalized = normalizeMcc(trimmed);
		if (!normalized) {
			return { category: "Uncategorized", mappingReason: "invalid_mcc" };
		}

		const fromMcc = categoryFromMerchantCategoryCode(normalized);
		if (fromMcc !== "Uncategorized") {
			return { category: fromMcc, mappingReason: "mapped_from_mcc" };
		}

		return { category: "Uncategorized", mappingReason: "unknown_mcc" };
	}

	const normalized = trimmed.toUpperCase().replace(/\s+/g, "_");
	if (normalized === "OTHER") {
		return { category: "Uncategorized", mappingReason: "primary_other" };
	}

	const fromNamed = APPLE_CATEGORY_TO_APP_CATEGORY[normalized];
	if (fromNamed && fromNamed !== "Uncategorized") {
		return {
			category: fromNamed,
			mappingReason: "mapped_from_provider_category",
		};
	}

	if (fromNamed === "Uncategorized") {
		return { category: "Uncategorized", mappingReason: "primary_other" };
	}

	return {
		category: "Uncategorized",
		mappingReason: "unknown_named_category",
	};
}

export function mapAppleFinanceKitCategoryDetailed(input: {
	rawCategory?: string | null;
	category?: string | null;
	transactionType?: string | null;
	creditDebitIndicator?: string | null;
	amount?: number | null;
}): AppleFinanceKitCategoryMapping {
	const providerCategory = input.rawCategory ?? input.category ?? null;

	if (providerCategory?.trim()) {
		const resolved = resolveProviderCategory(providerCategory);
		if (resolved.category !== "Uncategorized") {
			return resolved;
		}

		const fromType = categoryFromTransactionType(input);
		if (fromType) {
			return {
				category: fromType,
				mappingReason: "mapped_from_transaction_type",
			};
		}

		return resolved;
	}

	const fromType = categoryFromTransactionType(input);
	if (fromType) {
		return {
			category: fromType,
			mappingReason: "mapped_from_transaction_type",
		};
	}

	const normalizedType = normalizeTransactionType(input.transactionType);
	if (normalizedType && !MAPPABLE_TRANSACTION_TYPES.has(normalizedType)) {
		return {
			category: "Uncategorized",
			mappingReason: "unsupported_transaction_type",
		};
	}

	if (normalizedType) {
		return {
			category: "Uncategorized",
			mappingReason: "no_provider_category_signal",
		};
	}

	return {
		category: "Uncategorized",
		mappingReason: "no_provider_category",
	};
}

export function mapAppleFinanceKitCategory(
	rawCategory?: string | null,
): string {
	return mapAppleFinanceKitCategoryDetailed({ rawCategory }).category;
}
