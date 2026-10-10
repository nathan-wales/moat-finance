import type { AccountHoldingsResponse } from "@moat/contracts";
import {
	EMPTY_ACCOUNT_HOLDINGS_RESULT,
	plaidAccountIdsForHoldingsLookup,
	toAccountHoldingsResult,
} from "@moat/domain";
import type { PrismaClient } from "../../../../generated/prisma";

export type AccountHolding = AccountHoldingsResponse["holdings"][number];
export type AccountHoldingsResult = AccountHoldingsResponse;

/**
 * Per-security positions for one connected investment account.
 * Returns stored holdings when present; empty when none have been synced.
 */
export async function getAccountHoldings(input: {
	db: PrismaClient;
	userId: string;
	accountId: string;
}): Promise<AccountHoldingsResult> {
	const plaidAccountIds = plaidAccountIdsForHoldingsLookup(input.accountId);
	if (plaidAccountIds.length === 0) return EMPTY_ACCOUNT_HOLDINGS_RESULT;

	const rows = await input.db.plaidHolding.findMany({
		where: { userId: input.userId, plaidAccountId: { in: plaidAccountIds } },
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
	});
	return toAccountHoldingsResult(rows);
}
