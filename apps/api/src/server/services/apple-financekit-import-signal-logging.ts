import { logger } from "~/lib/logger";
import type { AppleFinanceKitMappingReason } from "./apple-financekit-mapping";
import { normalizeMcc } from "./apple-financekit-mcc-mapping";

export const APPLE_FINANCEKIT_IMPORT_SIGNAL_SUMMARY_EVENT =
	"apple_financekit_import_signal_summary" as const;

const MAX_DISTINCT_MCC_COUNTS = 50;

export type AppleFinanceKitSignalTransaction = {
	rawCategory?: string | null;
	category?: string | null;
	transactionType?: string | null;
	foreignCurrencyCode?: string | null;
	creditDebitIndicator?: string | null;
	currency: string;
	merchantName?: string | null;
	description: string;
	pending: boolean;
};

export type AppleFinanceKitImportSignalAccumulator = {
	totalTransactions: number;
	withMerchantCategoryCode: number;
	withoutMerchantCategoryCode: number;
	withTransactionType: number;
	withoutTransactionType: number;
	transactionTypeUnknown: number;
	withMerchantName: number;
	withoutMerchantName: number;
	withDescription: number;
	withoutDescription: number;
	withForeignCurrency: number;
	withoutForeignCurrency: number;
	withAccountCurrency: number;
	withoutAccountCurrency: number;
	withAnyProviderCategorySignal: number;
	withoutAnyProviderCategorySignal: number;
	mappedToInternalCategory: number;
	mappedToUncategorized: number;
	mappingReasonCounts: Record<string, number>;
	transactionTypeCounts: Record<string, number>;
	merchantCategoryCodeCounts: Record<string, number>;
	currencyCodeCounts: Record<string, number>;
};

function incrementCount(counts: Record<string, number>, key: string): void {
	counts[key] = (counts[key] ?? 0) + 1;
}

function hasMeaningfulDescription(description: string): boolean {
	return description.trim().length > 0;
}

function hasAnyProviderCategorySignal(input: {
	hasMcc: boolean;
	providerCategory?: string | null;
	transactionType?: string | null;
}): boolean {
	return (
		input.hasMcc ||
		!!input.providerCategory?.trim() ||
		!!input.transactionType?.trim()
	);
}

export function createAppleFinanceKitImportSignalAccumulator(): AppleFinanceKitImportSignalAccumulator {
	return {
		totalTransactions: 0,
		withMerchantCategoryCode: 0,
		withoutMerchantCategoryCode: 0,
		withTransactionType: 0,
		withoutTransactionType: 0,
		transactionTypeUnknown: 0,
		withMerchantName: 0,
		withoutMerchantName: 0,
		withDescription: 0,
		withoutDescription: 0,
		withForeignCurrency: 0,
		withoutForeignCurrency: 0,
		withAccountCurrency: 0,
		withoutAccountCurrency: 0,
		withAnyProviderCategorySignal: 0,
		withoutAnyProviderCategorySignal: 0,
		mappedToInternalCategory: 0,
		mappedToUncategorized: 0,
		mappingReasonCounts: {},
		transactionTypeCounts: {},
		merchantCategoryCodeCounts: {},
		currencyCodeCounts: {},
	};
}

export function recordAppleFinanceKitImportSignal(input: {
	accumulator: AppleFinanceKitImportSignalAccumulator;
	transaction: AppleFinanceKitSignalTransaction;
	mappedCategory: string;
	mappingReason: AppleFinanceKitMappingReason | string;
	accountCurrency?: string | null;
}): void {
	const { accumulator, transaction } = input;
	accumulator.totalTransactions += 1;

	const normalizedMcc = normalizeMcc(
		transaction.rawCategory ?? transaction.category ?? null,
	);
	const hasMcc = !!normalizedMcc;
	if (hasMcc) {
		accumulator.withMerchantCategoryCode += 1;
		if (normalizedMcc) {
			incrementCount(accumulator.merchantCategoryCodeCounts, normalizedMcc);
		}
	} else {
		accumulator.withoutMerchantCategoryCode += 1;
	}

	const transactionType = transaction.transactionType?.trim() || null;
	if (transactionType) {
		accumulator.withTransactionType += 1;
		incrementCount(accumulator.transactionTypeCounts, transactionType);
		if (transactionType.toLowerCase() === "unknown") {
			accumulator.transactionTypeUnknown += 1;
		}
	} else {
		accumulator.withoutTransactionType += 1;
	}

	if (transaction.merchantName?.trim()) {
		accumulator.withMerchantName += 1;
	} else {
		accumulator.withoutMerchantName += 1;
	}

	if (hasMeaningfulDescription(transaction.description)) {
		accumulator.withDescription += 1;
	} else {
		accumulator.withoutDescription += 1;
	}

	if (transaction.foreignCurrencyCode?.trim()) {
		accumulator.withForeignCurrency += 1;
	} else {
		accumulator.withoutForeignCurrency += 1;
	}

	const accountCurrency = input.accountCurrency?.trim() || null;
	if (accountCurrency) {
		accumulator.withAccountCurrency += 1;
	} else {
		accumulator.withoutAccountCurrency += 1;
	}

	const providerCategory =
		transaction.rawCategory ?? transaction.category ?? null;
	if (
		hasAnyProviderCategorySignal({ hasMcc, providerCategory, transactionType })
	) {
		accumulator.withAnyProviderCategorySignal += 1;
	} else {
		accumulator.withoutAnyProviderCategorySignal += 1;
	}

	if (input.mappedCategory === "Uncategorized") {
		accumulator.mappedToUncategorized += 1;
	} else {
		accumulator.mappedToInternalCategory += 1;
	}

	incrementCount(accumulator.mappingReasonCounts, input.mappingReason);

	const currency = transaction.currency.trim();
	if (currency) {
		incrementCount(accumulator.currencyCodeCounts, currency);
	}
}

