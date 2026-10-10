import {
	type CreateLinkSessionResult,
	createAccountFingerprint,
	createTransactionDedupeFingerprint,
	type FinancialDataProvider,
	type FinancialProduct,
	FinicityAdapter,
	MxAdapter,
} from "@moat/financial-data-providers";
import { logger } from "~/lib/logger";
import { db } from "~/server/db";
import { encrypt } from "~/server/lib/encryption";
import { createPlaidLinkTokenForUser } from "~/server/plaid/link";
import { chooseProviderForInstitution } from "./institution-catalog.service";

export type LinkSessionResponse = CreateLinkSessionResult & {
	routing: {
		provider: FinancialDataProvider;
		reason: string;
		confidence: "MANUAL" | "HIGH" | "MEDIUM" | "LOW";
		availableProviders: FinancialDataProvider[];
	};
};

export async function createFinancialConnectionLinkSession(input: {
	userId: string;
	canonicalInstitutionId: string;
	provider?: FinancialDataProvider;
	products: FinancialProduct[];
}): Promise<LinkSessionResponse> {
	const routing = await chooseProviderForInstitution({
		canonicalInstitutionId: input.canonicalInstitutionId,
		requestedProvider: input.provider,
		products: input.products,
		userId: input.userId,
	});

	const provider = resolveEnabledProvider({
		provider: routing.provider,
		requestedProvider: input.provider,
	});

	if (provider === "PLAID") {
		const result = await createPlaidLinkTokenForUser({ userId: input.userId });
		return {
			provider: "PLAID",
			linkToken: result.link_token,
			expiration: result.expiration,
			routing: { ...routing, provider },
		};
	}

	if (provider === "MX") {
		const adapter = new MxAdapter({
			baseUrl: process.env.MX_BASE_URL,
			clientId: process.env.MX_CLIENT_ID,
			apiKey: process.env.MX_API_KEY,
			connectWidgetUrl: process.env.MX_CONNECT_WIDGET_URL,
			webhookUsername: process.env.MX_WEBHOOK_BASIC_AUTH_USERNAME,
			webhookPassword: process.env.MX_WEBHOOK_BASIC_AUTH_PASSWORD,
		});
		const session = await adapter.createLinkSession({
			userId: input.userId,
			canonicalInstitutionId: input.canonicalInstitutionId,
			products: input.products,
		});
		return { ...session, routing: { ...routing, provider } };
	}

	const adapter = new FinicityAdapter({
		baseUrl: process.env.FINICITY_BASE_URL,
		partnerId: process.env.FINICITY_PARTNER_ID,
		partnerSecret: process.env.FINICITY_PARTNER_SECRET,
		appKey: process.env.FINICITY_APP_KEY,
		connectUrl: process.env.FINICITY_CONNECT_URL,
		webhookSecret: process.env.FINICITY_WEBHOOK_SECRET,
	});
	const session = await adapter.createLinkSession({
		userId: input.userId,
		canonicalInstitutionId: input.canonicalInstitutionId,
		products: input.products,
	});
	return { ...session, routing: { ...routing, provider } };
}

