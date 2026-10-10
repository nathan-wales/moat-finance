/**
 * Shared local types for the Plaid integration layer.
 * Server-side only — never import from client code.
 */
import type { PrismaClient } from "../../../generated/prisma";

// ─── DB Injection ─────────────────────────────────────────────────────────────

/**
 * Minimal PrismaClient interface for dependency injection into sync functions.
 * Accepts both the full PrismaClient and transactional clients from db.$transaction().
 */
export type PrismaClientLike = Omit<
	PrismaClient,
	"$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

// ─── Sync Inputs ─────────────────────────────────────────────────────────────

export interface SyncTransactionsForItemInput {
	db: PrismaClientLike;
	userId: string;
	plaidItemDbId: string;
}

export interface SyncAccountsForItemInput {
	db: PrismaClientLike;
	userId: string;
	plaidItemDbId: string;
	accessToken: string;
}

// ─── Mapping ──────────────────────────────────────────────────────────────────

/**
 * Minimal shape of an existing Transaction row needed by the mapping layer
 * to determine whether to preserve user-managed categorization.
 */
export interface ExistingTransactionLike {
	categoryId: string | null;
	category: string;
	splitGroupId: string | null;
}

// ─── Webhook ──────────────────────────────────────────────────────────────────

export interface PlaidWebhookPayload {
	webhook_type: string;
	webhook_code: string;
	item_id: string;
}
