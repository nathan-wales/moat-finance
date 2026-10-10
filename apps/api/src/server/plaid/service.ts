/**
 * Plaid orchestration service layer.
 *
 * Router procedures and the webhook handler call this layer — they should
 * remain thin and contain no Plaid business logic themselves.
 *
 * Server-side only — never import from client code.
 */
import { logger } from "~/lib/logger";
import { db } from "../db";
import { decrypt, encrypt } from "../lib/encryption";
import { getPlaidClient } from "../lib/plaidClient";
import { recordSyncedAccountHistory } from "../services/account-balance-history.service";
import { takeSnapshot } from "../services/balance-snapshot.service";
import { ensureFinancialConnectionForPlaidItem } from "../services/financial-connections.service";
import { syncFinancialConnectionJob } from "../services/financial-sync.service";
import type { ConnectionSyncResult } from "../services/sync-types";
import { adoptRevokedPlaidAccountsForInstitution } from "./adopt-revoked-accounts";
import { collapseLiveDuplicatePlaidAccounts } from "./collapse-live-duplicate-accounts";
import { disconnectItem } from "./disconnect-item";
import {
	getPlaidErrorDetails,
	isPlaidMutationDuringPagination,
} from "./errors";
import {
	assembleHistoricalImportStatus,
	emptyHistoricalImportStatus,
	type HistoricalImportProbeSummary,
	type HistoricalImportStatus,
	summarizeHistoricalImportProbe,
	summarizeTransactionCoverage,
} from "./historical-import-status";
import { createPlaidLinkTokenForUser } from "./link";
import { loadLiveInstitutionAccounts } from "./live-institution-accounts";
import { classifyIncomingAccounts } from "./match-live-accounts";
import { persistPlaidItemProductCapabilities } from "./persist-item-capabilities";
import { fetchPlaidAccountsForItem, syncAccountsForItem } from "./syncAccounts";
import { syncTransactionsForItem } from "./syncTransactions";

export { disconnectItem };

// ─── Link tokens ──────────────────────────────────────────────────────────────

/** Creates an initial Plaid Link token for a new bank connection. */
export async function createLinkTokenForUser(
	userId: string,
): Promise<{ linkToken: string; expiration?: string }> {
	const result = await createPlaidLinkTokenForUser({ userId });
	return {
		linkToken: result.link_token,
		expiration: result.expiration ?? undefined,
	};
}

/** Creates an update-mode Link token for reconnecting/repairing an existing item. */
export async function createReconnectLinkTokenForItem(
	itemId: string,
	userId: string,
): Promise<{ linkToken: string }> {
	const item = await db.plaidItem.findFirstOrThrow({
		where: { id: itemId, userId },
		select: { accessTokenEncrypted: true, accessRevokedAt: true },
	});
	if (!item.accessTokenEncrypted || item.accessRevokedAt) {
		throw new Error("This institution must be linked again to resume sync");
	}
	const accessToken = decrypt(item.accessTokenEncrypted);
	const result = await createPlaidLinkTokenForUser({
		userId,
		isUpdateMode: true,
		accessToken,
	});
	return { linkToken: result.link_token };
}

// ─── Token exchange + initial sync ───────────────────────────────────────────

export type ExchangePublicTokenOutcome =
	| "connected"
	| "already_linked"
	| "partial";

export interface ExchangePublicTokenAccount {
	id: string;
	name: string;
	officialName: string | null;
	mask: string | null;
	type: string;
	subtype: string | null;
	currentBalance: number | null;
	institutionName: string;
}

export interface ExchangePublicTokenMetadata {
	institution?: { name?: string; institution_id?: string };
	accounts?: Array<{
		id: string;
		name: string;
		mask?: string | null;
		type: string;
		subtype?: string | null;
	}>;
}

export interface ExchangePublicTokenResult {
	plaidItemId: string;
	plaidItemDbId: string;
	institutionName: string;
	accountCount: number;
	addedCount: number;
	modifiedCount: number;
	removedCount: number;
	accounts: ExchangePublicTokenAccount[];
	outcome: ExchangePublicTokenOutcome;
	alreadyLinkedAccounts: ExchangePublicTokenAccount[];
	addedAccounts: ExchangePublicTokenAccount[];
}

/**
 * Exchanges a public_token from Plaid Link, persists the PlaidItem,
 * syncs accounts, and runs initial transaction sync.
 */