export async function ensureFinancialConnectionForPlaidItem(input: {
	plaidItemDbId: string;
}): Promise<{ connectionId: string }> {
	const item = await db.plaidItem.findUnique({
		where: { id: input.plaidItemDbId },
		include: { plaidAccounts: true },
	});
	if (!item) throw new Error("Plaid item not found");

	const accessRevoked =
		Boolean(item.accessRevokedAt) || !item.accessTokenEncrypted;
	const connectionStatus = accessRevoked
		? "DISCONNECTED"
		: item.requiresReconnect
			? "REAUTH_REQUIRED"
			: item.lastErrorCode
				? "DEGRADED"
				: "ACTIVE";

	const connection = await db.financialConnection.upsert({
		where: {
			provider_providerConnectionId: {
				provider: "PLAID",
				providerConnectionId: item.plaidItemId,
			},
		},
		create: {
			userId: item.userId,
			provider: "PLAID",
			providerInstitutionId: item.institutionId,
			providerConnectionId: item.plaidItemId,
			providerAccessTokenEncrypted: accessRevoked
				? null
				: item.accessTokenEncrypted,
			syncCursorEncrypted: accessRevoked ? null : encryptNullable(item.cursor),
			status: connectionStatus,
			lastSuccessfulSyncAt: item.lastSuccessfulSyncAt,
			lastTransactionSyncAt: item.lastTransactionSyncAt,
			lastBalanceSyncAt: item.lastBalanceSyncAt,
			lastRealtimeBalanceSyncAt: item.lastRealtimeBalanceSyncAt ?? null,
			lastHoldingsSyncAt: item.lastHoldingsSyncAt ?? null,
			lastErrorAt: item.lastErrorCode ? item.updatedAt : null,
			lastErrorCode: item.lastErrorCode,
			lastErrorMessage: item.lastErrorMessage,
			consecutiveFailures: item.lastErrorCode ? 1 : 0,
			metadata: {
				legacyPlaidItemDbId: item.id,
				institutionName: item.institutionName,
			},
		},
		update: {
			providerInstitutionId: item.institutionId,
			providerAccessTokenEncrypted: accessRevoked
				? null
				: item.accessTokenEncrypted,
			syncCursorEncrypted: accessRevoked ? null : encryptNullable(item.cursor),
			status: connectionStatus,
			lastSuccessfulSyncAt: item.lastSuccessfulSyncAt,
			lastTransactionSyncAt: item.lastTransactionSyncAt,
			lastBalanceSyncAt: item.lastBalanceSyncAt,
			lastRealtimeBalanceSyncAt: item.lastRealtimeBalanceSyncAt ?? null,
			lastHoldingsSyncAt: item.lastHoldingsSyncAt ?? null,
			lastErrorAt: item.lastErrorCode ? item.updatedAt : null,
			lastErrorCode: item.lastErrorCode,
			lastErrorMessage: item.lastErrorMessage,
			consecutiveFailures: item.lastErrorCode ? 1 : 0,
			metadata: {
				legacyPlaidItemDbId: item.id,
				institutionName: item.institutionName,
			},
		},
		select: { id: true },
	});

	for (const account of item.plaidAccounts) {
		const accountFingerprint = createAccountFingerprint({
			canonicalInstitutionId: null,
			name: account.officialName ?? account.name,
			type: account.type,
			subtype: account.subtype,
			mask: account.mask,
			currency: account.currency,
		});
		const financialAccount = await db.financialAccount.upsert({
			where: {
				connectionId_providerAccountId: {
					connectionId: connection.id,
					providerAccountId: account.plaidAccountId,
				},
			},
			create: {
				userId: account.userId,
				connectionId: connection.id,
				provider: "PLAID",
				providerAccountId: account.plaidAccountId,
				name: account.name,
				officialName: account.officialName,
				mask: account.mask,
				type: account.type,
				subtype: account.subtype,
				currentBalance: account.currentBalance,
				availableBalance: account.availableBalance,
				currency: account.currency,
				accountFingerprint,
				isActive: account.isActive,
				syncEnabled: account.syncEnabled,
				lastBalanceSyncAt: account.lastBalanceSyncAt,
				transactionsSyncedThrough: account.transactionsSyncedThrough,
			},
			update: {
				name: account.name,
				officialName: account.officialName,
				mask: account.mask,
				type: account.type,
				subtype: account.subtype,
				currentBalance: account.currentBalance,
				availableBalance: account.availableBalance,
				currency: account.currency,
				accountFingerprint,
				isActive: account.isActive,
				lastBalanceSyncAt: account.lastBalanceSyncAt,
				...(account.transactionsSyncedThrough
					? { transactionsSyncedThrough: account.transactionsSyncedThrough }
					: {}),
			},
			select: { id: true, accountFingerprint: true },
		});

		await db.transaction.updateMany({
			where: {
				userId: item.userId,
				plaidItemId: item.id,
				plaidAccountId: account.id,
				OR: [
					{ financialConnectionId: null },
					{ financialAccountId: null },
					{ dataProvider: null },
				],
			},
			data: {
				financialConnectionId: connection.id,
				financialAccountId: financialAccount.id,
				dataProvider: "PLAID",
				providerAccountId: account.plaidAccountId,
				accountFingerprint: financialAccount.accountFingerprint,
			},
		});

		await backfillPlaidTransactionProviderMetadata({
			userId: item.userId,
			plaidItemDbId: item.id,
			plaidAccountDbId: account.id,
			financialConnectionId: connection.id,
			financialAccountId: financialAccount.id,
			providerAccountId: account.plaidAccountId,
			accountFingerprint: financialAccount.accountFingerprint,
		});
	}

	await db.transaction.updateMany({
		where: {
			userId: item.userId,
			plaidItemId: item.id,
			dataProvider: null,
		},
		data: {
			financialConnectionId: connection.id,
			dataProvider: "PLAID",
		},
	});

	return { connectionId: connection.id };
}

