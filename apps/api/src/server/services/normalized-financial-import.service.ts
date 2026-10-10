import {
	createAccountFingerprint,
	createTransactionDedupeFingerprint,
	type FinancialDataProvider,
	type ImportNormalizedFinancialDataInput,
	type ImportNormalizedFinancialDataResult,
} from "@moat/financial-data-providers";
import { db } from "~/server/db";
import type { Prisma } from "../../../generated/prisma";

export async function importNormalizedFinancialData(
	input: ImportNormalizedFinancialDataInput,
): Promise<ImportNormalizedFinancialDataResult> {
	const accountIdByProviderId = new Map<
		string,
		{ id: string; fingerprint: string }
	>();

	await db.$transaction(async (tx) => {
		for (const account of input.accounts) {
			const accountFingerprint = createAccountFingerprint({
				canonicalInstitutionId: input.canonicalInstitutionId,
				name: account.officialName ?? account.name,
				type: account.type,
				subtype: account.subtype,
				mask: account.mask,
				currency: account.currency ?? "USD",
			});
			const row = await tx.financialAccount.upsert({
				where: {
					connectionId_providerAccountId: {
						connectionId: input.connectionId,
						providerAccountId: account.providerAccountId,
					},
				},
				create: {
					userId: input.userId,
					connectionId: input.connectionId,
					provider: input.provider,
					canonicalInstitutionId: input.canonicalInstitutionId,
					providerAccountId: account.providerAccountId,
					name: account.name,
					officialName: account.officialName ?? null,
					mask: account.mask ?? null,
					type: account.type,
					subtype: account.subtype ?? null,
					currentBalance: account.currentBalance ?? null,
					availableBalance: account.availableBalance ?? null,
					currency: account.currency ?? "USD",
					accountFingerprint,
					rawProviderPayload: toJson(account.rawProviderPayload),
					isActive: true,
					lastBalanceSyncAt: new Date(),
				},
				update: {
					name: account.name,
					officialName: account.officialName ?? null,
					mask: account.mask ?? null,
					type: account.type,
					subtype: account.subtype ?? null,
					currentBalance: account.currentBalance ?? null,
					availableBalance: account.availableBalance ?? null,
					currency: account.currency ?? "USD",
					accountFingerprint,
					rawProviderPayload: toJson(account.rawProviderPayload),
					isActive: true,
					lastBalanceSyncAt: new Date(),
				},
				select: { id: true, providerAccountId: true, accountFingerprint: true },
			});
			accountIdByProviderId.set(row.providerAccountId, {
				id: row.id,
				fingerprint: row.accountFingerprint ?? accountFingerprint,
			});
		}

		for (const transaction of input.transactions.added) {
			await upsertNormalizedTransaction({
				tx,
				provider: input.provider,
				userId: input.userId,
				connectionId: input.connectionId,
				transaction,
				accountIdByProviderId,
			});
		}

		for (const transaction of input.transactions.modified) {
			await upsertNormalizedTransaction({
				tx,
				provider: input.provider,
				userId: input.userId,
				connectionId: input.connectionId,
				transaction,
				accountIdByProviderId,
			});
		}

		for (const removed of input.transactions.removed) {
			await tx.transaction.updateMany({
				where: {
					userId: input.userId,
					financialConnectionId: input.connectionId,
					dataProvider: input.provider,
					providerTransactionId: removed.providerTransactionId,
					removedAt: null,
				},
				data: { removedAt: new Date() },
			});
		}
	});

	return {
		accountCount: input.accounts.length,
		addedCount: input.transactions.added.length,
		modifiedCount: input.transactions.modified.length,
		removedCount: input.transactions.removed.length,
		holdingCount: input.holdings?.length ?? 0,
	};
}

type TransactionClient = Prisma.TransactionClient;