export async function exchangePublicTokenForItem(
	userId: string,
	publicToken: string,
	metadata?: ExchangePublicTokenMetadata,
): Promise<ExchangePublicTokenResult> {
	try {
		await collapseLiveDuplicatePlaidAccounts(db, userId);
	} catch (error) {
		logger.logError(
			"Failed to collapse live duplicate Plaid accounts before exchange",
			error,
			{
				feature: "plaid",
				operation: "exchangePublicToken",
				userId,
			},
		);
	}

	const institutionNameFromMetadata =
		metadata?.institution?.name ?? "Unknown Institution";
	const institutionIdFromMetadata =
		metadata?.institution?.institution_id ?? null;
	let alreadyLinkedBeforeExchange: Awaited<
		ReturnType<typeof classifySelectedAccounts>
	> = null;
	try {
		alreadyLinkedBeforeExchange = await classifySelectedAccounts({
			userId,
			institutionId: institutionIdFromMetadata,
			institutionName: institutionNameFromMetadata,
			accounts: metadata?.accounts ?? [],
		});
	} catch (error) {
		logger.logError("Failed to classify already-linked Plaid accounts", error, {
			feature: "plaid",
			operation: "exchangePublicToken",
			userId,
		});
	}
	if (
		alreadyLinkedBeforeExchange &&
		alreadyLinkedBeforeExchange.newAccounts.length === 0
	) {
		logger.info("Skipped Plaid token exchange; accounts already linked", {
			feature: "plaid",
			operation: "exchangePublicToken",
			userId,
			itemId: alreadyLinkedBeforeExchange.plaidItemDbId,
			alreadyLinkedCount: alreadyLinkedBeforeExchange.accounts.length,
		});
		return alreadyLinkedBeforeExchange.result;
	}

	const client = getPlaidClient();

	const exchangeResponse = await client.itemPublicTokenExchange({
		public_token: publicToken,
	});
	const { access_token: accessToken, item_id: plaidItemId } =
		exchangeResponse.data;

	let institutionName = metadata?.institution?.name ?? "Unknown Institution";
	let institutionId = metadata?.institution?.institution_id ?? null;

	if (!institutionName || institutionName === "Unknown Institution") {
		try {
			const itemResponse = await client.itemGet({ access_token: accessToken });
			institutionId = itemResponse.data.item.institution_id ?? institutionId;
			if (institutionId) {
				const instResponse = await client.institutionsGetById({
					institution_id: institutionId,
					country_codes: ["US" as import("plaid").CountryCode],
				});
				institutionName = instResponse.data.institution.name;
			}
		} catch (error) {
			const { code, message } = getPlaidErrorDetails(error);
			logger.warn("Failed to resolve Plaid institution metadata", {
				feature: "plaid",
				operation: "exchangePublicToken",
				userId,
				errorCode: code ?? undefined,
				errorMessage: message ?? undefined,
			});
		}
	}

	const accessTokenEncrypted = encrypt(accessToken);
	const savedItem = await db.plaidItem.upsert({
		where: { plaidItemId },
		create: {
			userId,
			plaidItemId,
			institutionId,
			institutionName,
			accessTokenEncrypted,
			requiresReconnect: false,
		},
		update: {
			institutionName,
			institutionId,
			accessTokenEncrypted,
			accessRevokedAt: null,
			requiresReconnect: false,
			lastErrorCode: null,
			lastErrorMessage: null,
		},
		select: { id: true, institutionName: true },
	});
	const plaidAccounts = await fetchPlaidAccountsForItem({
		userId,
		plaidItemDbId: savedItem.id,
		accessToken,
	});
	await adoptRevokedPlaidAccountsForInstitution(db, {
		userId,
		keepItemId: savedItem.id,
		institutionId,
		institutionName: savedItem.institutionName,
		plaidAccounts,
	});

	let siblingAccounts: Awaited<ReturnType<typeof loadLiveInstitutionAccounts>> =
		[];
	let postExchangeClassification = classifyIncomingAccounts({
		live: [],
		incoming: [],
	});
	try {
		siblingAccounts = await loadLiveInstitutionAccounts(db, {
			userId,
			institutionId,
			institutionName: savedItem.institutionName,
			excludeItemId: savedItem.id,
		});
		postExchangeClassification = classifyIncomingAccounts({
			live: siblingAccounts,
			incoming: plaidAccounts.map((account) => ({
				plaidAccountId: account.account_id,
				name: account.name,
				mask: account.mask ?? null,
				type: account.type,
				subtype: account.subtype ?? null,
			})),
		});
	} catch (error) {
		logger.logError(
			"Failed to classify already-linked Plaid accounts after exchange",
			error,
			{
				feature: "plaid",
				operation: "exchangePublicToken",
				userId,
				itemId: savedItem.id,
			},
		);
	}
	const alreadyLinkedAccounts = alreadyLinkedExchangeAccounts(
		siblingAccounts,
		postExchangeClassification.alreadyLinked,
	);

	const accountIdMap = await syncAccountsForItem({
		db,
		userId,
		plaidItemDbId: savedItem.id,
		accessToken,
		plaidAccounts,
	});

	if (accountIdMap.size === 0 && alreadyLinkedAccounts.length > 0) {
		try {
			await disconnectItem(savedItem.id, userId, db);
			logger.info("Disconnected duplicate Plaid item after exchange", {
				feature: "plaid",
				operation: "exchangePublicToken",
				userId,
				itemId: savedItem.id,
				alreadyLinkedCount: alreadyLinkedAccounts.length,
			});
		} catch (error) {
			logger.logError(
				"Failed to disconnect duplicate Plaid item after exchange",
				error,
				{
					feature: "plaid",
					operation: "exchangePublicToken",
					userId,
					itemId: savedItem.id,
				},
			);
		}
		const existingItem = siblingAccounts.find(
			(account) =>
				account.id ===
				postExchangeClassification.alreadyLinked[0]?.liveAccountId,
		);
		return alreadyLinkedResult({
			plaidItemId: existingItem?.itemPlaidItemId ?? plaidItemId,
			plaidItemDbId: existingItem?.plaidItemId ?? savedItem.id,
			institutionName:
				existingItem?.institutionName ?? savedItem.institutionName,
			alreadyLinkedAccounts,
		});
	}

	const { connectionId } = await ensureFinancialConnectionForPlaidItem({
		plaidItemDbId: savedItem.id,
	});
	const capabilities = await persistPlaidItemProductCapabilities({
		plaidItemDbId: savedItem.id,
		accessToken,
	});
	if (capabilities) {
		logger.info("Plaid item product capabilities after exchange", {
			feature: "plaid",
			operation: "exchangePublicToken",
			userId,
			itemId: savedItem.id,
			billedProducts: capabilities.billedProducts,
			availableProducts: capabilities.availableProducts,
			consentedProducts: capabilities.consentedProducts,
		});
	} else {
		logger.warn("Failed to persist Plaid item product capabilities", {
			feature: "plaid",
			operation: "exchangePublicToken",
			userId,
			itemId: savedItem.id,
		});
	}

	let syncResult = { addedCount: 0, modifiedCount: 0, removedCount: 0 };
	try {
		const result = await syncTransactionsForItem({
			userId,
			plaidItemDbId: savedItem.id,
			refreshBalances: false,
		});
		syncResult = result;
		await ensureFinancialConnectionForPlaidItem({
			plaidItemDbId: savedItem.id,
		});
	} catch (err) {
		const { code, message } = getPlaidErrorDetails(err);
		logger.error("Initial sync failed after token exchange", {
			feature: "plaid",
			operation: "exchangePublicToken",
			userId,
			itemId: savedItem.id,
			errorCode: code ?? undefined,
			errorMessage: message ?? undefined,
		});
	}

	try {
		await syncFinancialConnectionJob({
			connectionId,
			syncType: "holdings",
			trigger: "INITIAL_LINK",
			reason: "account_connection_created",
			skipRateLimit: true,
		});
	} catch (err) {
		logger.logError("Initial holdings sync failed after token exchange", err, {
			feature: "plaid",
			operation: "exchangePublicToken",
			userId,
			itemId: savedItem.id,
		});
	}

	try {
		await takeSnapshot(userId, db);
	} catch (err) {
		logger.logError("Snapshot failed after token exchange", err, {
			feature: "plaid",
			operation: "exchangePublicToken",
			userId,
		});
	}
	try {
		await recordSyncedAccountHistory(userId, db);
	} catch (err) {
		logger.logError("Account history failed after token exchange", err, {
			feature: "account-balance-history",
			operation: "exchangePublicToken",
			userId,
		});
	}
	const addedAccounts = Array.from(accountIdMap.values()).map((account) => ({
		...account,
		institutionName: savedItem.institutionName,
	}));
	const outcome: ExchangePublicTokenOutcome =
		alreadyLinkedAccounts.length > 0 ? "partial" : "connected";

	logger.info("Plaid token exchange completed", {
		feature: "plaid",
		operation: "exchangePublicToken",
		userId,
		itemId: savedItem.id,
		outcome,
		alreadyLinkedCount: alreadyLinkedAccounts.length,
		addedAccountCount: addedAccounts.length,
	});

	return {
		plaidItemId,
		plaidItemDbId: savedItem.id,
		institutionName: savedItem.institutionName,
		accountCount: accountIdMap.size,
		addedCount: syncResult.addedCount,
		modifiedCount: syncResult.modifiedCount,
		removedCount: syncResult.removedCount,
		accounts: addedAccounts,
		outcome,
		alreadyLinkedAccounts,
		addedAccounts,
	};
}

