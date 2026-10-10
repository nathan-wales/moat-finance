import type {
	PlaidAccountRepository,
	PlaidAccountSummary,
	UpdatePlaidForecastInputs,
} from "@moat/data-access";
import type { SqliteDbClient } from "../db-client";

type PlaidAccountRow = {
	id: string;
	plaidAccountId: string;
	plaidItemId: string;
	name: string;
	officialName: string | null;
	mask: string | null;
	type: string;
	subtype: string | null;
	currentBalance: number | null;
	availableBalance: number | null;
	currency: string;
	isActive: boolean | number;
	syncEnabled?: boolean | number;
	isHidden: boolean | number;
	lastBalanceSyncAt: Date | null;
	monthlyContribution?: number | null;
	annualReturnRate?: number | null;
	notes?: string | null;
	forecastInputsUserEdited?: boolean | number | null;
};

const PLAID_ACCOUNT_SELECT = {
	id: true,
	plaidAccountId: true,
	plaidItemId: true,
	name: true,
	officialName: true,
	mask: true,
	type: true,
	subtype: true,
	currentBalance: true,
	availableBalance: true,
	currency: true,
	isActive: true,
	syncEnabled: true,
	isHidden: true,
	lastBalanceSyncAt: true,
	monthlyContribution: true,
	annualReturnRate: true,
	notes: true,
	forecastInputsUserEdited: true,
} as const;

function mapRow(row: PlaidAccountRow): PlaidAccountSummary {
	return {
		id: row.id,
		plaidAccountId: row.plaidAccountId,
		plaidItemId: row.plaidItemId,
		name: row.name,
		officialName: row.officialName,
		mask: row.mask,
		type: row.type,
		subtype: row.subtype,
		currentBalance: row.currentBalance,
		availableBalance: row.availableBalance,
		currency: row.currency,
		isActive: Boolean(row.isActive),
		syncEnabled: row.syncEnabled === undefined ? true : Boolean(row.syncEnabled),
		isHidden: Boolean(row.isHidden),
		lastBalanceSyncAt: row.lastBalanceSyncAt,
		monthlyContribution: row.monthlyContribution ?? 0,
		annualReturnRate: row.annualReturnRate ?? 0.07,
		notes: row.notes ?? null,
		forecastInputsUserEdited: Boolean(row.forecastInputsUserEdited),
	};
}

export class SqlitePlaidAccountRepository implements PlaidAccountRepository {
	constructor(private db: SqliteDbClient) {}

	async listForItem(input: {
		plaidItemId: string;
	}): Promise<PlaidAccountSummary[]> {
		const rows = (await this.db.plaidAccount.findMany({
			where: { plaidItemId: input.plaidItemId },
			select: PLAID_ACCOUNT_SELECT,
			orderBy: { name: "asc" },
		})) as PlaidAccountRow[];
		return rows.map(mapRow);
	}

	async listActiveForUser(input: {
		userId: string;
	}): Promise<PlaidAccountSummary[]> {
		const rows = (await this.db.plaidAccount.findMany({
			where: {
				item: { userId: input.userId },
				isActive: true,
				syncEnabled: true,
			},
			select: PLAID_ACCOUNT_SELECT,
			orderBy: { name: "asc" },
		})) as PlaidAccountRow[];
		return rows.map(mapRow);
	}

	async setHidden(input: {
		userId: string;
		plaidAccountId: string;
		isHidden: boolean;
	}): Promise<void> {
		const owned = (await this.db.plaidAccount.findFirst({
			where: {
				item: { userId: input.userId },
				OR: [
					{ id: input.plaidAccountId },
					{ plaidAccountId: input.plaidAccountId },
				],
			},
			select: { id: true },
		})) as { id: string } | null;
		if (!owned) {
			throw new Error("Plaid account not found");
		}

		await this.db.plaidAccount.update({
			where: { id: owned.id },
			data: { isHidden: input.isHidden },
		});
	}

	async updateForecastInputs(input: {
		userId: string;
		accountId: string;
		data: UpdatePlaidForecastInputs;
	}): Promise<PlaidAccountSummary> {
		const owned = (await this.db.plaidAccount.findFirst({
			where: {
				id: input.accountId,
				item: { userId: input.userId },
				type: { in: ["investment", "brokerage", "depository", "cash"] },
			},
			select: { id: true },
		})) as { id: string } | null;
		if (!owned) {
			throw new Error("Plaid account not found");
		}

		const updated = (await this.db.plaidAccount.update({
			where: { id: owned.id },
			data: {
				...(input.data.name !== undefined && { name: input.data.name }),
				...(input.data.monthlyContribution !== undefined && {
					monthlyContribution: input.data.monthlyContribution,
				}),
				...(input.data.annualReturnRate !== undefined && {
					annualReturnRate: input.data.annualReturnRate,
				}),
				...(input.data.notes !== undefined && { notes: input.data.notes }),
				forecastInputsUserEdited: true,
			},
			select: PLAID_ACCOUNT_SELECT,
		})) as PlaidAccountRow;

		return mapRow(updated);
	}
}
