/**
 * Critical pure mapping layer: Plaid transaction → Prisma DB input.
 *
 * This is the single source of truth for all Plaid-to-database field mapping.
 * No Plaid transaction data should be mapped anywhere else.
 *
 * Server-side only — never import from client code.
 */

import { mapPlaidCategory as mapPlaidCategoryName } from "@moat/category-mapping";
import { createTransactionDedupeFingerprint } from "@moat/financial-data-providers";
import type { Transaction as PlaidTransaction } from "plaid";
import { Prisma } from "../../../generated/prisma";
import type { PlaidAccountProviderContext } from "./provider-context";
import type { ExistingTransactionLike } from "./types";

// ─── Date helpers ──────────────────────────────────────────────────────────────

/**
 * Parses a Plaid date string (YYYY-MM-DD) into a Date.
 * Returns null for missing/invalid values rather than throwing.
 */
export function parsePlaidDate(value?: string | null): Date | null {
	if (!value) return null;
	// Plaid dates are YYYY-MM-DD — append T00:00:00Z to avoid local-timezone ambiguity
	const d = new Date(`${value}T00:00:00Z`);
	return Number.isNaN(d.getTime()) ? null : d;
}

// ─── Category mapping ──────────────────────────────────────────────────────────

export function mapPlaidCategory(tx: PlaidTransaction): string {
	return mapPlaidCategoryName(tx);
}

// ─── Transaction type mapping ─────────────────────────────────────────────────

/**
 * Maps Plaid amount sign convention to app TransactionType.
 *
 * Plaid convention (documented):
 *   positive amount = money leaving the account (debit / expense)
 *   negative amount = money entering the account (credit / income)
 *
 * This rule is explicit and must not silently change.
 * Pending transactions may flip sign when posted — callers must handle that.
 */
export function mapPlaidTransactionType(
	tx: PlaidTransaction,
): "INCOME" | "EXPENSE" {
	// Plaid positive = debit/expense, negative = credit/income
	return tx.amount < 0 ? "INCOME" : "EXPENSE";
}

// ─── Location mapping ─────────────────────────────────────────────────────────

export type PlaidLocationFields = {
	address: string | null;
	city: string | null;
	region: string | null;
	postal_code: string | null;
	country: string | null;
	lat: number | null;
	lon: number | null;
	store_number: string | null;
};

function normalizeOptionalString(value: unknown): string | null {
	if (typeof value !== "string") return null;
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : null;
}

function normalizeOptionalNumber(value: unknown): number | null {
	if (typeof value !== "number" || !Number.isFinite(value)) return null;
	return value;
}

/**
 * Maps Plaid `location` to a persisted JSON object.
 * Returns null when Plaid omits location or every field is empty.
 */
