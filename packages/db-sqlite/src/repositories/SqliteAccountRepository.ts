import { randomUUID } from "node:crypto";
import type {
	AccountRepository,
	AccountSummary,
	UpsertAccountInput,
} from "@moat/data-access";
import type { SqliteDbClient } from "../db-client";

type AccountRow = {
	id: string;
	name: string;
	type: string;
	subtype: string | null;
	currentBalance: number | null;
	currency: string;
	mask: string | null;
	isHidden: number | boolean;
	isActive: number | boolean;
};

function mapRow(row: AccountRow): AccountSummary {
	return {
		id: row.id,
		name: row.name,
		type: row.type,
		subtype: row.subtype,
		currentBalance: row.currentBalance,
		currency: row.currency,
		mask: row.mask,
		isHidden: Boolean(row.isHidden),
		isActive: Boolean(row.isActive),
	};
}

const accountSelect = {
	id: true,
	name: true,
	type: true,
	subtype: true,
	currentBalance: true,
	currency: true,
	mask: true,
	isHidden: true,
	isActive: true,
} as const;

export class SqliteAccountRepository implements AccountRepository {
	constructor(private db: SqliteDbClient) {}

	private async listAccounts(input: {
		userId: string;
		activeOnly?: boolean;
	}): Promise<AccountSummary[]> {
		const activeFilter = input.activeOnly ? { isActive: true } : {};
		const [accountRows, plaidAccountRows] = await Promise.all([
			this.db.account.findMany({
				where: { userId: input.userId, ...activeFilter },
				select: accountSelect,
				orderBy: { name: "asc" },
			}),
			this.db.plaidAccount.findMany({
				where: { item: { userId: input.userId }, ...activeFilter },
				select: accountSelect,
				orderBy: { name: "asc" },
			}),
		]);

		return [
			...(accountRows as AccountRow[]).map(mapRow),
			...(plaidAccountRows as AccountRow[]).map(mapRow),
		];
	}

	async listForSummary(input: { userId: string }): Promise<AccountSummary[]> {
		return this.listAccounts({ userId: input.userId, activeOnly: true });
	}

	async listAll(input: { userId: string }): Promise<AccountSummary[]> {
		return this.listAccounts({ userId: input.userId });
	}

	async upsert(
		input: { userId: string } & UpsertAccountInput,
	): Promise<AccountSummary> {
		const {
			userId,
			id,
			name,
			type,
			subtype,
			institutionName,
			currentBalance,
			currency,
		} = input;
		const accountId = id ?? randomUUID();

		if (id) {
			const owned = await this.db.account.findFirst({
				where: { id, userId },
				select: { id: true },
			});
			if (!owned) {
				throw new Error("Account not found");
			}
		}

		const row = (await this.db.account.upsert({
			where: { id: accountId },
			create: {
				id: accountId,
				userId,
				name,
				type,
				subtype: subtype ?? null,
				institutionName: institutionName ?? null,
				currentBalance: currentBalance ?? null,
				currency: currency ?? "USD",
			},
			update: {
				name,
				type,
				subtype: subtype ?? null,
				institutionName: institutionName ?? null,
				currentBalance: currentBalance ?? null,
				currency: currency ?? "USD",
				updatedAt: new Date(),
			},
		})) as AccountRow;

		return mapRow(row);
	}
}
