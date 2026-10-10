import type {
	CreateForecastScenarioInput,
	ForecastRepository,
	ForecastScenario,
	UpdateForecastScenarioInput,
} from "@moat/data-access";
import type { DbClient } from "../db-client";

type ForecastScenarioRow = {
	id: string;
	name: string;
	type: string;
	investmentReturn: number;
	inflationRate: number;
	salaryGrowth: number;
	contributionChange: number;
	expenseGrowth: number;
	isActive: boolean;
};

const DEFAULT_SCENARIOS: CreateForecastScenarioInput[] = [
	{
		name: "Conservative",
		type: "CONSERVATIVE",
		investmentReturn: 0.04,
		inflationRate: 0.04,
		salaryGrowth: 0.01,
		contributionChange: 0,
		expenseGrowth: 0.04,
	},
	{
		name: "Standard",
		type: "STANDARD",
		investmentReturn: 0.07,
		inflationRate: 0.03,
		salaryGrowth: 0.03,
		contributionChange: 0.02,
		expenseGrowth: 0.03,
	},
	{
		name: "Aggressive",
		type: "AGGRESSIVE",
		investmentReturn: 0.1,
		inflationRate: 0.02,
		salaryGrowth: 0.06,
		contributionChange: 0.05,
		expenseGrowth: 0.02,
	},
];

const scenarioSelect = {
	id: true,
	name: true,
	type: true,
	investmentReturn: true,
	inflationRate: true,
	salaryGrowth: true,
	contributionChange: true,
	expenseGrowth: true,
	isActive: true,
} as const;

function mapScenario(row: ForecastScenarioRow): ForecastScenario {
	return {
		id: row.id,
		name: row.name,
		type: row.type,
		investmentReturn: row.investmentReturn,
		inflationRate: row.inflationRate,
		salaryGrowth: row.salaryGrowth,
		contributionChange: row.contributionChange,
		expenseGrowth: row.expenseGrowth,
		isActive: row.isActive,
	};
}

export class PostgresForecastRepository implements ForecastRepository {
	constructor(private db: DbClient) {}

	async listScenarios(input: { userId: string }): Promise<ForecastScenario[]> {
		const rows = (await this.db.forecastScenario.findMany({
			where: { userId: input.userId },
			orderBy: { createdAt: "asc" },
			select: scenarioSelect,
		})) as ForecastScenarioRow[];

		return rows.map(mapScenario);
	}

	async seedDefaultScenarios(input: {
		userId: string;
	}): Promise<{ seeded: boolean }> {
		const existing = await this.db.forecastScenario.count({
			where: { userId: input.userId },
		});
		if (existing > 0) return { seeded: false };

		await this.db.forecastScenario.createMany({
			data: DEFAULT_SCENARIOS.map((scenario) => ({
				userId: input.userId,
				...scenario,
				isActive: scenario.type === "STANDARD",
			})),
		});

		return { seeded: true };
	}

	async createScenario(
		input: { userId: string } & CreateForecastScenarioInput,
	): Promise<ForecastScenario> {
		const row = (await this.db.forecastScenario.create({
			data: {
				userId: input.userId,
				name: input.name,
				type: input.type,
				investmentReturn: input.investmentReturn,
				inflationRate: input.inflationRate,
				salaryGrowth: input.salaryGrowth,
				contributionChange: input.contributionChange,
				expenseGrowth: input.expenseGrowth,
				isActive: false,
			},
			select: scenarioSelect,
		})) as ForecastScenarioRow;

		return mapScenario(row);
	}

	async updateScenario(input: {
		userId: string;
		id: string;
		data: UpdateForecastScenarioInput;
	}): Promise<ForecastScenario> {
		const existing = await this.db.forecastScenario.findFirst({
			where: { id: input.id, userId: input.userId },
		});
		if (!existing) throw new Error("Scenario not found");

		const row = (await this.db.forecastScenario.update({
			where: { id: input.id },
			data: input.data,
			select: scenarioSelect,
		})) as ForecastScenarioRow;

		return mapScenario(row);
	}

	async deleteScenario(input: { userId: string; id: string }): Promise<void> {
		const existing = (await this.db.forecastScenario.findFirst({
			where: { id: input.id, userId: input.userId },
			select: scenarioSelect,
		})) as ForecastScenarioRow | null;
		if (!existing) throw new Error("Scenario not found");

		await this.db.forecastScenario.delete({ where: { id: input.id } });

		if (!existing.isActive) return;

		const fallback = (await this.db.forecastScenario.findFirst({
			where: { userId: input.userId },
			orderBy: { createdAt: "asc" },
			select: scenarioSelect,
		})) as ForecastScenarioRow | null;
		if (!fallback) return;

		const standardFallback = (await this.db.forecastScenario.findFirst({
			where: { userId: input.userId, type: "STANDARD" },
			select: scenarioSelect,
		})) as ForecastScenarioRow | null;

		await this.db.forecastScenario.update({
			where: { id: (standardFallback ?? fallback).id },
			data: { isActive: true },
		});
	}

	async setActiveScenario(input: {
		userId: string;
		id: string | null;
	}): Promise<void> {
		if (input.id) {
			const existing = await this.db.forecastScenario.findFirst({
				where: { id: input.id, userId: input.userId },
			});
			if (!existing) throw new Error("Scenario not found");
		}

		await this.db.forecastScenario.updateMany({
			where: { userId: input.userId },
			data: { isActive: false },
		});

		if (input.id) {
			await this.db.forecastScenario.update({
				where: { id: input.id },
				data: { isActive: true },
			});
		}
	}
}
