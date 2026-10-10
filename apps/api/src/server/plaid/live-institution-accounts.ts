import type { PrismaClient } from "../../../generated/prisma";
import { isPlaidItemAccessLive, plaidInstitutionKey } from "./access-state";
import type { LiveFingerprintAccount } from "./match-live-accounts";
import type { PrismaClientLike } from "./types";

type DbClient = PrismaClient | PrismaClientLike;

const liveAccountSelect = {
	id: true,
	plaidAccountId: true,
	plaidItemId: true,
	name: true,
	officialName: true,
	mask: true,
	type: true,
	subtype: true,
	currentBalance: true,
	lastBalanceSyncAt: true,
	createdAt: true,
} as const;

export type LiveInstitutionAccount = LiveFingerprintAccount & {
	officialName: string | null;
	currentBalance: number | null;
	lastBalanceSyncAt: Date | null;
	createdAt: Date;
	institutionName: string;
	itemPlaidItemId: string;
};

export async function loadLiveInstitutionAccounts(
	dbClient: DbClient,
	input: {
		userId: string;
		institutionId?: string | null;
		institutionName: string;
		excludeItemId?: string;
		activeOnly?: boolean;
	},
): Promise<LiveInstitutionAccount[]> {
	const targetKey = plaidInstitutionKey({
		institutionId: input.institutionId,
		institutionName: input.institutionName,
	});
	if (
		targetKey === "name:unknown institution" ||
		targetKey === "name:unknown bank"
	) {
		return [];
	}

	const items = await dbClient.plaidItem.findMany({
		where: {
			userId: input.userId,
			...(input.excludeItemId ? { id: { not: input.excludeItemId } } : {}),
			accessRevokedAt: null,
			accessTokenEncrypted: { not: null },
		},
		select: {
			id: true,
			plaidItemId: true,
			institutionId: true,
			institutionName: true,
			accessRevokedAt: true,
			accessTokenEncrypted: true,
			plaidAccounts: {
				where: input.activeOnly === false ? undefined : { isActive: true },
				select: liveAccountSelect,
			},
		},
	});

	const accounts: LiveInstitutionAccount[] = [];
	for (const item of items) {
		if (!isPlaidItemAccessLive(item)) continue;
		const itemKey = plaidInstitutionKey({
			institutionId: item.institutionId,
			institutionName: item.institutionName,
		});
		if (itemKey !== targetKey) continue;
		for (const account of item.plaidAccounts) {
			accounts.push({
				...account,
				institutionName: item.institutionName,
				itemPlaidItemId: item.plaidItemId,
			});
		}
	}
	return accounts;
}

export async function loadLivePlaidItemsWithAccounts(
	dbClient: DbClient,
	userId: string,
): Promise<
	Array<{
		id: string;
		plaidItemId: string;
		institutionId: string | null;
		institutionName: string;
		plaidAccounts: Array<{
			id: string;
			plaidAccountId: string;
			plaidItemId: string;
			name: string;
			mask: string | null;
			type: string;
			subtype: string | null;
			lastBalanceSyncAt: Date | null;
			createdAt: Date;
			isActive: boolean;
		}>;
	}>
> {
	const items = await dbClient.plaidItem.findMany({
		where: {
			userId,
			accessRevokedAt: null,
			accessTokenEncrypted: { not: null },
		},
		select: {
			id: true,
			plaidItemId: true,
			institutionId: true,
			institutionName: true,
			accessRevokedAt: true,
			accessTokenEncrypted: true,
			plaidAccounts: {
				select: {
					id: true,
					plaidAccountId: true,
					plaidItemId: true,
					name: true,
					mask: true,
					type: true,
					subtype: true,
					lastBalanceSyncAt: true,
					createdAt: true,
					isActive: true,
				},
			},
		},
	});
	return items.filter(isPlaidItemAccessLive).map((item) => ({
		id: item.id,
		plaidItemId: item.plaidItemId,
		institutionId: item.institutionId,
		institutionName: item.institutionName,
		plaidAccounts: item.plaidAccounts,
	}));
}
