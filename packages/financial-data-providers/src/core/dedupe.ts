import { createHash } from "node:crypto";

function hashParts(
	parts: Array<string | number | boolean | null | undefined>,
): string {
	return createHash("sha256")
		.update(
			parts
				.map((part) =>
					part === null || part === undefined ? "" : String(part),
				)
				.join("|"),
		)
		.digest("hex");
}

function normalizeValue(value: string | null | undefined): string {
	return (value ?? "")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, " ")
		.replace(/\s+/g, " ")
		.trim();
}

export function createAccountFingerprint(input: {
	canonicalInstitutionId?: string | null;
	name: string;
	type: string;
	subtype?: string | null;
	mask?: string | null;
	currency?: string | null;
}): string {
	return hashParts([
		input.canonicalInstitutionId,
		normalizeValue(input.name),
		normalizeValue(input.type),
		normalizeValue(input.subtype),
		input.mask,
		input.currency ?? "USD",
	]);
}

export function createTransactionDedupeFingerprint(input: {
	accountFingerprint?: string | null;
	amount: number;
	date: string | Date;
	merchantName?: string | null;
	description?: string | null;
	pending?: boolean;
}): string {
	const dateValue =
		input.date instanceof Date
			? input.date.toISOString().slice(0, 10)
			: input.date;
	return hashParts([
		input.accountFingerprint,
		input.amount.toFixed(2),
		dateValue,
		normalizeValue(input.merchantName ?? input.description),
		input.pending ? "pending" : "posted",
	]);
}
