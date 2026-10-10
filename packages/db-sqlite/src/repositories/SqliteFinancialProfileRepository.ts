import { randomUUID } from "node:crypto";
import type {
	FinancialProfile,
	FinancialProfileRepository,
	UpdateFinancialProfileInput,
} from "@moat/data-access";
import type { SqliteDbClient } from "../db-client";

type ProfileRow = {
	id: string;
	userId: string;
	monthlyIncome: number | null;
	monthlyExpenses: number | null;
	savingsGoal: number | null;
	currency: string;
};

export class SqliteFinancialProfileRepository
	implements FinancialProfileRepository
{
	constructor(private db: SqliteDbClient) {}

	async get(input: { userId: string }): Promise<FinancialProfile | null> {
		const row = (await this.db.financialProfile.findFirst({
			where: { userId: input.userId },
		})) as ProfileRow | null;

		if (!row) return null;
		return {
			monthlyIncome: row.monthlyIncome,
			monthlyExpenses: row.monthlyExpenses,
			savingsGoal: row.savingsGoal,
			currency: row.currency,
		};
	}

	async upsert(
		input: { userId: string } & UpdateFinancialProfileInput,
	): Promise<FinancialProfile> {
		const { userId, ...data } = input;

		const row = (await this.db.financialProfile.upsert({
			where: { userId },
			create: {
				id: randomUUID(),
				userId,
				monthlyIncome: data.monthlyIncome ?? null,
				monthlyExpenses: data.monthlyExpenses ?? null,
				savingsGoal: data.savingsGoal ?? null,
				currency: data.currency ?? "USD",
			},
			update: {
				...(data.monthlyIncome !== undefined && {
					monthlyIncome: data.monthlyIncome,
				}),
				...(data.monthlyExpenses !== undefined && {
					monthlyExpenses: data.monthlyExpenses,
				}),
				...(data.savingsGoal !== undefined && { savingsGoal: data.savingsGoal }),
				...(data.currency !== undefined && { currency: data.currency }),
				updatedAt: new Date(),
			},
		})) as ProfileRow;

		return {
			monthlyIncome: row.monthlyIncome,
			monthlyExpenses: row.monthlyExpenses,
			savingsGoal: row.savingsGoal,
			currency: row.currency,
		};
	}
}
