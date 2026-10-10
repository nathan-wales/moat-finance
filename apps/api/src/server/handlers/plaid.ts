import {
	buildAccountNameOverrideMap,
	resolveAccountDisplayName,
} from "@moat/domain";
import { z } from "zod";
import { logger } from "~/lib/logger";
import { createApiError } from "~/server/api-context";
import {
	isPlaidItemAccessLive,
	selectConnectedPlaidItems,
} from "~/server/plaid/access-state";
import { collapseLiveDuplicatePlaidAccountsSafely } from "~/server/plaid/collapse-live-duplicate-accounts";
import {
	createLinkTokenForUser,
	createReconnectLinkTokenForItem,
	disconnectItem,
	exchangePublicTokenForItem,
	getHistoricalImportStatusForItem,
	runReconnectForItem,
	runSyncForItem,
} from "~/server/plaid/service";
import { setAccountSyncEnabled } from "~/server/plaid/set-account-sync-enabled";
import { ensureFinancialConnectionForPlaidItem } from "~/server/services/financial-connections.service";
import { syncFinancialConnectionJob } from "~/server/services/financial-sync.service";
import { runAppOpenCachedSyncForUser } from "~/server/services/plaid-connection-sync.service";
import { syncAllItemsForUser } from "~/server/services/plaidSyncService";
import { isRealtimeBalanceSyncEnabled } from "~/server/services/sync-feature-flags";
import { getRealtimeBalanceQuota } from "~/server/services/sync-realtime-rate-limit.service";
import {
	type AuthenticatedContext,
	type DemoOrAuthContext,
	withAuth,
	withDemoOrAuth,
} from "../handler-wrappers";

const exchangePublicTokenInput = z.object({
	publicToken: z.string().min(1),
	metadata: z
		.object({
			institution: z
				.object({
					name: z.string().optional(),
					institution_id: z.string().optional(),
				})
				.optional(),
			accounts: z
				.array(
					z.object({
						id: z.string().min(1),
						name: z.string().min(1),
						mask: z.string().nullable().optional(),
						type: z.string().min(1),
						subtype: z.string().nullable().optional(),
					}),
				)
				.optional(),
		})
		.optional(),
});

const itemIdInput = z.object({ itemId: z.string().min(1) });
const plaidItemIdInput = z.object({ plaidItemId: z.string().min(1) });