async function classifySelectedAccounts(input: {
	userId: string;
	institutionId: string | null;
	institutionName: string;
	accounts: NonNullable<ExchangePublicTokenMetadata["accounts"]>;
}): Promise<{
	newAccounts: NonNullable<ExchangePublicTokenMetadata["accounts"]>;
	accounts: ExchangePublicTokenAccount[];
	plaidItemDbId: string;
	result: ExchangePublicTokenResult;
} | null> {
	if (input.accounts.length === 0) return null;

	const live = await loadLiveInstitutionAccounts(db, {
		userId: input.userId,
		institutionId: input.institutionId,
		institutionName: input.institutionName,
	});
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

	const alreadyLinkedAccounts = alreadyLinkedExchangeAccounts(
		live,
		classified.alreadyLinked,
	);
	const first = live.find(
		(account) => account.id === classified.alreadyLinked[0]?.liveAccountId,
	);
	if (!first) return null;

	return {
		newAccounts: [],
		accounts: alreadyLinkedAccounts,
		plaidItemDbId: first.plaidItemId,
		result: alreadyLinkedResult({
			plaidItemId: first.itemPlaidItemId,
			plaidItemDbId: first.plaidItemId,
			institutionName: first.institutionName,
			alreadyLinkedAccounts,
		}),
	};
}

