/**
 * Plaid orchestration service for the desktop app.
 * Called from IPC handlers (Phase 4).
 *
 * Handles: link token, exchange, sync, reconnect, disconnect.
 * Main-process only — never import from the renderer.
 */
import type { SqliteDbClient } from "@moat/db-sqlite";
import {
	plaidTransactionsHistoryRequest,
	resolveAdditionalConsentedProducts,
	resolvePlaidLinkProducts,
} from "@moat/financial-data-providers/plaid-investments";
import { CountryCode, type PlaidApi, type Products } from "plaid";
import { remoteLogger } from "../lib/remote-logger";
import {
	isPlaidItemAccessLive,
	LIVE_PLAID_ITEM_WHERE,
	livePlaidAccessToken,
	plaidInstitutionKey,
} from "./access-state";
import { adoptRevokedPlaidAccountsForInstitution } from "./adopt-revoked-accounts";
import { getPlaidClient } from "./client";
import { collapseLiveDuplicatePlaidAccounts } from "./collapse-live-duplicate-accounts";
import { emitPlaidSyncProgress } from "./emit-sync-progress";
import { getPlaidErrorDetails, isPlaidReconnectRequired } from "./errors";
import {
	cancelInitialTransactionSyncRetries,
	catchUpHistoricalTransactions,
	createInitialSyncRetryState,
	type DesktopTransactionSyncCatchUpDeps,
	finishInitialSyncRetry,
	isTransactionsProductNotReady,
	waitForTransactionsProductReady,
} from "./initial-sync-retry";
import { classifyIncomingAccounts } from "./match-live-accounts";
import { persistPlaidItemProductCapabilities } from "./persist-item-capabilities";
import { syncAccountsForItem } from "./sync-accounts";
import { maybeSyncHoldingsForItem } from "./sync-holdings";
import { syncTransactionsForItem } from "./sync-transactions";
import { decryptAccessToken, encryptAccessToken } from "./token-storage";

// ─── Link token ────────────────────────────────────────────────────────────────

export async function createLinkToken(userId: string): Promise<string> {
	const client = getPlaidClient();
	const { products, optionalProducts } = resolvePlaidLinkProducts();
	const response = await client.linkTokenCreate({
		user: { client_user_id: userId },
		client_name: "Moat Finance",
		products: [...products] as Products[],
		optional_products: [...optionalProducts] as Products[],
		country_codes: [CountryCode.Us],
		language: "en",
		transactions: plaidTransactionsHistoryRequest(),
	});
	return response.data.link_token;
}

// ─── Connect (exchange public token) ──────────────────────────────────────────

export type ConnectItemOutcome = "connected" | "already_linked" | "partial";

export type ConnectItemAccount = {
	name: string;
	mask: string | null;
};

export interface ConnectItemResult {
	plaidItemDbId: string;
	institutionName: string;
	outcome: ConnectItemOutcome;
	alreadyLinkedAccounts: ConnectItemAccount[];
	addedAccounts: ConnectItemAccount[];
}

