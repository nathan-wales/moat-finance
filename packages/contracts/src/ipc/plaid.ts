import { z } from "zod";

export const PLAID_CHANNELS = {
	createLinkToken: "plaid:createLinkToken",
	exchangePublicToken: "plaid:exchangePublicToken",
	getConnectedItems: "plaid:getConnectedItems",
	getAccountHoldings: "plaid:getAccountHoldings",
	syncItem: "plaid:syncItem",
	syncAll: "plaid:syncAll",
	requestScheduledSync: "plaid:requestScheduledSync",
	createReconnectToken: "plaid:createReconnectToken",
	reconnectItem: "plaid:reconnectItem",
	disconnectItem: "plaid:disconnectItem",
	setAccountHidden: "plaid:setAccountHidden",
	setAccountSyncEnabled: "plaid:setAccountSyncEnabled",
	reorderItems: "plaid:reorderItems",
	syncProgress: "plaid:syncProgress",
} as const;

// ─── Input schemas ─────────────────────────────────────────────────────────────

export const ExchangePublicTokenInputSchema = z.object({
	publicToken: z.string(),
	institutionName: z.string().optional(),
	institutionId: z.string().optional(),
	accounts: z
		.array(
			z.object({
				id: z.string(),
				name: z.string(),
				mask: z.string().nullable().optional(),
				type: z.string(),
				subtype: z.string().nullable().optional(),
			}),
		)
		.optional(),
});

export const SyncItemInputSchema = z.object({
	itemId: z.string(),
	refreshBalances: z.boolean().optional(),
});

export const GetAccountHoldingsInputSchema = z.object({
	accountId: z.string(),
});

export const CreateReconnectTokenInputSchema = z.object({
	itemId: z.string(),
});

export const ReconnectItemInputSchema = z.object({
	itemId: z.string(),
	publicToken: z.string(),
});

export const DisconnectItemInputSchema = z.object({
	itemId: z.string(),
});

export const SetAccountHiddenInputSchema = z.object({
	plaidAccountId: z.string(),
	isHidden: z.boolean(),
});

export const SetAccountSyncEnabledInputSchema = z.object({
	accountId: z.string().min(1),
	syncEnabled: z.boolean(),
});

export const ReorderItemsInputSchema = z.object({
	orderedIds: z.array(z.string()),
});

// ─── Response types ────────────────────────────────────────────────────────────

const PlaidAccountShape = z.object({
	id: z.string(),
	plaidAccountId: z.string(),
	plaidItemId: z.string(),
	name: z.string(),
	officialName: z.string().nullable(),
	mask: z.string().nullable(),
	type: z.string(),
	subtype: z.string().nullable(),
	currentBalance: z.number().nullable(),
	availableBalance: z.number().nullable(),
	currency: z.string(),
	isActive: z.boolean(),
	isHidden: z.boolean(),
	syncEnabled: z.boolean().optional(),
});

const PlaidItemShape = z.object({
	id: z.string(),
	plaidItemId: z.string(),
	institutionId: z.string().nullable(),
	institutionName: z.string(),
	requiresReconnect: z.boolean(),
	lastErrorCode: z.string().nullable(),
	lastErrorMessage: z.string().nullable(),
	lastSyncAt: z.coerce.date().nullable(),
	lastSuccessfulSyncAt: z.coerce.date().nullable(),
	sortOrder: z.number(),
	accounts: z.array(PlaidAccountShape),
});

export const ConnectedItemsResponseSchema = z.array(PlaidItemShape);

export const SyncResultSchema = z.object({
	addedCount: z.number(),
	modifiedCount: z.number(),
	removedCount: z.number(),
	holdingsSynced: z.boolean(),
});

export const PlaidSyncProgressSchema = z.object({
	plaidItemDbId: z.string(),
	phase: z.enum(["initial", "catchUp"]),
	addedCount: z.number(),
	modifiedCount: z.number(),
	removedCount: z.number(),
});

export type IpcPlaidAccount = z.infer<typeof PlaidAccountShape>;
export type IpcPlaidItem = z.infer<typeof PlaidItemShape>;
export type IpcConnectedItemsResponse = z.infer<
	typeof ConnectedItemsResponseSchema
>;
export type IpcSyncResult = z.infer<typeof SyncResultSchema>;
export type IpcPlaidSyncProgress = z.infer<typeof PlaidSyncProgressSchema>;
export type ExchangePublicTokenInput = z.infer<
	typeof ExchangePublicTokenInputSchema
>;
export type GetAccountHoldingsInput = z.infer<
	typeof GetAccountHoldingsInputSchema
>;
export type SetAccountHiddenInput = z.infer<typeof SetAccountHiddenInputSchema>;
export type SetAccountSyncEnabledInput = z.infer<
	typeof SetAccountSyncEnabledInputSchema
>;
export type ReorderItemsInput = z.infer<typeof ReorderItemsInputSchema>;