function alreadyLinkedExchangeAccounts(
	live: Awaited<ReturnType<typeof loadLiveInstitutionAccounts>>,
	matches: ReturnType<typeof classifyIncomingAccounts>["alreadyLinked"],
): ExchangePublicTokenAccount[] {
	const byId = new Map(live.map((account) => [account.id, account]));
	const accounts: ExchangePublicTokenAccount[] = [];
	for (const match of matches) {
		const liveAccount = byId.get(match.liveAccountId);
		if (!liveAccount) continue;
		accounts.push({
			id: liveAccount.id,
			name: liveAccount.name,
			officialName: liveAccount.officialName,
			mask: liveAccount.mask,
			type: liveAccount.type,
			subtype: liveAccount.subtype,
			currentBalance: liveAccount.currentBalance,
			institutionName: liveAccount.institutionName,
		});
	}
	return accounts;
}

function alreadyLinkedResult(input: {
	plaidItemId: string;
	plaidItemDbId: string;
	institutionName: string;
	alreadyLinkedAccounts: ExchangePublicTokenAccount[];
}): ExchangePublicTokenResult {
	return {
		plaidItemId: input.plaidItemId,
		plaidItemDbId: input.plaidItemDbId,
		institutionName: input.institutionName,
		accountCount: 0,
		addedCount: 0,
		modifiedCount: 0,
		removedCount: 0,
		accounts: input.alreadyLinkedAccounts,
		outcome: "already_linked",
		alreadyLinkedAccounts: input.alreadyLinkedAccounts,
		addedAccounts: [],
	};
}

// ─── Incremental sync entry points ───────────────────────────────────────────

export async function runSyncForItem(
	itemId: string,
	userId: string,
	options?: {
		refreshBalances?: boolean;
		reason?: "manual_sync_button" | "reconnect";
	},
): Promise<ConnectionSyncResult> {
	const item = await db.plaidItem.findFirstOrThrow({
		where: { id: itemId, userId },
		select: { id: true },
	});
	const { connectionId } = await ensureFinancialConnectionForPlaidItem({
		plaidItemDbId: item.id,
	});

	if (options?.refreshBalances ?? true) {
		const result = await syncFinancialConnectionJob({
			connectionId,
			syncType: "cached_manual",
			reason: options?.reason ?? "manual_sync_button",
			trigger: "USER_REFRESH",
		});
		return (
			result ?? {
				success: true,
				addedCount: 0,
				modifiedCount: 0,
				removedCount: 0,
				accountCount: 0,
				balancesRefreshed: false,
				holdingsSynced: false,
			}
		);
	}

	const txResult = await syncFinancialConnectionJob({
		connectionId,
		syncType: "transactions",
		reason: options?.reason ?? "manual_sync_button",
		trigger: "USER_REFRESH",
	});
	return (
		txResult ?? {
			success: true,
			addedCount: 0,
			modifiedCount: 0,
			removedCount: 0,
			accountCount: 0,
			balancesRefreshed: false,
			holdingsSynced: false,
		}
	);
}

