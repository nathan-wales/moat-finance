import { z } from "zod";
import { logger } from "~/lib/logger";
import { createApiError } from "../api-context";
import { type AuthenticatedContext, withAuth } from "../handler-wrappers";
import {
	AppleFinanceKitAccountNotFoundError,
	bulkImportAppleFinanceKitTransactions,
	bulkImportAppleFinanceKitTransactionsInputSchema,
	disconnectAppleFinanceKit,
	getAppleFinanceKitStatus,
	upsertAppleFinanceKitAccounts,
	upsertAppleFinanceKitAccountsInputSchema,
} from "../services/apple-financekit-import.service";
import {
	assertAppleFinanceKitAccountUpsertRateLimit,
	assertAppleFinanceKitImportRateLimit,
} from "../services/apple-financekit-sync-rate-limit.service";

const disconnectInputSchema = z.object({
	externalAccountId: z.string().min(1).optional(),
	deleteImportedTransactions: z.boolean().default(false),
});

function prismaUniqueTarget(error: unknown): string[] | undefined {
	if (error === null || typeof error !== "object" || !("meta" in error)) {
		return undefined;
	}
	const meta = error.meta;
	if (meta === null || typeof meta !== "object" || !("target" in meta)) {
		return undefined;
	}
	const target = meta.target;
	if (!Array.isArray(target)) return undefined;
	const fields = target.filter((item) => typeof item === "string");
	return fields.length > 0 ? fields : undefined;
}

export const appleFinancekit = {
	upsertAccounts: withAuth(async (ctx: AuthenticatedContext, body: unknown) => {
		const input = upsertAppleFinanceKitAccountsInputSchema.parse(body);
		assertAppleFinanceKitAccountUpsertRateLimit(ctx.userId);
		try {
			return await upsertAppleFinanceKitAccounts({
				userId: ctx.userId,
				accounts: input.accounts,
			});
		} catch (error) {
			logger.logError("Failed to upsert Apple FinanceKit accounts", error, {
				feature: "apple-financekit",
				operation: "upsertAccounts",
				userId: ctx.userId,
			});
			throw createApiError(
				error instanceof Error
					? error.message
					: "Failed to upsert Apple Wallet accounts",
				500,
			);
		}
	}),

	bulkImportTransactions: withAuth(
		async (ctx: AuthenticatedContext, body: unknown) => {
			const input =
				bulkImportAppleFinanceKitTransactionsInputSchema.parse(body);
			assertAppleFinanceKitImportRateLimit(ctx.userId);
			try {
				return await bulkImportAppleFinanceKitTransactions({
					userId: ctx.userId,
					externalAccountId: input.externalAccountId,
					transactions: input.transactions,
					deletedExternalTransactionIds: input.deletedExternalTransactionIds,
				});
			} catch (error) {
				logger.logError(
					"Failed to bulk import Apple FinanceKit transactions",
					error,
					{
						feature: "apple-financekit",
						operation: "bulkImportTransactions",
						userId: ctx.userId,
						uniqueTarget: prismaUniqueTarget(error),
					},
				);
				if (error instanceof AppleFinanceKitAccountNotFoundError) {
					throw createApiError(error.message, 404);
				}
				throw createApiError(
					error instanceof Error
						? error.message
						: "Failed to import Apple Wallet transactions",
					500,
				);
			}
		},
	),

	getStatus: withAuth(async (ctx: AuthenticatedContext) => {
		try {
			return await getAppleFinanceKitStatus(ctx.userId);
		} catch (error) {
			logger.logError("Failed to load Apple FinanceKit status", error, {
				feature: "apple-financekit",
				operation: "getStatus",
				userId: ctx.userId,
			});
			throw createApiError("Failed to load Apple Wallet status", 500);
		}
	}),

	disconnect: withAuth(async (ctx: AuthenticatedContext, body: unknown) => {
		const input = disconnectInputSchema.parse(body ?? {});
		try {
			return await disconnectAppleFinanceKit({
				userId: ctx.userId,
				externalAccountId: input.externalAccountId,
				deleteImportedTransactions: input.deleteImportedTransactions,
			});
		} catch (error) {
			logger.logError("Failed to disconnect Apple FinanceKit", error, {
				feature: "apple-financekit",
				operation: "disconnect",
				userId: ctx.userId,
			});
			throw createApiError("Failed to disconnect Apple Wallet", 500);
		}
	}),
};