export async function connectItem(params: {
	userId: string;
	publicToken: string;
	institutionId?: string;
	institutionName?: string;
	accounts?: Array<{
		id: string;
		name: string;
		mask?: string | null;
		type: string;
		subtype?: string | null;
	}>;
	db: SqliteDbClient;
}): Promise<ConnectItemResult> {
	const { userId, publicToken, institutionId, institutionName, db } = params;
	try {
		await collapseLiveDuplicatePlaidAccounts({
			db,
			userId,
			disconnectItem: (itemId) =>
				disconnectItem({ userId, plaidItemDbId: itemId, db }),
		});
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : "unknown";
		remoteLogger.error(
			"Failed to collapse live duplicate Plaid accounts before connect",
			{
				event: "plaid.collapse_before_connect_failed",
				feature: "plaid",
				operation: "connect_item",
				metadata: { errorMessage },
			},
		);
	}

	let classified: Awaited<ReturnType<typeof classifyDesktopSelectedAccounts>> =
		null;
	try {
		classified = await classifyDesktopSelectedAccounts({
			db,
			userId,
			institutionId: institutionId ?? null,
			institutionName: institutionName ?? "Unknown Bank",
			accounts: params.accounts ?? [],
		});
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : "unknown";
		remoteLogger.error("Failed to classify already-linked Plaid accounts", {
			event: "plaid.classify_already_linked_failed",
			feature: "plaid",
			operation: "connect_item",
			metadata: { errorMessage },
		});
	}
	if (classified && classified.newCount === 0) {
		remoteLogger.info("Skipped Plaid token exchange; accounts already linked", {
			event: "plaid.connect_already_linked",
			feature: "plaid",
			operation: "connect_item",
			metadata: {
				alreadyLinkedCount: classified.result.alreadyLinkedAccounts.length,
			},
		});
		return classified.result;
	}
	const connectStartedAt = Date.now();
	const client = getPlaidClient();

	const exchangeStartedAt = Date.now();
	const exchangeRes = await client.itemPublicTokenExchange({
		public_token: publicToken,
	});
	const exchangeMs = Date.now() - exchangeStartedAt;
	const { access_token: accessToken, item_id: plaidItemId } = exchangeRes.data;

	const accessTokenEncrypted = encryptAccessToken(accessToken);

	let resolvedInstitutionId = institutionId ?? null;
	let resolvedInstitutionName = institutionName ?? "Unknown Bank";

	const metadataStartedAt = Date.now();
	const [itemResult, accountsResult] = await Promise.allSettled([
		client.itemGet({ access_token: accessToken }),
		client.accountsGet({ access_token: accessToken }),
	]);
	const itemResponse =
		itemResult.status === "fulfilled" ? itemResult.value : null;
	const prefetchedAccounts =
		accountsResult.status === "fulfilled"
			? accountsResult.value.data.accounts
			: undefined;

	if (
		itemResponse &&
		(!resolvedInstitutionId ||
			!institutionName ||
			resolvedInstitutionName === "Unknown Bank")
	) {
		try {
			resolvedInstitutionId =
				itemResponse.data.item.institution_id ?? resolvedInstitutionId;
			if (
				resolvedInstitutionId &&
				(!institutionName || resolvedInstitutionName === "Unknown Bank")
			) {
				const instRes = await client.institutionsGetById({
					institution_id: resolvedInstitutionId,
					country_codes: [CountryCode.Us],
				});
				resolvedInstitutionName = instRes.data.institution.name;
			}
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : "unknown";
			remoteLogger.warn("Failed to resolve Plaid institution metadata", {
				event: "plaid.institution_metadata_failed",
				feature: "plaid",
				operation: "connect_item",
				metadata: { errorMessage },
			});
		}
	}
	const metadataMs = Date.now() - metadataStartedAt;

	const existing = (await db.plaidItem.findFirst({
		where: { userId, plaidItemId },
		select: { id: true },
	})) as { id: string } | null;

	let itemDbId: string;
	if (existing) {
		await db.plaidItem.update({
			where: { id: existing.id },
			data: {
				accessTokenEncrypted,
				accessRevokedAt: null,
				requiresReconnect: false,
				institutionId: resolvedInstitutionId,
				institutionName: resolvedInstitutionName,
				lastErrorCode: null,
				lastErrorMessage: null,
			},
		});
		itemDbId = existing.id;
	} else {
		const newItem = (await db.plaidItem.create({
			data: {
				userId,
				plaidItemId,
				institutionId: resolvedInstitutionId,
				institutionName: resolvedInstitutionName,
				accessTokenEncrypted,
				accessRevokedAt: null,
				requiresReconnect: false,
			},
			select: { id: true },
		})) as { id: string };
		itemDbId = newItem.id;
	}

	const persistStartedAt = Date.now();
	// Initial balance sync
	const accountIdMap = await syncAccountsForItem({
		db,
		plaidItemDbId: itemDbId,
		accessToken,
		plaidAccounts: prefetchedAccounts,
		onAccountsLoaded: async (plaidAccounts) => {
			// Adoption only reattaches history to a re-linked bank. Connecting must
			// still succeed if it fails, so the failure is logged, not propagated.
			try {
				await adoptRevokedPlaidAccountsForInstitution({
					userId,
					keepItemId: itemDbId,
					institutionId: resolvedInstitutionId,
					institutionName: resolvedInstitutionName,
					plaidAccounts,
					db,
				});
			} catch (err) {
				const errorMessage = err instanceof Error ? err.message : "unknown";
				console.error("[plaid] Adopting paused accounts failed:", err);
				remoteLogger.error("Adopting paused Plaid accounts failed", {
					event: "plaid.adopt_paused_accounts_failed",
					feature: "plaid",
					operation: "connect_item",
					metadata: { errorMessage },
				});
			}
		},
	});

	await persistPlaidItemProductCapabilities({
		db,
		plaidItemDbId: itemDbId,
		accessToken,
		itemSnapshot: itemResponse?.data.item,
	});
	const persistMs = Date.now() - persistStartedAt;

	let alreadyLinkedAccounts: Awaited<
		ReturnType<typeof loadAlreadyLinkedDesktopAccounts>
	> = [];
	try {
		alreadyLinkedAccounts = await loadAlreadyLinkedDesktopAccounts({
			db,
			userId,
			excludeItemId: itemDbId,
			institutionId: resolvedInstitutionId,
			institutionName: resolvedInstitutionName,
			incoming: (prefetchedAccounts ?? []).map((account) => ({
				plaidAccountId: account.account_id,
				name: account.name,
				mask: account.mask ?? null,
				type: account.type,
				subtype: account.subtype ?? null,
			})),
		});
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : "unknown";
		remoteLogger.error(
			"Failed to classify already-linked Plaid accounts after exchange",
			{
				event: "plaid.classify_after_exchange_failed",
				feature: "plaid",
				operation: "connect_item",
				metadata: { itemId: itemDbId, errorMessage },
			},
		);
	}

	if (accountIdMap.size === 0 && alreadyLinkedAccounts.length > 0) {
		try {
			await disconnectItem({ userId, plaidItemDbId: itemDbId, db });
			remoteLogger.info("Disconnected duplicate Plaid item after exchange", {
				event: "plaid.connect_disconnected_duplicate",
				feature: "plaid",
				operation: "connect_item",
				metadata: {
					itemId: itemDbId,
					alreadyLinkedCount: alreadyLinkedAccounts.length,
				},
			});
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : "unknown";
			remoteLogger.error(
				"Failed to disconnect duplicate Plaid item after exchange",
				{
					event: "plaid.connect_disconnected_duplicate_failed",
					feature: "plaid",
					operation: "connect_item",
					metadata: { itemId: itemDbId, errorMessage },
				},
			);
		}
		const existingLive = alreadyLinkedAccounts[0];
		return {
			plaidItemDbId: existingLive?.plaidItemDbId ?? itemDbId,
			institutionName: resolvedInstitutionName,
			outcome: "already_linked",
			alreadyLinkedAccounts: alreadyLinkedAccounts.map((account) => ({
				name: account.name,
				mask: account.mask,
			})),
			addedAccounts: [],
		};
	}

	const addedAccounts = Array.from(accountIdMap.entries()).map(
		([plaidAccountId, account]) => {
			const source = prefetchedAccounts?.find(
				(plaidAccount) => plaidAccount.account_id === plaidAccountId,
			);
			return {
				name: account.name,
				mask: source?.mask ?? null,
			};
		},
	);
	const outcome: ConnectItemOutcome =
		alreadyLinkedAccounts.length > 0 ? "partial" : "connected";

	remoteLogger.info("Plaid connect item completed", {
		event: "plaid.connect_item_timing",
		feature: "plaid",
		operation: "connect_item",
		metadata: {
			exchangeMs,
			metadataMs,
			persistMs,
			totalMs: Date.now() - connectStartedAt,
			accountCount: accountIdMap.size,
			prefetchedAccounts: Boolean(prefetchedAccounts),
			prefetchedItem: Boolean(itemResponse),
			outcome,
			alreadyLinkedCount: alreadyLinkedAccounts.length,
			addedAccountCount: addedAccounts.length,
		},
	});

	return {
		plaidItemDbId: itemDbId,
		institutionName: resolvedInstitutionName,
		outcome,
		alreadyLinkedAccounts: alreadyLinkedAccounts.map((account) => ({
			name: account.name,
			mask: account.mask,
		})),
		addedAccounts,
	};
}

