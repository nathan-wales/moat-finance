/**
 * IPC handlers for Plaid operations.
 *
 * All handlers run in the main process and have full access to SQLite and Plaid SDK.
 * Inputs are Zod-validated. Token decryption happens inside the service layer.
 *
 * Main-process only — never import from the renderer.
 */
import {
	CreateReconnectTokenInputSchema,
	DisconnectItemInputSchema,
	ExchangePublicTokenInputSchema,
	GetAccountHoldingsInputSchema,
	PLAID_CHANNELS,
	ReconnectItemInputSchema,
	ReorderItemsInputSchema,
	SetAccountHiddenInputSchema,
	SetAccountSyncEnabledInputSchema,
	SyncItemInputSchema,
} from "@moat/contracts";
import {
	buildAccountNameOverrideMap,
	EMPTY_ACCOUNT_HOLDINGS_RESULT,
	plaidAccountIdsForHoldingsLookup,
	resolveAccountDisplayName,
	toAccountHoldingsResult,
} from "@moat/domain";
import { ipcMain } from "electron";
import { selectConnectedPlaidItems } from "../plaid/access-state";
import { collapseLiveDuplicatePlaidAccountsSafely } from "../plaid/collapse-live-duplicate-accounts";
import { getPlaidErrorDetails } from "../plaid/errors";
import { requestScheduledPlaidSync } from "../plaid/scheduler";
import {
	connectItem,
	createLinkToken,
	createReconnectToken,
	disconnectItem,
	reconnectItem,
	reorderItems,
	syncAllItems,
	syncItem,
} from "../plaid/service";
import { setAccountSyncEnabled } from "../plaid/set-account-sync-enabled";
import { getUnlockedDesktopDb } from "./vault-guard";

function toSerializablePlaidError(err: unknown): Error {
	const { message } = getPlaidErrorDetails(err);
	return new Error(
		message ?? (err instanceof Error ? err.message : "Sync failed"),
	);
}

