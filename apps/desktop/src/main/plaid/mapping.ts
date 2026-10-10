/**
 * Plaid transaction → SQLite DB input mapping.
 * Adapted from apps/api/src/server/plaid/mapping.ts for the local SQLite schema.
 *
 * Key differences from the API version:
 *   - amount is stored as Float (number), not Decimal string
 *   - raw JSON stored as string (TEXT), not Prisma JsonValue
 *   - Split parents keep their original amount on Plaid updates
 *   - categoryId FK resolved at import time (same as API)
 *
 * Main-process only — never import from the renderer.
 */
import { randomUUID } from "node:crypto";
import { mapPlaidCategory as mapPlaidCategoryName } from "@moat/category-mapping";
import type { Transaction as PlaidTransaction } from "plaid";

// ─── Date helpers ──────────────────────────────────────────────────────────────

export function parsePlaidDate(value?: string | null): Date | null {
	if (!value) return null;
	const d = new Date(`${value}T00:00:00Z`);
	return Number.isNaN(d.getTime()) ? null : d;
}

// ─── Category mapping ──────────────────────────────────────────────────────────

export function mapPlaidCategory(tx: PlaidTransaction): string {
	return mapPlaidCategoryName(tx);
}

// ─── Transaction type ─────────────────────────────────────────────────────────

export function mapPlaidTransactionType(
	tx: PlaidTransaction,
): "INCOME" | "EXPENSE" {
	return tx.amount < 0 ? "INCOME" : "EXPENSE";
}

// ─── Minimal shape needed to preserve user-managed categorization ──────────────

export interface ExistingTransactionLike {
	categoryId: string | null;
	splitGroupId?: string | null;
}

// ─── DB input shapes ──────────────────────────────────────────────────────────

export type SqlitePlaidLocation = {
	address: string | null;
	city: string | null;
	region: string | null;
	postal_code: string | null;
	country: string | null;
	lat: number | null;
	lon: number | null;
	store_number: string | null;
};

export interface SqlitePlaidTransactionCreate {
	id: string;
	userId: string;
	accountId: null;
	categoryId: string;
	date: Date;
	postedDate: Date;
	amount: number;
	merchantName: string | null;
	description: string | null;
	originalDescription: string | null;
	type: string;
	pending: boolean;
	hidden: boolean;
	source: string;
	removedAt: null;
	externalTransactionId: string;
	plaidAccountId: string | null;
	plaidItemId: string;
	pendingTransactionId: string | null;
	raw: string;
	location: string | null;
}

export interface SqlitePlaidTransactionUpdate {
	postedDate: Date;
	date: Date;
	amount?: number;
	merchantName: string | null;
	description: string | null;
	originalDescription: string | null;
	type: string;
	pending: boolean;
	pendingTransactionId: string | null;
	plaidAccountId: string | null;
	removedAt: null;
	raw: string;
	location: string | null;
	categoryId?: string;
}

function normalizeOptionalString(value: unknown): string | null {
	if (typeof value !== "string") return null;
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : null;
}

function normalizeOptionalNumber(value: unknown): number | null {
	if (typeof value !== "number" || !Number.isFinite(value)) return null;
	return value;
}

export function mapPlaidLocation(
	location: PlaidTransaction["location"] | null | undefined,
): SqlitePlaidLocation | null {
	if (!location) return null;

	const mapped: SqlitePlaidLocation = {
		address: normalizeOptionalString(location.address),
		city: normalizeOptionalString(location.city),
		region: normalizeOptionalString(location.region),
		postal_code: normalizeOptionalString(location.postal_code),
		country: normalizeOptionalString(location.country),
		lat: normalizeOptionalNumber(location.lat),
		lon: normalizeOptionalNumber(location.lon),
		store_number: normalizeOptionalString(location.store_number),
	};

	const hasValue = Object.values(mapped).some((value) => value !== null);
	return hasValue ? mapped : null;
}

// ─── Primary mapping function ─────────────────────────────────────────────────

export function mapPlaidTransactionToDbInput(params: {
	tx: PlaidTransaction;
	userId: string;
	plaidItemDbId: string;
	plaidAccountDbId: string | null;
	existingTransaction?: ExistingTransactionLike | null;
	categoryNameToId: Map<string, string>;
	uncategorizedCategoryId: string;
}): {
	create: SqlitePlaidTransactionCreate;
	update: SqlitePlaidTransactionUpdate;
} {
	const {
		tx,
		userId,
		plaidItemDbId,
		plaidAccountDbId,
		existingTransaction,
		categoryNameToId,
		uncategorizedCategoryId,
	} = params;

	const postedDate = parsePlaidDate(tx.date) ?? new Date();
	const type = mapPlaidTransactionType(tx);
	const amount = parseFloat(Math.abs(tx.amount).toFixed(2));
	const categoryFromPlaid = mapPlaidCategory(tx);
	const resolvedCategoryId =
		categoryNameToId.get(categoryFromPlaid.toLowerCase()) ??
		uncategorizedCategoryId;
	const hasUserCategory =
		!!existingTransaction?.categoryId &&
		existingTransaction.categoryId !== uncategorizedCategoryId;
	const isSplitTransaction = !!existingTransaction?.splitGroupId;
	const location = mapPlaidLocation(tx.location);
	const locationJson = location ? JSON.stringify(location) : null;

	const create: SqlitePlaidTransactionCreate = {
		id: randomUUID(),
		userId,
		accountId: null,
		categoryId: resolvedCategoryId,
		date: postedDate,
		postedDate,
		amount,
		merchantName: tx.merchant_name ?? null,
		description: tx.name ?? null,
		originalDescription: tx.original_description ?? null,
		type,
		pending: tx.pending,
		hidden: false,
		source: "PLAID",
		removedAt: null,
		externalTransactionId: tx.transaction_id,
		plaidAccountId: plaidAccountDbId,
		plaidItemId: plaidItemDbId,
		pendingTransactionId: tx.pending_transaction_id ?? null,
		raw: JSON.stringify(tx),
		location: locationJson,
	};

	const update: SqlitePlaidTransactionUpdate = {
		postedDate,
		date: postedDate,
		...(isSplitTransaction ? {} : { amount }),
		merchantName: tx.merchant_name ?? null,
		description: tx.name ?? null,
		originalDescription: tx.original_description ?? null,
		type,
		pending: tx.pending,
		pendingTransactionId: tx.pending_transaction_id ?? null,
		plaidAccountId: plaidAccountDbId,
		removedAt: null,
		raw: JSON.stringify(tx),
		location: locationJson,
		// Preserve user-managed categorization
		...(hasUserCategory ? {} : { categoryId: resolvedCategoryId }),
	};

	return { create, update };
}
