import type { SyncTrigger } from "@moat/financial-data-providers";
import { logger } from "~/lib/logger";
import { db } from "~/server/db";
import { recordSyncedAccountHistory } from "./account-balance-history.service";
import { takeSnapshot } from "./balance-snapshot.service";
import { fetchFinicityAccountsAndTransactions } from "./finicity-sync.client";
import {
	fetchMxAccountsAndTransactions,
	readMxConnectionContext,
} from "./mx-sync.client";
import { importNormalizedFinancialData } from "./normalized-financial-import.service";
import {
	beginProviderSyncAttempt,
	completeProviderSyncAttempt,
} from "./provider-sync-attempt.service";
import type { ProviderEndpointCall, SyncReason, SyncType } from "./sync-types";

export async function syncMxOrFinicityConnection(input: {
	connectionId: string;
	userId: string;
	syncType: SyncType;
	trigger: SyncTrigger;
	reason: SyncReason;
	webhookEventId?: string;
}) {
	const connection = await db.financialConnection.findFirst({
		where: { id: input.connectionId, userId: input.userId },
	});
	if (!connection || connection.status === "DISCONNECTED") {
		return { skipped: true as const };
	}

	const callLog: ProviderEndpointCall[] = [];
	const attempt = await beginProviderSyncAttempt({
		connectionId: connection.id,
		provider: connection.provider,
		trigger: input.trigger,
		userId: input.userId,
		syncType: input.syncType,
		syncMode: "cached",
		reason: input.reason,
		webhookEventId: input.webhookEventId,
	});

	try {
		if (connection.provider === "MX") {
			await syncMxConnection({
				connection,
				syncType: input.syncType,
				callLog,
			});
		} else if (connection.provider === "FINICITY") {
			await syncFinicityConnection({
				connection,
				syncType: input.syncType,
				callLog,
			});
		} else {
			throw new Error(
				`Unsupported provider adapter sync: ${connection.provider}`,
			);
		}

		const now = new Date();
		await db.financialConnection.update({
			where: { id: connection.id },
			data: {
				status: "ACTIVE",
				lastSuccessfulSyncAt: now,
				lastErrorAt: null,
				lastErrorCode: null,
				lastErrorMessage: null,
				consecutiveFailures: 0,
				...(input.syncType === "cached_balances"
					? { lastBalanceSyncAt: now }
					: { lastTransactionSyncAt: now }),
			},
		});

		await completeProviderSyncAttempt({
			attemptId: attempt.id,
			status: "SUCCESS",
			endpointsCalled: callLog,
			providerRequestCount: callLog.length,
		});

		try {
			await takeSnapshot(input.userId, db);
		} catch (error) {
			logger.logError("Snapshot failed after provider adapter sync", error, {
				feature: "financial_connections",
				operation: "syncMxOrFinicityConnection",
				userId: input.userId,
				connectionId: connection.id,
			});
		}
		try {
			await recordSyncedAccountHistory(input.userId, db);
		} catch (error) {
			logger.logError(
				"Account history failed after provider adapter sync",
				error,
				{
					feature: "account-balance-history",
					operation: "syncMxOrFinicityConnection",
					userId: input.userId,
					connectionId: connection.id,
				},
			);
		}

		return { skipped: false as const };
	} catch (error) {
		await db.financialConnection.update({
			where: { id: connection.id },
			data: {
				lastErrorAt: new Date(),
				lastErrorMessage:
					error instanceof Error ? error.message : "Provider sync failed",
				consecutiveFailures: { increment: 1 },
			},
		});
		await completeProviderSyncAttempt({
			attemptId: attempt.id,
			status: "FAILED",
			endpointsCalled: callLog,
			providerRequestCount: callLog.length,
			errorMessage:
				error instanceof Error ? error.message : "Provider sync failed",
		});
		throw error;
	}
}

async function syncMxConnection(input: {
	connection: {
		id: string;
		userId: string;
		providerConnectionId: string;
		providerCustomerId: string | null;
		metadata: unknown;
		canonicalInstitutionId: string | null;
	};
	syncType: SyncType;
	callLog: ProviderEndpointCall[];
}) {
	const clientId = process.env.MX_CLIENT_ID;
	const apiKey = process.env.MX_API_KEY;
	if (!clientId || !apiKey) {
		throw new Error("MX sync is not configured");
	}

	const context = readMxConnectionContext({
		providerConnectionId: input.connection.providerConnectionId,
		providerCustomerId: input.connection.providerCustomerId,
		metadata: input.connection.metadata,
	});
	if (!context) {
		throw new Error("MX connection is missing user or member context");
	}

	const startedAt = Date.now();
	const result = await fetchMxAccountsAndTransactions({
		config: {
			baseUrl: process.env.MX_BASE_URL,
			clientId,
			apiKey,
		},
		context,
	});
	input.callLog.push({
		endpoint: "/mx/members/accounts+transactions",
		costCategory: "unknown_contract_dependent",
		durationMs: Date.now() - startedAt,
		status: "success",
	});

	if (input.syncType === "cached_balances") {
		await importNormalizedFinancialData({
			userId: input.connection.userId,
			connectionId: input.connection.id,
			canonicalInstitutionId: input.connection.canonicalInstitutionId,
			provider: "MX",
			accounts: result.accounts,
			transactions: { added: [], modified: [], removed: [] },
		});
		return;
	}

	await importNormalizedFinancialData({
		userId: input.connection.userId,
		connectionId: input.connection.id,
		canonicalInstitutionId: input.connection.canonicalInstitutionId,
		provider: "MX",
		accounts: result.accounts,
		transactions: result.transactions,
	});
}

async function syncFinicityConnection(input: {
	connection: {
		id: string;
		userId: string;
		providerCustomerId: string | null;
		canonicalInstitutionId: string | null;
	};
	syncType: SyncType;
	callLog: ProviderEndpointCall[];
}) {
	const partnerId = process.env.FINICITY_PARTNER_ID;
	const partnerSecret = process.env.FINICITY_PARTNER_SECRET;
	const appKey = process.env.FINICITY_APP_KEY;
	if (!partnerId || !partnerSecret || !appKey) {
		throw new Error("Finicity sync is not configured");
	}
	if (!input.connection.providerCustomerId) {
		throw new Error("Finicity connection is missing customer id");
	}

	const startedAt = Date.now();
	const result = await fetchFinicityAccountsAndTransactions({
		config: {
			baseUrl: process.env.FINICITY_BASE_URL,
			partnerId,
			partnerSecret,
			appKey,
		},
		customerId: input.connection.providerCustomerId,
	});
	input.callLog.push({
		endpoint: "/finicity/customers/accounts+transactions",
		costCategory: "unknown_contract_dependent",
		durationMs: Date.now() - startedAt,
		status: "success",
	});

	if (input.syncType === "cached_balances") {
		await importNormalizedFinancialData({
			userId: input.connection.userId,
			connectionId: input.connection.id,
			canonicalInstitutionId: input.connection.canonicalInstitutionId,
			provider: "FINICITY",
			accounts: result.accounts,
			transactions: { added: [], modified: [], removed: [] },
		});
		return;
	}

	await importNormalizedFinancialData({
		userId: input.connection.userId,
		connectionId: input.connection.id,
		canonicalInstitutionId: input.connection.canonicalInstitutionId,
		provider: "FINICITY",
		accounts: result.accounts,
		transactions: result.transactions,
	});
}