function capCountRecord(
	counts: Record<string, number>,
	maxKeys: number,
): Record<string, number> {
	const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
	if (entries.length <= maxKeys) {
		return counts;
	}

	const capped: Record<string, number> = {};
	for (const [key, value] of entries.slice(0, maxKeys)) {
		capped[key] = value;
	}
	return capped;
}

export function logAppleFinanceKitImportSignalSummary(input: {
	userId: string;
	externalAccountIdPrefix: string;
	accountCurrency?: string | null;
	accumulator: AppleFinanceKitImportSignalAccumulator;
}): void {
	const { accumulator } = input;

	void logger.info("Apple FinanceKit import signal summary", {
		event: APPLE_FINANCEKIT_IMPORT_SIGNAL_SUMMARY_EVENT,
		tag: APPLE_FINANCEKIT_IMPORT_SIGNAL_SUMMARY_EVENT,
		feature: "apple-financekit",
		operation: "bulkImportTransactions",
		userId: input.userId,
		source: "APPLE_FINANCEKIT",
		externalAccountIdPrefix: input.externalAccountIdPrefix.slice(0, 8),
		accountCurrencyCode: input.accountCurrency?.trim() || null,
		totalTransactions: accumulator.totalTransactions,
		withMerchantCategoryCode: accumulator.withMerchantCategoryCode,
		withoutMerchantCategoryCode: accumulator.withoutMerchantCategoryCode,
		withTransactionType: accumulator.withTransactionType,
		withoutTransactionType: accumulator.withoutTransactionType,
		transactionTypeUnknown: accumulator.transactionTypeUnknown,
		withMerchantName: accumulator.withMerchantName,
		withoutMerchantName: accumulator.withoutMerchantName,
		withDescription: accumulator.withDescription,
		withoutDescription: accumulator.withoutDescription,
		withForeignCurrency: accumulator.withForeignCurrency,
		withoutForeignCurrency: accumulator.withoutForeignCurrency,
		withAccountCurrency: accumulator.withAccountCurrency,
		withoutAccountCurrency: accumulator.withoutAccountCurrency,
		withAnyProviderCategorySignal: accumulator.withAnyProviderCategorySignal,
		withoutAnyProviderCategorySignal:
			accumulator.withoutAnyProviderCategorySignal,
		mappedToInternalCategory: accumulator.mappedToInternalCategory,
		mappedToUncategorized: accumulator.mappedToUncategorized,
		mappingReasonCounts: accumulator.mappingReasonCounts,
		transactionTypeCounts: accumulator.transactionTypeCounts,
		merchantCategoryCodeCounts: capCountRecord(
			accumulator.merchantCategoryCodeCounts,
			MAX_DISTINCT_MCC_COUNTS,
		),
		currencyCodeCounts: accumulator.currencyCodeCounts,
	});
}

export function buildAppleAvailableCategorySignalNames(input: {
	rawCategory?: string | null;
	category?: string | null;
	transactionType?: string | null;
	foreignCurrencyCode?: string | null;
	creditDebitIndicator?: string | null;
	currency?: string | null;
}): string[] {
	const names: string[] = [];

	if (normalizeMcc(input.rawCategory ?? input.category ?? null)) {
		names.push("merchantCategoryCode");
	} else if (input.rawCategory?.trim() || input.category?.trim()) {
		names.push("providerCategory");
	}

	if (input.transactionType?.trim()) {
		names.push("transactionType");
	}

	if (input.creditDebitIndicator?.trim()) {
		names.push("creditDebitIndicator");
	}

	if (input.currency?.trim()) {
		names.push("currencyCode");
	}

	if (input.foreignCurrencyCode?.trim()) {
		names.push("foreignCurrencyCode");
	}

	return names;
}
