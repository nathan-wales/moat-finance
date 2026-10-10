import type { PrismaClient } from "../../../generated/prisma";

type DbClient = PrismaClient;

export function resolvePlaidAccountLookupId(accountId: string): string {
	return accountId.replace(/^plaid[-_]/, "");
}

export async function setAccountSyncEnabled(params: {
	db: DbClient;
	userId: string;
	accountId: string;
	syncEnabled: boolean;
}): Promise<{ id: string; syncEnabled: boolean }> {
	const { db, userId, syncEnabled } = params;
	const lookupId = resolvePlaidAccountLookupId(params.accountId);

	const account = await db.plaidAccount.findFirst({
		where: {
			userId,
			OR: [{ id: lookupId }, { id: params.accountId }],
		},
		select: { id: true, plaidAccountId: true },
	});
	if (!account) {
		throw new Error("Account not found");
	}

	await db.plaidAccount.update({
		where: { id: account.id },
		data: { syncEnabled },
	});

	await db.financialAccount.updateMany({
		where: {
			userId,
			provider: "PLAID",
			providerAccountId: account.plaidAccountId,
		},
		data: { syncEnabled },
	});

	return { id: account.id, syncEnabled };
}
