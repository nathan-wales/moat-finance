import type { SqliteDbClient } from "@moat/db-sqlite";
import {
	buildHoldingRowsByAccount,
	type HoldingRow,
	isPlaidInvestmentsProductUnavailable,
	shouldSyncPlaidInvestmentsHoldings,
} from "@moat/financial-data-providers/plaid-investments";
import { livePlaidAccessToken } from "./access-state";
import { getPlaidClient } from "./client";
import { getPlaidErrorDetails } from "./errors";
import { persistPlaidItemProductCapabilities } from "./persist-item-capabilities";
import { parseStoredPlaidProductCapabilities } from "./product-capabilities";
import { decryptAccessToken } from "./token-storage";

export async function syncHoldingsForItem(params: {
	db: SqliteDbClient;
	userId: string;
	plaidItemDbId: string;
	accessToken: string;
}): Promise<{ holdingCount: number; accountCount: number }> {
	const { db, userId, plaidItemDbId, accessToken } = params;
	const client = getPlaidClient();
	const now = new Date();

	const response = await client.investmentsHoldingsGet({
		access_token: accessToken,
	});

	const holdings = response.data.holdings;
	const securities = new Map(
		response.data.securities.map((security) => [
			security.security_id,
			security,
		]),
	);

	const rowsByAccountId = buildHoldingRowsByAccount(holdings, securities);

	const disabledInvestmentAccounts = (await db.plaidAccount.findMany({
		where: {
			plaidItemId: plaidItemDbId,
			type: "investment",
			syncEnabled: false,
		},
		select: { id: true },
	})) as Array<{ id: string }>;
	const syncedAccountDbIds: string[] = [];
	const keepHoldingAccountIds: string[] = disabledInvestmentAccounts.map(
		(account) => account.id,
	);
	for (const [plaidAccountId, rows] of rowsByAccountId) {
		const account = (await db.plaidAccount.findFirst({
			where: {
				plaidItemId: plaidItemDbId,
				plaidAccountId,
				type: "investment",
			},
			select: { id: true, syncEnabled: true },
		})) as { id: string; syncEnabled: boolean } | null;
		if (!account) continue;
		keepHoldingAccountIds.push(account.id);
		if (account.syncEnabled === false) continue;

		await db.plaidAccount.update({
			where: { id: account.id },
			data: {
				currentBalance: rows.reduce((total, row) => total + row.value, 0),
				lastBalanceSyncAt: now,
				isActive: true,
			},
		});
		await replaceAccountHoldings({
			db,
			userId,
			plaidAccountDbId: account.id,
			rows,
			syncedAt: now,
		});
		syncedAccountDbIds.push(account.id);
	}

	await db.plaidHolding.deleteMany({
		where: {
			userId,
			plaidAccount: { plaidItemId: plaidItemDbId },
			plaidAccountId: { notIn: keepHoldingAccountIds },
		},
	});

	await db.plaidItem.update({
		where: { id: plaidItemDbId },
		data: { lastHoldingsSyncAt: now },
	});

	return {
		holdingCount: holdings.length,
		accountCount: syncedAccountDbIds.length,
	};
}

async function replaceAccountHoldings(input: {
	db: SqliteDbClient;
	userId: string;
	plaidAccountDbId: string;
	rows: HoldingRow[];
	syncedAt: Date;
}): Promise<void> {
	const { db, userId, plaidAccountDbId, rows, syncedAt } = input;
	await db.plaidHolding.deleteMany({
		where: { plaidAccountId: plaidAccountDbId },
	});
	if (rows.length === 0) return;
	await db.plaidHolding.createMany({
		data: rows.map((row) => ({
			...row,
			userId,
			plaidAccountId: plaidAccountDbId,
			syncedAt,
		})),
	});
}

/**
 * Capability-gated holdings sync. Soft-skips when Investments is neither
 * consented nor billed, or the Item rejects the product, then persists
 * /item/get capabilities.
 */
export async function maybeSyncHoldingsForItem(params: {
	db: SqliteDbClient;
	userId: string;
	plaidItemDbId: string;
}): Promise<boolean> {
	const { db, userId, plaidItemDbId } = params;
	const item = (await db.plaidItem.findFirst({
		where: { id: plaidItemDbId, userId },
		select: {
			id: true,
			accessTokenEncrypted: true,
			accessRevokedAt: true,
			requiresReconnect: true,
			billedProductsJson: true,
			availableProductsJson: true,
			consentedProductsJson: true,
		},
	})) as {
		id: string;
		accessTokenEncrypted: Buffer | null;
		accessRevokedAt: Date | null;
		requiresReconnect: boolean;
		billedProductsJson: string;
		availableProductsJson: string;
		consentedProductsJson: string;
	} | null;

	const accessTokenEncrypted = item ? livePlaidAccessToken(item) : null;
	if (!item || item.requiresReconnect || !accessTokenEncrypted) return false;

	const capabilities = parseStoredPlaidProductCapabilities(item);
	if (!shouldSyncPlaidInvestmentsHoldings(capabilities)) {
		console.warn(
			"[plaid] Skipping holdings sync — Investments not consented or billed",
			{
				billedProducts: capabilities.billedProducts,
				availableProducts: capabilities.availableProducts,
				consentedProducts: capabilities.consentedProducts,
			},
		);
		return false;
	}

	const accessToken = decryptAccessToken(accessTokenEncrypted);
	try {
		await syncHoldingsForItem({
			db,
			userId,
			plaidItemDbId: item.id,
			accessToken,
		});
		await persistPlaidItemProductCapabilities({
			db,
			plaidItemDbId: item.id,
			accessToken,
		});
		return true;
	} catch (error) {
		if (isPlaidInvestmentsProductUnavailable(error)) {
			await persistPlaidItemProductCapabilities({
				db,
				plaidItemDbId: item.id,
				accessToken,
			});
			const { code } = getPlaidErrorDetails(error);
			console.warn(
				"[plaid] Skipping holdings sync — Investments product not available",
				{ code: code ?? "unknown" },
			);
			return false;
		}
		throw error;
	}
}