export function mapPlaidLocation(
	location: PlaidTransaction["location"] | null | undefined,
): PlaidLocationFields | null {
	if (!location) return null;

	const mapped: PlaidLocationFields = {
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

/**
 * Maps a Plaid transaction payload to Prisma create/update input shapes.
 *
 * Returns both `create` and `update` objects for use in db.transaction.upsert().
 *
 * Field preservation rule (upsert updates):
 *   - Always update Plaid-native identity, date, money, and enrichment fields
 *   - Do NOT overwrite categoryId or category if the existing row has
 *     app-managed categorization (categoryId is set), to preserve user edits
 *   - Clear removedAt if transaction reappears after removal
 *
 * Date convention:
 *   - postedDate ← Plaid `date` (app canonical timeline date for Plaid rows)
 *   - date ← postedDate (backward-compat: legacy read paths use `date`)
 *   - authorizedDate ← Plaid `authorized_date` (kept distinct, do not conflate)
 */
export function mapPlaidTransactionToDbInput(params: {
	tx: PlaidTransaction;
	userId: string;
	plaidItemDbId: string;
	plaidAccountDbId: string | null;
	accountName?: string | null;
	existingTransaction?: ExistingTransactionLike | null;
	/**
	 * Map of lowercased Category.name → Category.id, scoped to the user
	 * (global + user-owned). Used to resolve the Plaid-derived category
	 * string into a real FK at import time so analytics queries that
	 * filter/join on categoryId always have data to work with.
	 */
	categoryNameToId: Map<string, string>;
	/**
	 * Fallback Category.id used when the Plaid-derived name has no
	 * matching seeded category. Always the Uncategorized id.
	 */
	uncategorizedCategoryId: string;
	providerContext?: {
		financialConnectionId: string;
		account: PlaidAccountProviderContext | null;
	};
}): {
	create: Prisma.TransactionUncheckedCreateInput;
	update: Prisma.TransactionUncheckedUpdateInput;
} {
	const {
		tx,
		userId,
		plaidItemDbId,
		plaidAccountDbId,
		accountName,
		existingTransaction,
		categoryNameToId,
		uncategorizedCategoryId,
		providerContext,
	} = params;

	// postedDate ← Plaid `date`; also written to legacy `date` field for compat
	const postedDate = parsePlaidDate(tx.date) ?? new Date();
	const authorizedDate = parsePlaidDate(tx.authorized_date ?? null);

	const type = mapPlaidTransactionType(tx);
	// Absolute value: app stores positive amounts with type=INCOME|EXPENSE
	const amount = Math.abs(tx.amount).toFixed(2);

	// Category seed — only used on INSERT; do not overwrite user edits on UPDATE
	const categoryFromPlaid = mapPlaidCategory(tx);

	// Resolve the Plaid-derived category name to a real Category.id FK.
	// Falls back to Uncategorized when no exact match exists, so every
	// Plaid-imported row always has a non-null categoryId.
	const resolvedCategoryId =
		categoryNameToId.get(categoryFromPlaid.toLowerCase()) ??
		uncategorizedCategoryId;

	// Preserve user-managed categorization; Uncategorized remains remappable
	const hasUserCategory =
		!!existingTransaction?.categoryId &&
		existingTransaction.categoryId !== uncategorizedCategoryId;
	const isSplitTransaction = !!existingTransaction?.splitGroupId;

	const providerFields = buildProviderMetadataFields({
		tx,
		postedDate,
		providerContext,
	});
	const location = mapPlaidLocation(tx.location);

	const create: Prisma.TransactionUncheckedCreateInput = {
		userId,
		// postedDate is the app canonical timeline date for Plaid-imported rows
		postedDate,
		// Legacy compat: date = postedDate so existing read paths work unchanged
		date: postedDate,
		authorizedDate: authorizedDate ?? undefined,
		amount,
		isoCurrencyCode: tx.iso_currency_code ?? null,
		unofficialCurrencyCode: tx.unofficial_currency_code ?? null,
		type,
		// Seed category from Plaid; rules engine may overwrite afterward
		category: categoryFromPlaid,
		categoryId: resolvedCategoryId,
		// description ← Plaid `name` (primary display label)
		description: tx.name ?? null,
		// originalDescription and merchantName kept separate — do not collapse
		originalDescription: tx.original_description ?? null,
		merchantName: tx.merchant_name ?? null,
		paymentChannel: tx.payment_channel ?? null,
		source: "PLAID",
		externalTransactionId: tx.transaction_id,
		// pending_transaction_id is preserved independently (pending→posted linkage)
		pendingTransactionId: tx.pending_transaction_id ?? null,
		plaidAccountId: plaidAccountDbId,
		plaidItemId: plaidItemDbId,
		pending: tx.pending,
		removedAt: null,
		account: accountName ?? null,
		location: location ?? Prisma.DbNull,
		// Full raw Plaid payload preserved for debugging and future compat
		raw: tx as unknown as Prisma.InputJsonValue,
		...providerFields,
	};

	const update: Prisma.TransactionUncheckedUpdateInput = {
		// Always refresh Plaid-native fields
		postedDate,
		date: postedDate, // keep legacy compat
		authorizedDate: authorizedDate ?? null,
		...(isSplitTransaction ? {} : { amount }),
		isoCurrencyCode: tx.iso_currency_code ?? null,
		unofficialCurrencyCode: tx.unofficial_currency_code ?? null,
		type,
		description: tx.name ?? null,
		originalDescription: tx.original_description ?? null,
		merchantName: tx.merchant_name ?? null,
		paymentChannel: tx.payment_channel ?? null,
		pending: tx.pending,
		pendingTransactionId: tx.pending_transaction_id ?? null,
		plaidAccountId: plaidAccountDbId,
		removedAt: null, // clear removal flag if transaction reappears
		account: accountName ?? null,
		location: location ?? Prisma.DbNull,
		raw: tx as unknown as Prisma.InputJsonValue,
		// Preserve user-managed categorization — do not overwrite if app has set it
		...(hasUserCategory
			? {}
			: { category: categoryFromPlaid, categoryId: resolvedCategoryId }),
		...providerFields,
	};

	return { create, update };
}

function buildProviderMetadataFields(input: {
	tx: PlaidTransaction;
	postedDate: Date;
	providerContext?: {
		financialConnectionId: string;
		account: PlaidAccountProviderContext | null;
	};
}): Pick<
	Prisma.TransactionUncheckedCreateInput,
	| "financialConnectionId"
	| "financialAccountId"
	| "dataProvider"
	| "providerAccountId"
	| "providerTransactionId"
	| "accountFingerprint"
	| "dedupeFingerprint"
	| "rawProviderPayload"
> {
	const { tx, postedDate, providerContext } = input;
	if (!providerContext) return {};

	const account = providerContext.account;
	const accountFingerprint = account?.accountFingerprint ?? null;

	return {
		financialConnectionId: providerContext.financialConnectionId,
		financialAccountId: account?.financialAccountId ?? null,
		dataProvider: "PLAID",
		providerAccountId: account?.providerAccountId ?? tx.account_id,
		providerTransactionId: tx.transaction_id,
		accountFingerprint,
		dedupeFingerprint: createTransactionDedupeFingerprint({
			accountFingerprint,
			amount: Math.abs(tx.amount),
			date: postedDate,
			merchantName: tx.merchant_name ?? null,
			description: tx.name ?? null,
			pending: tx.pending,
		}),
		rawProviderPayload: tx as unknown as Prisma.InputJsonValue,
	};
}
