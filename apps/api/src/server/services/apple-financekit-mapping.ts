export {
	type AppleFinanceKitCategoryMapping,
	type AppleFinanceKitMappingReason,
	mapAppleFinanceKitCategory,
	mapAppleFinanceKitCategoryDetailed,
} from "@moat/category-mapping";

export function parseAppleFinanceKitDate(value?: string | null): Date | null {
	if (!value) return null;
	const trimmed = value.trim();
	const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(trimmed)
		? `${trimmed}T00:00:00Z`
		: trimmed;
	const date = new Date(dateOnly);
	return Number.isNaN(date.getTime()) ? null : date;
}

export function buildAppleFinanceKitExternalTransactionId(
	providerTransactionId: string,
): string {
	return `APPLE_FINANCEKIT:${providerTransactionId}`;
}

export function mapAppleFinanceKitTransactionType(
	amount: number,
): "INCOME" | "EXPENSE" {
	return amount < 0 ? "INCOME" : "EXPENSE";
}
