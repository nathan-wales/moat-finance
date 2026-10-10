import type {
	AccountRepository,
	AccountSummary,
	UpsertAccountInput,
} from "@moat/data-access";
import type { DbClient } from "../db-client";

type PlaidAccountRow = {
	id: string;
	name: string;
	type: string;
	subtype: string | null;
	currentBalance: number | null;
	currency: string;
	mask: string | null;
	accountHidden: boolean;
	isActive: boolean;
};

const accountSelect = {
	id: true,
	name: true,
	type: true,
	subtype: true,
	currentBalance: true,
	currency: true,
	mask: true,
	accountHidden: true,
	isActive: true,
} as const;

function mapRow(row: PlaidAccountRow): AccountSummary {
	return {
		id: row.id,
		name: row.name,
		type: row.type,
		subtype: row.subtype,
		currentBalance: row.currentBalance,
		currency: row.currency,
		mask: row.mask,
		isHidden: row.accountHidden,
		isActive: row.isActive,
	};
}

export class PostgresAccountRepository implements AccountRepository {
	constructor(private db: DbClient) {}

	private async listPlaidAccounts(input: {
		userId: string;
		activeOnly?: boolean;
	}): Promise<AccountSummary[]> {
		const rows = (await this.db.plaidAccount.findMany({
			where: {
				userId: input.userId,
				...(input.activeOnly ? { isActive: true, syncEnabled: true } : {}),
			},
			select: accountSelect,
			orderBy: { name: "asc" },
		})) as PlaidAccountRow[];

		return rows.map(mapRow);
	}

	async listForSummary(input: { userId: string }): Promise<AccountSummary[]> {
		return this.listPlaidAccounts({ userId: input.userId, activeOnly: true });
	}

	async listAll(input: { userId: string }): Promise<AccountSummary[]> {
		return this.listPlaidAccounts({ userId: input.userId });
	}

	async upsert(
		input: { userId: string } & UpsertAccountInput,
	): Promise<AccountSummary> {
		const { userId, id, name, type, subtype, currentBalance, currency } = input;

		if (!id) {
			throw new Error("Manual account creation is not supported in cloud mode");
		}

		const existing = (await this.db.plaidAccount.findFirst({
			where: { id, userId },
			select: accountSelect,
		})) as PlaidAccountRow | null;
		if (!existing) throw new Error("Account not found");

		const row = (await this.db.plaidAccount.update({
			where: { id },
			data: {
				name,
				type,
				subtype: subtype ?? null,
				currentBalance: currentBalance ?? null,
				currency: currency ?? "USD",
			},
			select: accountSelect,
		})) as PlaidAccountRow;

		return mapRow(row);
	}
}