export const plaid = {
	/**
	 * Creates a Plaid Link token for the current user.
	 * The client uses this to initialize and open Plaid Link.
	 */
	createLinkToken: withAuth(async (ctx: AuthenticatedContext) => {
		const { userId } = ctx;
		try {
			const result = await createLinkTokenForUser(userId);
			// Convert to snake_case to match OpenAPI spec
			return {
				link_token: result.linkToken,
				expiration: result.expiration,
			};
		} catch (err) {
			logger.logError("Failed to create link token", err, {
				feature: "plaid",
				operation: "createLinkToken",
				userId,
			});
			throw new Error(
				err instanceof Error ? err.message : "Failed to create link token",
			);
		}
	}),

	/**
	 * Exchanges a public_token from Plaid Link for an access token,
	 * persists the item, syncs accounts, and runs initial transaction sync.
	 */
	exchangePublicToken: withAuth(
		async (ctx: AuthenticatedContext, body: unknown) => {
			const { userId } = ctx;
			const input = exchangePublicTokenInput.parse(body);
			try {
				return await exchangePublicTokenForItem(
					userId,
					input.publicToken,
					input.metadata,
				);
			} catch (err) {
				logger.logError("Failed to exchange public token", err, {
					feature: "plaid",
					operation: "exchangePublicToken",
					userId,
				});
				throw new Error(
					err instanceof Error ? err.message : "Failed to connect institution",
				);
			}
		},
	),

	/**
	 * Returns all connected institutions for the current user,
	 * including their accounts and sync state.
	 */
	getConnectedInstitutions: withDemoOrAuth(async (ctx: DemoOrAuthContext) => {
		const { userId } = ctx;
		if (!ctx.isDemoMode) {
			await collapseLiveDuplicatePlaidAccountsSafely(ctx.db, userId);
		}
		const [items, financialProfile] = await Promise.all([
			ctx.db.plaidItem.findMany({
				where: { userId },
				include: {
					plaidAccounts: {
						where: { isActive: true },
						orderBy: { name: "asc" },
					},
				},
				orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
			}),
			ctx.db.financialProfileData.findUnique({
				where: { userId },
				select: { accounts: true },
			}),
		]);
		const nameOverrides = buildAccountNameOverrideMap(
			financialProfile?.accounts,
		);
		const visibleItems = selectConnectedPlaidItems(items);

		return visibleItems.map((item) => ({
			id: item.id,
			plaidItemId: item.plaidItemId,
			institutionId: item.institutionId,
			institutionName: item.institutionName,
			requiresReconnect: item.requiresReconnect,
			accessRevoked: !isPlaidItemAccessLive(item),
			lastErrorCode: item.lastErrorCode,
			lastErrorMessage: item.lastErrorMessage,
			lastSyncAt: item.lastSyncAt,
			lastSuccessfulSyncAt: item.lastSuccessfulSyncAt,
			lastTransactionSyncAt: item.lastTransactionSyncAt,
			lastBalanceSyncAt: item.lastBalanceSyncAt,
			lastRealtimeBalanceSyncAt: item.lastRealtimeBalanceSyncAt,
			lastHoldingsSyncAt: item.lastHoldingsSyncAt,
			lastProviderWebhookAt: item.lastProviderWebhookAt,
			createdAt: item.createdAt,
			accounts: item.plaidAccounts.map((acct) => ({
				id: acct.id,
				plaidAccountId: acct.plaidAccountId,
				name: resolveAccountDisplayName(nameOverrides.get(acct.id), acct.name),
				officialName: acct.officialName,
				mask: acct.mask,
				type: acct.type,
				subtype: acct.subtype,
				currentBalance: acct.currentBalance,
				availableBalance: acct.availableBalance,
				currency: acct.currency,
				monthlyContribution: acct.monthlyContribution,
				annualReturnRate: acct.annualReturnRate,
				notes: acct.notes,
				isActive: acct.isActive,
				investmentHidden: acct.investmentHidden,
				accountHidden: acct.accountHidden,
				syncEnabled: acct.syncEnabled,
				lastBalanceSyncAt: acct.lastBalanceSyncAt,
			})),
		}));
	}),

	/**
	 * Returns all linked PlaidItems with reconnect state, last sync, and
	 * account summaries. Intended for settings/management UI.
	 */
	listItems: withAuth(async (ctx: AuthenticatedContext) => {
		const { userId } = ctx;
		const items = await ctx.db.plaidItem.findMany({
			where: { userId },
			include: {
				plaidAccounts: {
					orderBy: { name: "asc" },
				},
			},
			orderBy: { createdAt: "desc" },
		});

		return items.map((item) => ({
			id: item.id,
			plaidItemId: item.plaidItemId,
			institutionId: item.institutionId,
			institutionName: item.institutionName,
			requiresReconnect: item.requiresReconnect,
			lastErrorCode: item.lastErrorCode,
			lastErrorMessage: item.lastErrorMessage,
			lastSyncAt: item.lastSyncAt,
			lastSuccessfulSyncAt: item.lastSuccessfulSyncAt,
			lastTransactionSyncAt: item.lastTransactionSyncAt,
			lastBalanceSyncAt: item.lastBalanceSyncAt,
			lastRealtimeBalanceSyncAt: item.lastRealtimeBalanceSyncAt,
			lastHoldingsSyncAt: item.lastHoldingsSyncAt,
			lastProviderWebhookAt: item.lastProviderWebhookAt,
			createdAt: item.createdAt,
			accounts: item.plaidAccounts.map((acct) => ({
				id: acct.id,
				name: acct.name,
				mask: acct.mask,
				type: acct.type,
				subtype: acct.subtype,
				isActive: acct.isActive,
				syncEnabled: acct.syncEnabled,
				currentBalance: acct.currentBalance,
				availableBalance: acct.availableBalance,
				monthlyContribution: acct.monthlyContribution,
				annualReturnRate: acct.annualReturnRate,
			})),
		}));
	}),

	/**
	 * Reports whether the full transaction history for an item has been
	 * imported. Post-connect dialogs poll this to hold "syncing" until the
	 * whole year of data is available.
	 */
	getImportStatus: withAuth(
		async (ctx: AuthenticatedContext, body: unknown) => {
			const { userId } = ctx;
			const input = itemIdInput.parse(body);
			try {
				return await getHistoricalImportStatusForItem(input.itemId, userId);
			} catch (err) {
				logger.logError("Failed to get import status", err, {
					feature: "plaid",
					operation: "getImportStatus",
					userId,
					itemId: input.itemId,
				});
				throw new Error(
					err instanceof Error ? err.message : "Failed to get import status",
				);
			}
		},
	),

	/**
	 * Manually syncs a single connected institution (transactions + balances).
	 */
	syncItem: withAuth(async (ctx: AuthenticatedContext, body: unknown) => {
		const { userId } = ctx;
		const input = itemIdInput.parse(body);
		try {
			const result = await runSyncForItem(input.itemId, userId, {
				refreshBalances: true,
			});
			return result;
		} catch (err) {
			if (isApiErrorWithStatus(err, 429)) throw err;
			logger.logError("Failed to sync item", err, {
				feature: "plaid",
				operation: "syncItem",
				userId,
				itemId: input.itemId,
			});
			throw new Error(err instanceof Error ? err.message : "Sync failed");
		}
	}),

	/**
	 * Admin/manual retry: syncs a single item by ID. Verifies ownership.
	 * Same lock and cursor semantics as all other sync paths.
	 */
	syncItemNow: withAuth(async (ctx: AuthenticatedContext, body: unknown) => {
		const { userId } = ctx;
		const input = plaidItemIdInput.parse(body);
		const item = await ctx.db.plaidItem.findFirst({
			where: { id: input.plaidItemId, userId },
			select: { id: true },
		});
		if (!item) {
			throw new Error("Item not found");
		}
		try {
			return await runSyncForItem(item.id, userId, {
				refreshBalances: true,
			});
		} catch (err) {
			if (isApiErrorWithStatus(err, 429)) throw err;
			logger.logError("Failed to sync item now", err, {
				feature: "plaid",
				operation: "syncItemNow",
				userId,
				itemId: item.id,
			});
			throw new Error(err instanceof Error ? err.message : "Sync failed");
		}
	}),

	/**
	 * Queues cached `/transactions/sync` + `/accounts/get` for items stale > 30 minutes.
	 * Does not call billable `/accounts/balance/get`. Provider sync runs asynchronously.
	 */
	syncStaleCached: withAuth(async (ctx: AuthenticatedContext) => {
		const { userId } = ctx;
		try {
			return await runAppOpenCachedSyncForUser(userId);
		} catch (err) {
			logger.logError("Failed to run app-open cached Plaid sync", err, {
				feature: "plaid",
				operation: "syncStaleCached",
				userId,
			});
			throw new Error(
				err instanceof Error ? err.message : "Cached sync failed",
			);
		}
	}),

	/**
	 * Syncs all connected institutions for the current user.
	 */
	syncAll: withAuth(async (ctx: AuthenticatedContext) => {
		const { userId } = ctx;
		try {
			await syncAllItemsForUser(userId);
			return { success: true };
		} catch (err) {
			if (isApiErrorWithStatus(err, 429)) throw err;
			logger.logError("Failed to sync all items", err, {
				feature: "plaid",
				operation: "syncAll",
				userId,
			});
			throw new Error(err instanceof Error ? err.message : "Sync all failed");
		}
	}),

	/**
	 * Creates an update-mode link token for reconnecting an existing item.
	 */
	createReconnectToken: withAuth(
		async (ctx: AuthenticatedContext, body: unknown) => {
			const { userId } = ctx;
			const input = itemIdInput.parse(body);
			const item = await ctx.db.plaidItem.findFirst({
				where: { id: input.itemId, userId },
			});
			if (!item) {
				throw new Error("Institution not found");
			}
			try {
				return await createReconnectLinkTokenForItem(input.itemId, userId);
			} catch (err) {
				logger.logError("Failed to create reconnect token", err, {
					feature: "plaid",
					operation: "createReconnectToken",
					userId,
					itemId: input.itemId,
				});
				throw new Error(
					err instanceof Error
						? err.message
						: "Failed to create reconnect token",
				);
			}
		},
	),

	/**
	 * Finalizes a reconnect after the user completes Plaid Link update mode.
	 * Resets error state and runs a fresh sync.
	 */
	reconnectItem: withAuth(async (ctx: AuthenticatedContext, body: unknown) => {
		const { userId } = ctx;
		const input = itemIdInput.parse(body);
		try {
			await runReconnectForItem(input.itemId, userId);
			return { success: true };
		} catch (err) {
			logger.logError("Failed to reconnect item", err, {
				feature: "plaid",
				operation: "reconnectItem",
				userId,
				itemId: input.itemId,
			});
			throw new Error(err instanceof Error ? err.message : "Reconnect failed");
		}
	}),

	/**
	 * Disconnects an institution: revokes Plaid access and deactivates accounts.
	 * Keeps local identity rows and transaction history for a later re-link.
	 */
	disconnectItem: withAuth(async (ctx: AuthenticatedContext, body: unknown) => {
		const { userId } = ctx;
		const input = itemIdInput.parse(body);
		try {
			await disconnectItem(input.itemId, userId);
			return { success: true };
		} catch (err) {
			logger.logError("Failed to disconnect item", err, {
				feature: "plaid",
				operation: "disconnectItem",
				userId,
				itemId: input.itemId,
			});
			throw new Error(err instanceof Error ? err.message : "Disconnect failed");
		}
	}),

	refreshRealtimeBalance: withAuth(
		async (ctx: AuthenticatedContext, body: unknown) => {
			const { userId } = ctx;
			const input = itemIdInput.parse(body);
			if (!isRealtimeBalanceSyncEnabled(userId)) {
				throw createApiError(
					"Real-time balance refresh is not enabled for this account.",
					403,
				);
			}
			const item = await ctx.db.plaidItem.findFirst({
				where: { id: input.itemId, userId },
				select: { id: true },
			});
			if (!item) throw new Error("Item not found");
			const { connectionId } = await ensureFinancialConnectionForPlaidItem({
				plaidItemDbId: item.id,
			});
			try {
				await syncFinancialConnectionJob({
					connectionId,
					syncType: "realtime_balances",
					reason: "manual_realtime_balance_refresh",
					trigger: "USER_REFRESH",
				});
				return { success: true };
			} catch (err) {
				if (isApiErrorWithStatus(err, 429)) throw err;
				throw err;
			}
		},
	),

	getRealtimeBalanceQuota: withAuth(
		async (ctx: AuthenticatedContext, body: unknown) => {
			const { userId } = ctx;
			const input = itemIdInput.parse(body);
			const item = await ctx.db.plaidItem.findFirst({
				where: { id: input.itemId, userId },
				select: { id: true },
			});
			if (!item) throw new Error("Item not found");
			const { connectionId } = await ensureFinancialConnectionForPlaidItem({
				plaidItemDbId: item.id,
			});
			return getRealtimeBalanceQuota({
				userId,
				connectionId,
				enabled: isRealtimeBalanceSyncEnabled(userId),
			});
		},
	),

	/**
	 * Saves the display order of connected institutions.
	 */
	reorderItems: withAuth(async (ctx: AuthenticatedContext, body: unknown) => {
		const { userId } = ctx;
		const input = z
			.object({ orderedIds: z.array(z.string().min(1)) })
			.parse(body);

		await ctx.db.$transaction(
			input.orderedIds.map((id, index) =>
				ctx.db.plaidItem.updateMany({
					where: { id, userId },
					data: { sortOrder: index },
				}),
			),
		);

		return { success: true };
	}),

	/**
	 * Sets the accountHidden flag on any PlaidAccount owned by the user.
	 */
	setAccountHidden: withAuth(
		async (ctx: AuthenticatedContext, body: unknown) => {
			const { userId } = ctx;
			const input = z
				.object({ accountId: z.string().min(1), hidden: z.boolean() })
				.parse(body);

			const account = await ctx.db.plaidAccount.findFirst({
				where: { id: input.accountId, userId },
				select: { id: true },
			});
			if (!account) {
				throw new Error("Account not found");
			}

			await ctx.db.plaidAccount.update({
				where: { id: account.id },
				data: { accountHidden: input.hidden },
			});

			return { id: account.id, accountHidden: input.hidden };
		},
	),

	/**
	 * Enables or disables ongoing sync (and billing) for one Plaid account
	 * without revoking the institution Item.
	 */
	setAccountSyncEnabled: withAuth(
		async (ctx: AuthenticatedContext, body: unknown) => {
			const { userId } = ctx;
			const input = z
				.object({
					accountId: z.string().min(1),
					syncEnabled: z.boolean(),
				})
				.parse(body);

			try {
				return await setAccountSyncEnabled({
					db: ctx.db,
					userId,
					accountId: input.accountId,
					syncEnabled: input.syncEnabled,
				});
			} catch (err) {
				logger.logError("Failed to update account sync", err, {
					feature: "plaid",
					operation: "setAccountSyncEnabled",
					userId,
				});
				throw new Error(
					err instanceof Error ? err.message : "Failed to update account sync",
				);
			}
		},
	),
};

function isApiErrorWithStatus(error: unknown, status: number): boolean {
	return (
		error instanceof Error &&
		"status" in error &&
		(error as Error & { status: number }).status === status
	);
}