async function classifyDesktopSelectedAccounts(input: {
	db: SqliteDbClient;
	userId: string;
	institutionId: string | null;
	institutionName: string;
	accounts: Array<{
		id: string;
		name: string;
		mask?: string | null;
		type: string;
		subtype?: string | null;
	}>;
}): Promise<{ newCount: number; result: ConnectItemResult } | null> {
	if (input.accounts.length === 0) return null;
	const live = await loadDesktopLiveInstitutionAccounts(input);
	if (live.length === 0) return null;
	const classified = classifyIncomingAccounts({
		live,
		incoming: input.accounts.map((account) => ({
			plaidAccountId: account.id,
			name: account.name,
			mask: account.mask ?? null,
			type: account.type,
			subtype: account.subtype ?? null,
		})),
	});
	if (classified.newAccounts.length > 0) return null;
	if (classified.alreadyLinked.length === 0) return null;
	const first = live.find(
		(account) => account.id === classified.alreadyLinked[0]?.liveAccountId,
	);
	if (!first) return null;
	return {
		newCount: 0,
		result: {
			plaidItemDbId: first.plaidItemId,
			institutionName: first.institutionName,
			outcome: "already_linked",
			alreadyLinkedAccounts: classified.alreadyLinked.flatMap((match) => {
				const account = live.find((row) => row.id === match.liveAccountId);
				if (!account) return [];
				return [{ name: account.name, mask: account.mask }];
			}),
			addedAccounts: [],
		},
	};
}

