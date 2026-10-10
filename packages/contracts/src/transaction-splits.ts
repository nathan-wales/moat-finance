import { z } from "zod";

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseSplitLegDateInput(value: unknown): Date | undefined {
	if (value == null || value === "") return undefined;
	if (value instanceof Date) {
		return Number.isNaN(value.getTime()) ? undefined : value;
	}
	if (typeof value !== "string") return undefined;
	const trimmed = value.trim();
	const dateOnly = DATE_ONLY_PATTERN.exec(trimmed);
	if (dateOnly) {
		return new Date(
			Date.UTC(
				Number(dateOnly[1]),
				Number(dateOnly[2]) - 1,
				Number(dateOnly[3]),
				12,
				0,
				0,
			),
		);
	}
	const parsed = new Date(trimmed);
	return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function toDate(value: Date | string): Date {
	return value instanceof Date ? value : new Date(value);
}

export function resolveSplitLegTimelineDates(
	parent: { date: Date | string; postedDate: Date | string | null },
	legDate: Date | string | undefined,
): { date: Date; postedDate: Date | null } {
	const parentDate = toDate(parent.date);
	const parentPostedDate =
		parent.postedDate == null ? null : toDate(parent.postedDate);
	const parsedLegDate = parseSplitLegDateInput(legDate);

	if (!parsedLegDate) {
		return { date: parentDate, postedDate: parentPostedDate };
	}
	if (parentPostedDate) {
		return { date: parsedLegDate, postedDate: parsedLegDate };
	}
	return { date: parsedLegDate, postedDate: null };
}

export const SplitLegInputSchema = z.object({
	id: z.string().optional(),
	description: z.string().min(1),
	amount: z.number().positive(),
	categoryName: z.string().min(1),
	hashtags: z.array(z.string()).default([]),
	notes: z.string().max(2000).nullable().optional(),
	hidden: z.boolean().optional(),
	date: z.string().min(1).optional(),
});

export const SplitTransactionInputSchema = z.object({
	id: z.string(),
	type: z.enum(["INCOME", "EXPENSE"]),
	legs: z.array(SplitLegInputSchema).min(2),
});

export const LegacySplitTransactionInputSchema = z.object({
	id: z.string(),
	description: z.string().optional(),
	originalAmount: z.number().positive(),
	splitAmount: z.number().positive(),
	type: z.enum(["INCOME", "EXPENSE"]),
	originalCategoryName: z.string().min(1),
	splitCategoryName: z.string().min(1),
	hashtags: z.array(z.string()).default([]),
});

export const GetSplitGroupInputSchema = z.object({
	id: z.string(),
});

export type SplitLegInput = z.infer<typeof SplitLegInputSchema>;
export type SplitTransactionInput = z.infer<typeof SplitTransactionInputSchema>;

export function parseSplitTransactionInput(
	body: unknown,
): SplitTransactionInput {
	if (body && typeof body === "object" && "legs" in body) {
		return SplitTransactionInputSchema.parse(body);
	}
	const legacy = LegacySplitTransactionInputSchema.parse(body);
	const description = legacy.description?.trim() || "Split";
	return {
		id: legacy.id,
		type: legacy.type,
		legs: [
			{
				description,
				amount: legacy.originalAmount,
				categoryName: legacy.originalCategoryName,
				hashtags: legacy.hashtags,
			},
			{
				description,
				amount: legacy.splitAmount,
				categoryName: legacy.splitCategoryName,
				hashtags: legacy.hashtags,
			},
		],
	};
}
