import type { DateRange } from "@moat/ui";
import { format } from "date-fns";

export function parseTransactionsDateParam(dateStr: string): Date {
	const [year = 0, month = 0, day = 0] = dateStr.split("-").map(Number);
	return new Date(year, month - 1, day);
}

export function isCompleteDateRange(
	range: DateRange | undefined,
): range is { from: Date; to: Date } {
	return Boolean(range?.from && range.to);
}

export function formatDateRangeQueryParams(
	range: DateRange | undefined,
): { from: string; to: string } | undefined {
	if (!isCompleteDateRange(range)) return undefined;
	return {
		from: format(range.from, "yyyy-MM-dd"),
		to: format(range.to, "yyyy-MM-dd"),
	};
}