/**
 * Reports whether Plaid has finished delivering the full transaction history
 * for an item. Post-connect UIs poll this to hold their "syncing" dialog until
 * the whole year of data is imported, not just the initial ~30 days.
 *
 * Pending `/transactions/sync` pages are drained on every poll, including while
 * Plaid is still on INITIAL_UPDATE_COMPLETE. Completion requires
 * HISTORICAL_UPDATE_COMPLETE and an empty post-drain probe.
 *
 * Callers poll this sequentially, so the drain takes the ordinary blocking item
 * lock: a poll that overlaps a webhook sync waits for it rather than racing it.
 */
export async function getHistoricalImportStatusForItem(
	itemId: string,
	userId: string,
): Promise<HistoricalImportStatus> {
	const item = await db.plaidItem.findFirstOrThrow({
		where: { id: itemId, userId },
		select: { id: true, cursor: true, accessTokenEncrypted: true },
	});
	const hasCursor = item.cursor != null && item.cursor.length > 0;
	const coverage = await loadTransactionCoverageForItem({
		userId,
		plaidItemDbId: item.id,
	});
	const report = (input: {
		status: HistoricalImportStatus;
		drained: boolean;
		summary?: HistoricalImportProbeSummary;
	}): HistoricalImportStatus => {
		logHistoricalImportStatus({
			userId,
			itemId,
			hasCursor,
			hasAccessToken: item.accessTokenEncrypted != null,
			drained: input.drained,
			shouldDrain: input.summary?.shouldDrain,
			hasMore: input.summary?.hasMore,
			probeAddedCount: input.summary?.probeAddedCount,
			probeModifiedCount: input.summary?.probeModifiedCount,
			probeRemovedCount: input.summary?.probeRemovedCount,
			...input.status,
		});
		return input.status;
	};

	if (!item.accessTokenEncrypted) {
		return report({
			drained: false,
			status: emptyHistoricalImportStatus(coverage),
		});
	}

	const client = getPlaidClient();
	const accessToken = decrypt(item.accessTokenEncrypted);
	const probeResult = await probeTransactionsSync({
		client,
		accessToken,
		cursor: item.cursor,
		userId,
		itemId,
	});
	if (probeResult.kind === "mutation") {
		return report({
			drained: false,
			status: emptyHistoricalImportStatus({
				...coverage,
				updateStatus: "MUTATION_DURING_PAGINATION",
				pendingUpdates: true,
			}),
		});
	}

	const summary = summarizeHistoricalImportProbe(probeResult.data);
	if (!summary.shouldDrain) {
		return report({
			drained: false,
			summary,
			status: assembleHistoricalImportStatus({ summary, coverage }),
		});
	}

	const drainSucceeded = await drainPendingTransactionPages({
		userId,
		plaidItemDbId: item.id,
		itemId,
	});
	const coverageAfterDrain = await loadTransactionCoverageForItem({
		userId,
		plaidItemDbId: item.id,
	});
	if (!drainSucceeded) {
		return report({
			drained: false,
			summary,
			status: emptyHistoricalImportStatus({
				...coverageAfterDrain,
				updateStatus: summary.updateStatus,
				pendingUpdates: true,
			}),
		});
	}

	const refreshedItem = await db.plaidItem.findFirstOrThrow({
		where: { id: item.id, userId },
		select: { cursor: true },
	});
	const reprobe = await probeTransactionsSync({
		client,
		accessToken,
		cursor: refreshedItem.cursor,
		userId,
		itemId,
	});
	if (reprobe.kind === "mutation") {
		return report({
			drained: true,
			summary,
			status: emptyHistoricalImportStatus({
				...coverageAfterDrain,
				updateStatus: "MUTATION_DURING_PAGINATION",
				pendingUpdates: true,
			}),
		});
	}

	const summaryAfterDrain = summarizeHistoricalImportProbe(reprobe.data);
	return report({
		drained: true,
		summary: summaryAfterDrain,
		status: assembleHistoricalImportStatus({
			summary: summaryAfterDrain,
			coverage: coverageAfterDrain,
		}),
	});
}