async function backfillPlaidTransactionProviderMetadata(input: {
	userId: string;
	plaidItemDbId: string;
	plaidAccountDbId: string;
	financialConnectionId: string;
	financialAccountId: string;
	providerAccountId: string;
	accountFingerprint: string | null;
}): Promise<void> {
	// Repair pass for legacy rows imported before provider metadata was folded
	// into the main Plaid sync upsert. New imports should not need this path.
	const transactions = await db.transaction.findMany({
		where: {
			userId: input.userId,
			plaidItemId: input.plaidItemDbId,
			plaidAccountId: input.plaidAccountDbId,
			externalTransactionId: { not: null },
			OR: [{ providerTransactionId: null }, { dedupeFingerprint: null }],
		},
		select: {
			id: true,
			externalTransactionId: true,
			amount: true,
			date: true,
			merchantName: true,
			description: true,
			pending: true,
			raw: true,
		},
	});

	for (const transaction of transactions) {
		const providerTransactionId = transaction.externalTransactionId;
		if (!providerTransactionId) continue;

		await db.transaction.update({
			where: { id: transaction.id },
			data: {
				financialConnectionId: input.financialConnectionId,
				financialAccountId: input.financialAccountId,
				dataProvider: "PLAID",
				providerAccountId: input.providerAccountId,
				providerTransactionId,
				accountFingerprint: input.accountFingerprint,
				dedupeFingerprint: createTransactionDedupeFingerprint({
					accountFingerprint: input.accountFingerprint,
					amount: Number(transaction.amount),
					date: transaction.date,
					merchantName: transaction.merchantName,
					description: transaction.description,
					pending: transaction.pending,
				}),
				rawProviderPayload: transaction.raw ?? undefined,
			},
		});
	}
}

function encryptNullable(value: string | null): string | null {
	return value ? encrypt(value) : null;
}

function resolveEnabledProvider(input: {
	provider: FinancialDataProvider;
	requestedProvider?: FinancialDataProvider;
}): FinancialDataProvider {
	if (input.provider === "PLAID") return "PLAID";

	const enabled =
		input.provider === "MX"
			? process.env.ENABLE_MX_CONNECTIONS === "true"
			: process.env.ENABLE_FINICITY_CONNECTIONS === "true";

	if (enabled) return input.provider;
	if (input.requestedProvider) {
		throw new Error(`${input.provider} connections are not enabled yet`);
	}

	logger.info(
		"Provider routing fell back to Plaid because provider is disabled",
		{
			feature: "financial_connections",
			operation: "createLinkSession",
			provider: input.provider,
		},
	);
	return "PLAID";
}