async function loadAlreadyLinkedDesktopAccounts(input: {
	db: SqliteDbClient;
	userId: string;
	excludeItemId: string;
	institutionId: string | null;
	institutionName: string;
	incoming: Array<{
		plaidAccountId: string;
		name: string;
		mask: string | null;
		type: string;
		subtype: string | null;
	}>;
}): Promise<
	Array<{ plaidItemDbId: string; name: string; mask: string | null }>
> {
	const live = await loadDesktopLiveInstitutionAccounts({
		...input,
		excludeItemId: input.excludeItemId,
	});
	const classified = classifyIncomingAccounts({
		live,
		incoming: input.incoming,
	});
	return classified.alreadyLinked.flatMap((match) => {
		const account = live.find((row) => row.id === match.liveAccountId);
		if (!account) return [];
		return [
			{
				plaidItemDbId: account.plaidItemId,
				name: account.name,
				mask: account.mask,
			},
		];
	});
}

async function loadDesktopLiveInstitutionAccounts(input: {
	db: SqliteDbClient;
	userId: string;
	institutionId: string | null;
	institutionName: string;
	excludeItemId?: string;
}): Promise<
	Array<{
		id: string;
		plaidAccountId: string;
		plaidItemId: string;
		name: string;
		mask: string | null;
		type: string;
		subtype: string | null;
		institutionName: string;
	}>
> {
	const targetKey = plaidInstitutionKey({
		institutionId: input.institutionId,
		institutionName: input.institutionName,
	});
	const items = (await input.db.plaidItem.findMany({
		where: {
			userId: input.userId,
			...(input.excludeItemId ? { id: { not: input.excludeItemId } } : {}),
			accessRevokedAt: null,
			accessTokenEncrypted: { not: null },
		},
		select: {
			id: true,
			institutionId: true,
			institutionName: true,
			accessRevokedAt: true,
			accessTokenEncrypted: true,
			accounts: {
				where: { isActive: true },
				select: {
					id: true,
					plaidAccountId: true,
					plaidItemId: true,
					name: true,
					mask: true,
					type: true,
					subtype: true,
				},
			},
		},
	})) as Array<{
		id: string;
		institutionId: string | null;
		institutionName: string;
		accessRevokedAt: Date | null;
		accessTokenEncrypted: Buffer | null;
		accounts: Array<{
			id: string;
			plaidAccountId: string;
			plaidItemId: string;
			name: string;
			mask: string | null;
			type: string;
			subtype: string | null;
		}>;
	}>;

	return items
		.filter(isPlaidItemAccessLive)
		.filter(
			(item) =>
				plaidInstitutionKey({
					institutionId: item.institutionId,
					institutionName: item.institutionName,
				}) === targetKey,
		)
		.flatMap((item) =>
			item.accounts.map((account) => ({
				...account,
				institutionName: item.institutionName,
			})),
		);
}

// ─── Sync one item ─────────────────────────────────────────────────────────────

