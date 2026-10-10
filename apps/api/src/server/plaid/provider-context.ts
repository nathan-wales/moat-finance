import { db } from "../db";

export type PlaidAccountProviderContext = {
	financialAccountId: string;
	providerAccountId: string;
	accountFingerprint: string | null;
};

export type PlaidProviderContext = {
	financialConnectionId: string | null;
	accountsByPlaidAccountId: Map<string, PlaidAccountProviderContext>;
};

export async function loadPlaidProviderContext(input: {
	userId: string;
	plaidItemExternalId: string;
}): Promise<PlaidProviderContext> {
	const connection = await db.financialConnection.findUnique({
		where: {
			provider_providerConnectionId: {
				provider: "PLAID",
				providerConnectionId: input.plaidItemExternalId,
			},
		},
		select: { id: true },
	});

	if (!connection) {
		return { financialConnectionId: null, accountsByPlaidAccountId: new Map() };
	}

	const accounts = await db.financialAccount.findMany({
		where: { connectionId: connection.id, userId: input.userId },
		select: {
			id: true,
			providerAccountId: true,
			accountFingerprint: true,
		},
	});

	const accountsByPlaidAccountId = new Map<
		string,
		PlaidAccountProviderContext
	>();
	for (const account of accounts) {
		accountsByPlaidAccountId.set(account.providerAccountId, {
			financialAccountId: account.id,
			providerAccountId: account.providerAccountId,
			accountFingerprint: account.accountFingerprint,
		});
	}

	return {
		financialConnectionId: connection.id,
		accountsByPlaidAccountId,
	};
}
