import { createHash } from "node:crypto";
import type { NormalizedImportRow, ParsedCsvRow } from "./types";

/**
 * Normalizes a parsed CSV row into a domain import row.
 * Returns null if the row cannot be parsed (invalid date or amount).
 */
export function normalizeTransaction(
	row: ParsedCsvRow,
): NormalizedImportRow | null {
	const date = parseDate(row.date);
	if (!date) return null;

	const rawAmount = parseAmount(row.amount);
	if (rawAmount === null) return null;

	const amount = Math.abs(rawAmount);

	// Determine type: explicit type field wins, then sign of amount
	let type: "INCOME" | "EXPENSE" = rawAmount < 0 ? "EXPENSE" : "INCOME";
	if (row.type) {
		const t = row.type.toLowerCase();
		if (t.includes("debit") || t.includes("expense") || t.includes("charge")) {
			type = "EXPENSE";
		} else if (
			t.includes("credit") ||
			t.includes("income") ||
			t.includes("deposit")
		) {
			type = "INCOME";
		}
	}

	const description = row.description?.trim() || "Imported transaction";
	const originalDescription = row.memo?.trim() || undefined;

	return {
		dedupKey: computeImportDedupKey({ date, amount, description }),
		date,
		amount,
		type,
		description,
		originalDescription,
		category: row.category?.trim() || undefined,
		account: row.account?.trim() || undefined,
	};
}

export function computeImportDedupKey(input: {
	date: Date;
	amount: number;
	description: string;
}): string {
	return createHash("sha256")
		.update(
			`${input.date.toISOString()}|${input.amount.toFixed(2)}|${input.description.toLowerCase()}`,
		)
		.digest("hex")
		.slice(0, 16);
}

export function importRowSignature(input: {
	date: Date;
	amount: number;
	description: string;
}): string {
	return `${input.date.toISOString().slice(0, 10)}|${input.amount.toFixed(2)}|${input.description.toLowerCase().slice(0, 40)}`;
}

export function parseImportDate(raw: Date | string): Date | null {
	if (raw instanceof Date) {
		return Number.isNaN(raw.getTime()) ? null : raw;
	}
	return parseDate(raw);
}

function parseDate(raw: string): Date | null {
	if (!raw) return null;

	// Try ISO format first
	const iso = new Date(raw);
	if (!Number.isNaN(iso.getTime())) return iso;

	// Try MM/DD/YYYY
	const mmddyyyy = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
	if (mmddyyyy) {
		const [, m, d, y] = mmddyyyy;
		return new Date(
			`${y}-${(m ?? "").padStart(2, "0")}-${(d ?? "").padStart(2, "0")}`,
		);
	}

	// Try DD/MM/YYYY
	const ddmmyyyy = raw.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
	if (ddmmyyyy) {
		const [, d, m, y] = ddmmyyyy;
		return new Date(
			`${y}-${(m ?? "").padStart(2, "0")}-${(d ?? "").padStart(2, "0")}`,
		);
	}

	return null;
}

function parseAmount(raw: string): number | null {
	if (!raw) return null;
	// Remove currency symbols, spaces, keep minus sign
	const cleaned = raw.replace(/[$£€,\s]/g, "").trim();
	const num = Number.parseFloat(cleaned);
	return Number.isNaN(num) ? null : num;
}