export function registerPlaidHandlers(): void {
	ipcMain.handle(PLAID_CHANNELS.createLinkToken, async () => {
		const { appCtx } = getUnlockedDesktopDb();
		return { linkToken: await createLinkToken(appCtx.userId) };
	});

	// ── Exchange public token (after Plaid Link success) ────────────────────────
	ipcMain.handle(
		PLAID_CHANNELS.exchangePublicToken,
		async (_event, raw: unknown) => {
			const { db, appCtx } = getUnlockedDesktopDb();
			const input = ExchangePublicTokenInputSchema.parse(raw);
			return connectItem({
				userId: appCtx.userId,
				publicToken: input.publicToken,
				institutionId: input.institutionId,
				institutionName: input.institutionName,
				accounts: input.accounts,
				db,
			});
		},
	);

	ipcMain.handle(PLAID_CHANNELS.getConnectedItems, async () => {
		const { db, appCtx } = getUnlockedDesktopDb();
		await collapseLiveDuplicatePlaidAccountsSafely({
			db,
			userId: appCtx.userId,
			disconnectItem: (itemId) =>
				disconnectItem({
					userId: appCtx.userId,
					plaidItemDbId: itemId,
					db,
				}),
		});
		const [items, financialProfile] = await Promise.all([
			db.plaidItem.findMany({
				where: { userId: appCtx.userId },
				orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
				include: {
					accounts: {
						orderBy: { name: "asc" },
					},
				},
			}) as Promise<
				Array<{
					id: string;
					plaidItemId: string;
					institutionId: string | null;
					institutionName: string;
					requiresReconnect: boolean;
					lastErrorCode: string | null;
					lastErrorMessage: string | null;
					lastSyncAt: Date | null;
					lastSuccessfulSyncAt: Date | null;
					accessRevokedAt: Date | null;
					accessTokenEncrypted: Buffer | null;
					sortOrder: number;
					accounts: Array<{
						id: string;
						plaidAccountId: string;
						name: string;
						mask: string | null;
						type: string;
						subtype: string | null;
						currentBalance: number | null;
						availableBalance: number | null;
						currency: string;
						isActive: boolean;
						isHidden: boolean;
						syncEnabled: boolean;
					}>;
				}>
			>,
			appCtx.repositories.financialProfileData?.get({
				userId: appCtx.userId,
			}) ?? Promise.resolve(null),
		]);
		const nameOverrides = buildAccountNameOverrideMap(
			financialProfile?.accounts,
		);

		// A paused item is hidden once the same institution has a live one, so a
		// re-link does not leave an empty duplicate card behind. User-disconnected
		// items (revoked + inactive accounts) stay hidden until re-linked.
		return selectConnectedPlaidItems(items).map((item) => ({
			id: item.id,
			plaidItemId: item.plaidItemId,
			institutionId: item.institutionId,
			institutionName: item.institutionName,
			requiresReconnect: item.requiresReconnect,
			lastErrorCode: item.lastErrorCode,
			lastErrorMessage: item.lastErrorMessage,
			lastSyncAt: item.lastSyncAt?.toISOString() ?? null,
			lastSuccessfulSyncAt: item.lastSuccessfulSyncAt?.toISOString() ?? null,
			accessRevokedAt: item.accessRevokedAt?.toISOString() ?? null,
			sortOrder: item.sortOrder,
			accounts: item.accounts.map((acct) => ({
				id: acct.id,
				plaidAccountId: acct.plaidAccountId,
				name: resolveAccountDisplayName(nameOverrides.get(acct.id), acct.name),
				mask: acct.mask,
				type: acct.type,
				subtype: acct.subtype,
				currentBalance: acct.currentBalance,
				availableBalance: acct.availableBalance,
				currency: acct.currency,
				isActive: acct.isActive,
				isHidden: acct.isHidden,
				syncEnabled: acct.syncEnabled,
			})),
		}));
	});

	ipcMain.handle(
		PLAID_CHANNELS.getAccountHoldings,
		async (_event, raw: unknown) => {
			const { db, appCtx } = getUnlockedDesktopDb();
			const { accountId } = GetAccountHoldingsInputSchema.parse(raw);
			const plaidAccountIds = plaidAccountIdsForHoldingsLookup(accountId);
			if (plaidAccountIds.length === 0) return EMPTY_ACCOUNT_HOLDINGS_RESULT;

			const rows = (await db.plaidHolding.findMany({
				where: {
					userId: appCtx.userId,
					plaidAccountId: { in: plaidAccountIds },
				},
				orderBy: { value: "desc" },
				select: {
					securityId: true,
					name: true,
					tickerSymbol: true,
					securityType: true,
					quantity: true,
					price: true,
					value: true,
					costBasis: true,
					currency: true,
					syncedAt: true,
				},
			})) as Array<{
				securityId: string;
				name: string | null;
				tickerSymbol: string | null;
				securityType: string | null;
				quantity: number;
				price: number | null;
				value: number;
				costBasis: number | null;
				currency: string;
				syncedAt: Date;
			}>;
			return toAccountHoldingsResult(rows);
		},
	);

	// ── Sync one item ────────────────────────────────────────────────────────────
	ipcMain.handle(PLAID_CHANNELS.syncItem, async (_event, raw: unknown) => {
		const { db, appCtx } = getUnlockedDesktopDb();
		const { itemId, refreshBalances } = SyncItemInputSchema.parse(raw);
		try {
			return await syncItem({
				userId: appCtx.userId,
				plaidItemDbId: itemId,
				db,
				refreshBalances,
			});
		} catch (err) {
			throw toSerializablePlaidError(err);
		}
	});

	ipcMain.handle(PLAID_CHANNELS.syncAll, async () => {
		const { db, appCtx } = getUnlockedDesktopDb();
		return syncAllItems({ userId: appCtx.userId, db });
	});

	ipcMain.handle(PLAID_CHANNELS.requestScheduledSync, async () => {
		await requestScheduledPlaidSync();
		return { ok: true as const };
	});

	// ── Create reconnect link token (update mode) ────────────────────────────────
	ipcMain.handle(
		PLAID_CHANNELS.createReconnectToken,
		async (_event, raw: unknown) => {
			const { db, appCtx } = getUnlockedDesktopDb();
			const { itemId } = CreateReconnectTokenInputSchema.parse(raw);
			return {
				linkToken: await createReconnectToken({
					userId: appCtx.userId,
					plaidItemDbId: itemId,
					db,
				}),
			};
		},
	);

	ipcMain.handle(PLAID_CHANNELS.reconnectItem, async (_event, raw: unknown) => {
		const { db, appCtx } = getUnlockedDesktopDb();
		const input = ReconnectItemInputSchema.parse(raw);
		await reconnectItem({
			userId: appCtx.userId,
			plaidItemDbId: input.itemId,
			publicToken: input.publicToken,
			db,
		});
		return { success: true };
	});

	// ── Disconnect item ──────────────────────────────────────────────────────────
	ipcMain.handle(
		PLAID_CHANNELS.disconnectItem,
		async (_event, raw: unknown) => {
			const { db, appCtx } = getUnlockedDesktopDb();
			const { itemId } = DisconnectItemInputSchema.parse(raw);
			await disconnectItem({
				userId: appCtx.userId,
				plaidItemDbId: itemId,
				db,
			});
			return { success: true };
		},
	);

	// ── Toggle account hidden ────────────────────────────────────────────────────
	ipcMain.handle(
		PLAID_CHANNELS.setAccountHidden,
		async (_event, raw: unknown) => {
			const { db } = getUnlockedDesktopDb();
			const { plaidAccountId, isHidden } =
				SetAccountHiddenInputSchema.parse(raw);
			await db.plaidAccount.update({
				where: { plaidAccountId },
				data: { isHidden },
			});
			return { success: true };
		},
	);

	ipcMain.handle(
		PLAID_CHANNELS.setAccountSyncEnabled,
		async (_event, raw: unknown) => {
			const { db, appCtx } = getUnlockedDesktopDb();
			const { accountId, syncEnabled } =
				SetAccountSyncEnabledInputSchema.parse(raw);
			return setAccountSyncEnabled({
				db,
				userId: appCtx.userId,
				accountId,
				syncEnabled,
			});
		},
	);

	// ── Reorder items ────────────────────────────────────────────────────────────
	ipcMain.handle(PLAID_CHANNELS.reorderItems, async (_event, raw: unknown) => {
		const { db, appCtx } = getUnlockedDesktopDb();
		const { orderedIds } = ReorderItemsInputSchema.parse(raw);
		await reorderItems({
			userId: appCtx.userId,
			orderedIds,
			db,
		});
		return { success: true };
	});
}