/**
 * A poll must never fail the whole status request: a broken item would
 * otherwise return 500 every 3 seconds for the length of the connect dialog.
 * Failures are reported as "still pending" so the UI falls through to its
 * background-import state.
 */
async function drainPendingTransactionPages(input: {
	userId: string;
	plaidItemDbId: string;
	itemId: string;
}): Promise<boolean> {
	try {
		await syncTransactionsForItem({
			userId: input.userId,
			plaidItemDbId: input.plaidItemDbId,
			refreshBalances: false,
		});
		return true;
	} catch (err) {
		logger.error("Import status drain failed", {
			feature: "plaid",
			operation: "getImportStatus",
			userId: input.userId,
			itemId: input.itemId,
			error: err instanceof Error ? err.message : String(err),
		});
		return false;
	}
}

async function loadTransactionCoverageForItem(input: {
	userId: string;
	plaidItemDbId: string;
}) {
	const aggregate = await db.transaction.aggregate({
		where: {
			userId: input.userId,
			plaidItemId: input.plaidItemDbId,
			removedAt: null,
		},
		_count: { _all: true },
		_min: { date: true },
	});
	return summarizeTransactionCoverage({
		transactionCount: aggregate._count._all,
		oldestTransactionDate: aggregate._min.date,
	});
}

async function probeTransactionsSync(input: {
	client: ReturnType<typeof getPlaidClient>;
	accessToken: string;
	cursor: string | null;
	userId: string;
	itemId: string;
}): Promise<
	| {
			kind: "ok";
			data: Awaited<
				ReturnType<ReturnType<typeof getPlaidClient>["transactionsSync"]>
			>["data"];
	  }
	| { kind: "mutation" }
> {
	try {
		const probe = await input.client.transactionsSync({
			access_token: input.accessToken,
			cursor: input.cursor ?? undefined,
			count: 1,
			options: { include_original_description: true },
		});
		return { kind: "ok", data: probe.data };
	} catch (err) {
		if (isPlaidMutationDuringPagination(err)) {
			logger.warn(
				"Import status probe deferred because Plaid mutated mid-pagination",
				{
					feature: "plaid",
					operation: "getImportStatus",
					userId: input.userId,
					itemId: input.itemId,
				},
			);
			return { kind: "mutation" };
		}
		throw err;
	}
}

function logHistoricalImportStatus(fields: {
	userId: string;
	itemId: string;
	hasCursor: boolean;
	hasAccessToken: boolean;
	updateStatus?: string;
	hasMore?: boolean;
	probeAddedCount?: number;
	probeModifiedCount?: number;
	probeRemovedCount?: number;
	shouldDrain?: boolean;
	drained: boolean;
	pendingUpdates?: boolean;
	transactionCount?: number;
	oldestTransactionDate?: string | null;
	coveredDays?: number;
	daysRequested?: number;
	historicalImportComplete: boolean;
}): void {
	logger.info("Plaid historical import status", {
		event: "plaid.historical_import_status",
		feature: "plaid",
		operation: "getImportStatus",
		...fields,
	});
}

/** Refreshes account balances and metadata for a single item. */
export async function refreshAccountsForItem(
	itemId: string,
	userId: string,
): Promise<number> {
	const item = await db.plaidItem.findFirstOrThrow({
		where: { id: itemId, userId },
		select: { accessTokenEncrypted: true, accessRevokedAt: true },
	});
	if (!item.accessTokenEncrypted || item.accessRevokedAt) {
		throw new Error("This institution must be linked again to resume sync");
	}
	const accessToken = decrypt(item.accessTokenEncrypted);
	const map = await syncAccountsForItem({
		db,
		userId,
		plaidItemDbId: itemId,
		accessToken,
	});
	await ensureFinancialConnectionForPlaidItem({ plaidItemDbId: itemId });
	return map.size;
}

// ─── Reconnect ────────────────────────────────────────────────────────────────

export async function runReconnectForItem(
	itemId: string,
	userId: string,
): Promise<void> {
	const item = await db.plaidItem.findFirstOrThrow({
		where: { id: itemId, userId },
		select: { id: true },
	});

	await db.plaidItem.update({
		where: { id: item.id },
		data: {
			requiresReconnect: false,
			lastErrorCode: null,
			lastErrorMessage: null,
		},
	});

	await runSyncForItem(item.id, userId, {
		refreshBalances: true,
		reason: "reconnect",
	});
}