export async function syncItem(params: {
	userId: string;
	plaidItemDbId: string;
	db: SqliteDbClient;
	refreshBalances?: boolean;
	catchUpDeps?: DesktopTransactionSyncCatchUpDeps;
}): Promise<{
	addedCount: number;
	modifiedCount: number;
	removedCount: number;
	holdingsSynced: boolean;
}> {
	const item = (await params.db.plaidItem.findFirst({
		where: { id: params.plaidItemDbId, userId: params.userId },
		select: { cursor: true },
	})) as { cursor: string | null } | null;
	const catchUpHistorical = !item?.cursor;
	const refreshBalances = params.refreshBalances ?? !catchUpHistorical;

	const retryState = createInitialSyncRetryState(params.plaidItemDbId);

	let result = await syncTransactionsForItem({
		...params,
		refreshBalances,
	});

	if (isTransactionsProductNotReady(result)) {
		result = await waitForTransactionsProductReady({
			...params,
			lastResult: result,
			state: retryState,
			deps: params.catchUpDeps,
		});
	}

	emitPlaidSyncProgress({
		plaidItemDbId: params.plaidItemDbId,
		phase: "initial",
		addedCount: result.addedCount,
		modifiedCount: result.modifiedCount,
		removedCount: result.removedCount,
	});

	// Awaited on purpose: connect UIs hold their syncing dialog until the
	// full year of history (Plaid's delayed historical pages) is imported.
	if (catchUpHistorical && !isTransactionsProductNotReady(result)) {
		try {
			const catchUpResult = await catchUpHistoricalTransactions({
				...params,
				lastResult: result,
				state: retryState,
				deps: params.catchUpDeps,
			});
			emitPlaidSyncProgress({
				plaidItemDbId: params.plaidItemDbId,
				phase: "catchUp",
				addedCount: catchUpResult.addedCount,
				modifiedCount: catchUpResult.modifiedCount,
				removedCount: catchUpResult.removedCount,
			});
		} catch (err) {
			const { code, message } = getPlaidErrorDetails(err);
			console.error("[plaid] Historical catch-up failed:", {
				code,
				message,
			});
			remoteLogger.error("Plaid historical catch-up failed", {
				event: "plaid.historical_catch_up_failed",
				feature: "plaid",
				operation: "sync_item",
				metadata: {
					code: code ?? "unknown",
					errorMessage: message ?? "unknown",
				},
			});
		} finally {
			finishInitialSyncRetry(params.plaidItemDbId, retryState);
		}
	} else {
		finishInitialSyncRetry(params.plaidItemDbId, retryState);
	}

	const holdingsSynced = await maybeSyncHoldingsForItem(params);
	return {
		addedCount: result.addedCount,
		modifiedCount: result.modifiedCount,
		removedCount: result.removedCount,
		holdingsSynced,
	};
}

// ─── Sync all items ────────────────────────────────────────────────────────────

export async function syncAllItems(params: {
	userId: string;
	db: SqliteDbClient;
}): Promise<{
	results: Array<{
		plaidItemDbId: string;
		institutionName: string;
		success: boolean;
		error?: string;
	}>;
}> {
	const { userId, db } = params;

	const items = (await db.plaidItem.findMany({
		where: {
			userId,
			requiresReconnect: false,
			...LIVE_PLAID_ITEM_WHERE,
		},
		select: { id: true, institutionName: true },
	})) as Array<{
		id: string;
		institutionName: string;
	}>;

	const results: Array<{
		plaidItemDbId: string;
		institutionName: string;
		success: boolean;
		error?: string;
	}> = [];

	for (const item of items) {
		try {
			await syncItem({
				userId,
				plaidItemDbId: item.id,
				db,
			});
			results.push({
				plaidItemDbId: item.id,
				institutionName: item.institutionName,
				success: true,
			});
		} catch (err) {
			const { message } = getPlaidErrorDetails(err);
			results.push({
				plaidItemDbId: item.id,
				institutionName: item.institutionName,
				success: false,
				error:
					message ?? (err instanceof Error ? err.message : "Unknown error"),
			});
		}
	}

	return { results };
}

// ─── Reconnect ─────────────────────────────────────────────────────────────────

export async function createReconnectToken(params: {
	userId: string;
	plaidItemDbId: string;
	db: SqliteDbClient;
}): Promise<string> {
	const { userId, plaidItemDbId, db } = params;
	const item = (await db.plaidItem.findFirstOrThrow({
		where: { id: plaidItemDbId, userId },
		select: { accessTokenEncrypted: true, accessRevokedAt: true },
	})) as { accessTokenEncrypted: Buffer | null; accessRevokedAt: Date | null };

	const accessTokenEncrypted = livePlaidAccessToken(item);
	if (!accessTokenEncrypted) {
		throw new Error(
			"This institution is paused. Connect it again to resume sync.",
		);
	}

	const accessToken = decryptAccessToken(accessTokenEncrypted);
	const client = getPlaidClient();
	const additionalConsentedProducts = [
		...resolveAdditionalConsentedProducts(),
	] as Products[];

	return createUpdateModeLinkToken({
		client,
		userId,
		accessToken,
		additionalConsentedProducts,
	});
}