async function upsertNormalizedTransaction(input: {
	tx: TransactionClient;
	provider: FinancialDataProvider;
	userId: string;
	connectionId: string;
	transaction: ImportNormalizedFinancialDataInput["transactions"]["added"][number];
	accountIdByProviderId: Map<string, { id: string; fingerprint: string }>;
}) {
	const account = input.accountIdByProviderId.get(
		input.transaction.providerAccountId,
	);
	const transactionDate = toDate(input.transaction.date);
	const postedDate = input.transaction.postedDate
		? toDate(input.transaction.postedDate)
		: transactionDate;
	const authorizedDate = input.transaction.authorizedDate
		? toDate(input.transaction.authorizedDate)
		: null;
	const absoluteAmount = Math.abs(input.transaction.amount).toFixed(2);
	const type = input.transaction.amount < 0 ? "INCOME" : "EXPENSE";
	const externalTransactionId = `${input.provider}:${input.transaction.providerTransactionId}`;
	const dedupeFingerprint = createTransactionDedupeFingerprint({
		accountFingerprint: account?.fingerprint,
		amount: Math.abs(input.transaction.amount),
		date: postedDate,
		merchantName: input.transaction.merchantName,
		description: input.transaction.description,
		pending: input.transaction.pending ?? false,
	});

	const existing = await input.tx.transaction.findUnique({
		where: {
			unique_external_tx: {
				userId: input.userId,
				externalTransactionId,
			},
		},
		select: { splitGroupId: true },
	});

	await input.tx.transaction.upsert({
		where: {
			unique_external_tx: {
				userId: input.userId,
				externalTransactionId,
			},
		},
		create: {
			userId: input.userId,
			date: postedDate,
			postedDate,
			authorizedDate,
			amount: absoluteAmount,
			isoCurrencyCode: input.transaction.currency ?? null,
			type,
			category: "Uncategorized",
			description: input.transaction.description,
			originalDescription: input.transaction.originalDescription,
			merchantName: input.transaction.merchantName,
			paymentChannel: input.transaction.paymentChannel,
			source: input.provider,
			externalTransactionId,
			pendingTransactionId: input.transaction.pendingProviderTransactionId,
			financialConnectionId: input.connectionId,
			financialAccountId: account?.id ?? null,
			dataProvider: input.provider,
			providerAccountId: input.transaction.providerAccountId,
			providerTransactionId: input.transaction.providerTransactionId,
			accountFingerprint: account?.fingerprint ?? null,
			dedupeFingerprint,
			pending: input.transaction.pending ?? false,
			rawProviderPayload: toJson(input.transaction.rawProviderPayload),
			raw: toJson(input.transaction.rawProviderPayload),
		},
		update: {
			date: postedDate,
			postedDate,
			authorizedDate,
			...(existing?.splitGroupId ? {} : { amount: absoluteAmount }),
			isoCurrencyCode: input.transaction.currency ?? null,
			type,
			description: input.transaction.description,
			originalDescription: input.transaction.originalDescription,
			merchantName: input.transaction.merchantName,
			paymentChannel: input.transaction.paymentChannel,
			pendingTransactionId: input.transaction.pendingProviderTransactionId,
			financialConnectionId: input.connectionId,
			financialAccountId: account?.id ?? null,
			dataProvider: input.provider,
			providerAccountId: input.transaction.providerAccountId,
			providerTransactionId: input.transaction.providerTransactionId,
			accountFingerprint: account?.fingerprint ?? null,
			dedupeFingerprint,
			pending: input.transaction.pending ?? false,
			removedAt: null,
			rawProviderPayload: toJson(input.transaction.rawProviderPayload),
			raw: toJson(input.transaction.rawProviderPayload),
		},
	});
}

function toDate(value: string | Date): Date {
	if (value instanceof Date) return value;
	const date = new Date(value.length === 10 ? `${value}T00:00:00Z` : value);
	if (Number.isNaN(date.getTime())) return new Date();
	return date;
}

function toJson(value: unknown): Prisma.InputJsonValue | undefined {
	if (value === undefined) return undefined;
	return value as Prisma.InputJsonValue;
}
