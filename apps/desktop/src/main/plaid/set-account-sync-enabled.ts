import type { SqliteDbClient } from "@moat/db-sqlite";

export function resolvePlaidAccountLookupId(accountId: string): string {
	return accountId.replace(/^plaid[-_]/, "");
}

export async function setAccountSyncEnabled(params: {
	db: SqliteDbClient;
	userId: string;
	accountId: string;
	syncEnabled: boolean;
}): Promise<{ id: string; syncEnabled: boolean }> {
	const { db, userId, syncEnabled } = params;
	const lookupId = resolvePlaidAccountLookupId(params.accountId);

	const owned = (await db.plaidAccount.findFirst({
		where: {
			item: { userId },
			OR: [
				{ id: lookupId },
				{ id: params.accountId },
				{ plaidAccountId: lookupId },
			],
		},
		select: { id: true },
	})) as { id: string } | null;
	if (!owned) {
		throw new Error("Account not found");
	}

	await db.plaidAccount.update({
		where: { id: owned.id },
		data: { syncEnabled },
	});

	return { id: owned.id, syncEnabled };
}