async function createUpdateModeLinkToken(input: {
	client: PlaidApi;
	userId: string;
	accessToken: string;
	additionalConsentedProducts: Products[];
}): Promise<string> {
	const updateRequest = {
		user: { client_user_id: input.userId },
		client_name: "Moat Finance",
		country_codes: [CountryCode.Us],
		language: "en",
		access_token: input.accessToken,
	};

	if (input.additionalConsentedProducts.length > 0) {
		try {
			const response = await input.client.linkTokenCreate({
				...updateRequest,
				additional_consented_products: input.additionalConsentedProducts,
			});
			return response.data.link_token;
		} catch (err) {
			const { code, message } = getPlaidErrorDetails(err);
			console.warn(
				"[plaid] Update-mode link token rejected additional consented products",
				{ code, message },
			);
			remoteLogger.warn(
				"Plaid rejected update-mode link token with additional consented products",
				{
					event: "plaid.reconnect_additional_products_rejected",
					feature: "plaid",
					operation: "createReconnectLinkToken",
					metadata: {
						code: code ?? "unknown",
						errorMessage: message ?? "unknown",
					},
				},
			);
		}
	}

	const response = await input.client.linkTokenCreate(updateRequest);
	return response.data.link_token;
}

export async function reconnectItem(params: {
	userId: string;
	plaidItemDbId: string;
	publicToken: string;
	db: SqliteDbClient;
}): Promise<void> {
	const { userId, plaidItemDbId, publicToken, db } = params;
	const client = getPlaidClient();

	const exchangeRes = await client.itemPublicTokenExchange({
		public_token: publicToken,
	});
	const { access_token: newAccessToken } = exchangeRes.data;
	const accessTokenEncrypted = encryptAccessToken(newAccessToken);

	await db.plaidItem.update({
		where: { id: plaidItemDbId, userId },
		data: {
			accessTokenEncrypted,
			accessRevokedAt: null,
			requiresReconnect: false,
			lastErrorCode: null,
			lastErrorMessage: null,
		},
	});

	// Kick off an immediate sync after reconnect (with not-ready retries)
	await syncItem({
		userId,
		plaidItemDbId,
		db,
	}).catch((err) => {
		const { code, message } = getPlaidErrorDetails(err);
		console.error("[plaid] Post-reconnect sync failed:", { code, message });
		remoteLogger.error("Plaid post-reconnect sync failed", {
			event: "plaid.post_reconnect_sync_failed",
			feature: "plaid",
			operation: "post_reconnect_sync",
			metadata: {
				code: code ?? "unknown",
				errorMessage: message ?? "unknown",
			},
		});
		if (isPlaidReconnectRequired(err)) {
			void db.plaidItem.update({
				where: { id: plaidItemDbId },
				data: {
					requiresReconnect: true,
					lastErrorCode: code,
					lastErrorMessage: message,
				},
			});
		}
	});
}

// ─── Disconnect ────────────────────────────────────────────────────────────────

export async function disconnectItem(params: {
	userId: string;
	plaidItemDbId: string;
	db: SqliteDbClient;
}): Promise<void> {
	const { userId, plaidItemDbId, db } = params;

	const item = (await db.plaidItem.findFirstOrThrow({
		where: { id: plaidItemDbId, userId },
		select: { accessTokenEncrypted: true },
	})) as { accessTokenEncrypted: Buffer | null };

	if (item.accessTokenEncrypted) {
		try {
			const accessToken = decryptAccessToken(item.accessTokenEncrypted);
			const client = getPlaidClient();
			await client.itemRemove({ access_token: accessToken });
		} catch (err) {
			console.warn(
				"[plaid] itemRemove failed (proceeding with local revoke):",
				err,
			);
		}
	}

	cancelInitialTransactionSyncRetries(plaidItemDbId);

	const revokedAt = new Date();
	await db.plaidAccount.updateMany({
		where: { plaidItemId: plaidItemDbId },
		data: { isActive: false },
	});
	await db.plaidItem.update({
		where: { id: plaidItemDbId },
		data: {
			accessTokenEncrypted: null,
			cursor: null,
			accessRevokedAt: revokedAt,
		},
	});
}

// ─── Reorder items ─────────────────────────────────────────────────────────────

export async function reorderItems(params: {
	userId: string;
	orderedIds: string[];
	db: SqliteDbClient;
}): Promise<void> {
	const { userId, orderedIds, db } = params;

	// Update sortOrder in parallel (fine — each is a separate row)
	await Promise.all(
		orderedIds.map((id, index) =>
			db.plaidItem.update({
				where: { id, userId },
				data: { sortOrder: index },
			}),
		),
	);
}
