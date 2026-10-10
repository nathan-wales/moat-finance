import {
	buildAccountBalanceHistory,
	resolveAccountHistorySourceCandidates,
} from "@moat/domain";
import { z } from "zod";
import { createApiError } from "~/server/api-context";
import { type DemoOrAuthContext, withDemoOrAuth } from "../handler-wrappers";

const getInput = z.object({
	accountId: z.string().min(1),
});

export const accountBalanceHistory = {
	/**
	 * Returns per-account balance history points for Robinhood-style charts.
	 * Client filters ranges from the full series.
	 */
	get: withDemoOrAuth(async (ctx: DemoOrAuthContext, body: unknown) => {
		const input = getInput.parse(body);
		const candidates = resolveAccountHistorySourceCandidates(input.accountId);
		if (candidates.length === 0) {
			throw createApiError("Invalid account id", 400);
		}

		const { userId, db } = ctx;

		try {
			return await buildAccountBalanceHistory(
				{
					async getCurrentBalance({ source, sourceId }) {
						if (source === "PLAID") {
							const account = await db.plaidAccount.findFirst({
								where: { id: sourceId, userId, isActive: true },
								select: {
									currentBalance: true,
									availableBalance: true,
								},
							});
							if (!account) return null;
							return account.currentBalance ?? account.availableBalance ?? 0;
						}

						if (source === "APPLE_FINANCEKIT") {
							const account = await db.appleFinanceKitAccount.findFirst({
								where: {
									id: sourceId,
									userId,
									isActive: true,
									status: "ACTIVE",
								},
								select: {
									currentBalance: true,
									availableBalance: true,
								},
							});
							if (!account) return null;
							return account.currentBalance ?? account.availableBalance ?? 0;
						}

						const investment = await db.investment.findFirst({
							where: { id: sourceId, userId },
							select: { startingBalance: true },
						});
						return investment?.startingBalance ?? null;
					},
					async listPoints({ source, sourceId }) {
						return db.accountBalanceHistory.findMany({
							where: {
								userId,
								source,
								sourceId,
							},
							orderBy: { date: "asc" },
							select: { date: true, balance: true },
						});
					},
				},
				userId,
				input,
			);
		} catch (error) {
			if (error instanceof Error && error.message === "Account not found") {
				throw createApiError("Account not found", 404);
			}
			if (error instanceof Error && error.message === "Invalid account id") {
				throw createApiError("Invalid account id", 400);
			}
			throw error;
		}
	}),
};
