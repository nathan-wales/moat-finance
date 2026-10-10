import { format } from "date-fns";
import { formatAmountInput, parseAmountInput } from "./utils";

export type SplitLegDraft = {
	key: string;
	id?: string;
	description: string;
	amount: string;
	category: string;
	hashtags: string[];
	notes: string;
	hidden: boolean;
	date: string;
};

export function toSplitLegDateValue(value: string | Date | undefined): string {
	const fallback = new Date();
	const date =
		value instanceof Date ? value : value ? new Date(value) : fallback;
	if (Number.isNaN(date.getTime())) {
		return format(fallback, "yyyy-MM-dd");
	}
	return format(date, "yyyy-MM-dd");
}

export function splitLegCalendarDate(value: string): Date | undefined {
	const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
	if (!match) return undefined;
	const date = new Date(
		Number(match[1]),
		Number(match[2]) - 1,
		Number(match[3]),
	);
	return Number.isNaN(date.getTime()) ? undefined : date;
}

export function createSplitLegDraft(
	overrides?: Partial<SplitLegDraft>,
): SplitLegDraft {
	return {
		key: overrides?.key ?? createSplitLegKey(),
		id: overrides?.id,
		description: overrides?.description ?? "",
		amount: overrides?.amount ?? "",
		category: overrides?.category ?? "",
		hashtags: overrides?.hashtags ?? [],
		notes: overrides?.notes ?? "",
		hidden: overrides?.hidden ?? false,
		date: toSplitLegDateValue(overrides?.date),
	};
}

export function createSplitLegKey() {
	return globalThis.crypto?.randomUUID?.() ?? `leg-${Date.now()}`;
}

export function splitRemainderCents(
	originalAmount: number,
	legs: SplitLegDraft[],
): number {
	const originalCents = Math.round(originalAmount * 100);
	const used = legs.reduce(
		(sum, leg) => sum + Math.round(parseAmountInput(leg.amount) * 100),
		0,
	);
	return originalCents - used;
}

export function formatSplitRemainder(cents: number): string {
	return formatAmountInput((cents / 100).toFixed(2));
}

export function isSplitDraftComplete(
	originalAmount: number,
	legs: SplitLegDraft[],
): boolean {
	if (legs.length < 2) return false;
	if (splitRemainderCents(originalAmount, legs) !== 0) return false;
	return legs.every(
		(leg) =>
			leg.description.trim().length > 0 &&
			leg.category.trim().length > 0 &&
			parseAmountInput(leg.amount) > 0,
	);
}
