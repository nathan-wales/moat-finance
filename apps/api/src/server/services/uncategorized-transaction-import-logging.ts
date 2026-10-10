import type { Transaction as PlaidTransaction } from "plaid";
import { logger } from "~/lib/logger";
import { buildAppleAvailableCategorySignalNames } from "./apple-financekit-import-signal-logging";
import type { AppleFinanceKitMappingReason } from "./apple-financekit-mapping";
import { normalizeMcc } from "./apple-financekit-mcc-mapping";

export const UNCATEGORIZED_TRANSACTION_IMPORT_TAG =
	"uncategorized_transaction_import" as const;

type ImportKind = "added" | "modified" | "updated";

type PlaidMappingReason =
	| "no_pfc"
	| "primary_other"
	| "unknown_pfc"
	| "fk_fallback";

function getPlaidMappingReason(tx: PlaidTransaction): PlaidMappingReason {
	const pfc = tx.personal_finance_category;
	if (!pfc?.primary && !pfc?.detailed) {
		return "no_pfc";
	}

	if (pfc.primary === "OTHER") {
		return "primary_other";
	}

	return "unknown_pfc";
}

function buildPlaidProviderCategoryContext(tx: PlaidTransaction) {
	const legacyCategory = Array.isArray(tx.category) ? tx.category : null;

	return {
		pfcPrimary: tx.personal_finance_category?.primary ?? null,
		pfcDetailed: tx.personal_finance_category?.detailed ?? null,
		pfcConfidenceLevel: tx.personal_finance_category?.confidence_level ?? null,
		legacyCategory,
		legacyCategoryId: tx.category_id ?? null,
		isoCurrencyCode: tx.iso_currency_code ?? null,
		unofficialCurrencyCode: tx.unofficial_currency_code ?? null,
		paymentChannel: tx.payment_channel ?? null,
		pending: tx.pending ?? null,
	};
}

function shouldLogUncategorizedImport(input: {
	mappedCategory: string;
	resolvedCategoryId: string;
	uncategorizedCategoryId: string;
	preservesExistingCategory: boolean;
}): boolean {
	if (input.preservesExistingCategory) {
		return false;
	}

	return (
		input.mappedCategory === "Uncategorized" ||
		input.resolvedCategoryId === input.uncategorizedCategoryId
	);
}

export function logUncategorizedPlaidTransactionImport(input: {
	userId: string;
	plaidTx: PlaidTransaction;
	mappedCategory: string;
	resolvedCategoryId: string;
	uncategorizedCategoryId: string;
	importKind: ImportKind;
	preservesExistingCategory: boolean;
}): void {
	if (
		!shouldLogUncategorizedImport({
			mappedCategory: input.mappedCategory,
			resolvedCategoryId: input.resolvedCategoryId,
			uncategorizedCategoryId: input.uncategorizedCategoryId,
			preservesExistingCategory: input.preservesExistingCategory,
		})
	) {
		return;
	}

	const mappingReason =
		input.mappedCategory === "Uncategorized"
			? getPlaidMappingReason(input.plaidTx)
			: "fk_fallback";

	void logger.info("Uncategorized transaction imported from provider", {
		event: UNCATEGORIZED_TRANSACTION_IMPORT_TAG,
		tag: UNCATEGORIZED_TRANSACTION_IMPORT_TAG,
		feature: "plaid",
		operation: "syncTransactions",
		userId: input.userId,
		source: "PLAID",
		importKind: input.importKind,
		mappingReason,
		mappedCategory: input.mappedCategory,
		categoryIdFallback:
			input.resolvedCategoryId === input.uncategorizedCategoryId,
		providerTransactionIdPrefix: input.plaidTx.transaction_id.slice(0, 8),
		...buildPlaidProviderCategoryContext(input.plaidTx),
	});
}

export function logUncategorizedAppleFinanceKitTransactionImport(input: {
	userId: string;
	transaction: {
		externalTransactionId: string;
		rawCategory?: string | null;
		category?: string | null;
		currency: string;
		pending: boolean;
		merchantName?: string | null;
		description?: string | null;
		transactionType?: string | null;
		foreignCurrencyCode?: string | null;
		creditDebitIndicator?: string | null;
	};
	mappedCategory: string;
	mappingReason: AppleFinanceKitMappingReason | string;
	resolvedCategoryId: string;
	uncategorizedCategoryId: string;
	importKind: ImportKind;
	preservesExistingCategory: boolean;
	accountCurrency?: string | null;
}): void {
	if (
		!shouldLogUncategorizedImport({
			mappedCategory: input.mappedCategory,
			resolvedCategoryId: input.resolvedCategoryId,
			uncategorizedCategoryId: input.uncategorizedCategoryId,
			preservesExistingCategory: input.preservesExistingCategory,
		})
	) {
		return;
	}

	const mappingReason =
		input.mappedCategory === "Uncategorized"
			? input.mappingReason
			: "fk_fallback";

	const merchantCategoryCode = normalizeMcc(
		input.transaction.rawCategory ?? input.transaction.category ?? null,
	);
	const transactionType = input.transaction.transactionType?.trim() || null;
	const foreignCurrencyCode =
		input.transaction.foreignCurrencyCode?.trim() || null;
	const accountCurrencyCode = input.accountCurrency?.trim() || null;
	const originalCurrencyCode = input.transaction.currency.trim() || null;

	void logger.info("Uncategorized transaction imported from provider", {
		event: UNCATEGORIZED_TRANSACTION_IMPORT_TAG,
		tag: UNCATEGORIZED_TRANSACTION_IMPORT_TAG,
		feature: "apple-financekit",
		operation: "bulkImportTransactions",
		userId: input.userId,
		source: "APPLE_FINANCEKIT",
		importKind: input.importKind,
		mappingReason,
		mappedCategory: input.mappedCategory,
		categoryIdFallback:
			input.resolvedCategoryId === input.uncategorizedCategoryId,
		providerTransactionIdPrefix: input.transaction.externalTransactionId.slice(
			0,
			8,
		),
		hasMerchantCategoryCode: !!merchantCategoryCode,
		merchantCategoryCode,
		hasTransactionType: !!transactionType,
		transactionType,
		hasMerchantName: !!input.transaction.merchantName?.trim(),
		hasDescription: !!input.transaction.description?.trim(),
		hasOriginalCurrency: !!originalCurrencyCode,
		originalCurrencyCode,
		hasForeignCurrency: !!foreignCurrencyCode,
		foreignCurrencyCode,
		hasAccountCurrency: !!accountCurrencyCode,
		accountCurrencyCode,
		creditDebitIndicator:
			input.transaction.creditDebitIndicator?.trim() || null,
		availableCategorySignalNames: buildAppleAvailableCategorySignalNames({
			rawCategory: input.transaction.rawCategory,
			category: input.transaction.category,
			transactionType: input.transaction.transactionType,
			foreignCurrencyCode: input.transaction.foreignCurrencyCode,
			creditDebitIndicator: input.transaction.creditDebitIndicator,
			currency: input.transaction.currency,
		}),
		rawCategory: input.transaction.rawCategory ?? null,
		category: input.transaction.category ?? null,
		isoCurrencyCode: input.transaction.currency,
		pending: input.transaction.pending,
	});
}
