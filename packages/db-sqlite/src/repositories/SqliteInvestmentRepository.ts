import { randomUUID } from "node:crypto";
import type {
	ApplyInvestmentAccrualInput,
	ApplyInvestmentAccrualsInput,
	CreateInvestmentInput,
	Investment,
	InvestmentRepository,
	InvestmentType,
	UpdateInvestmentInput,
} from "@moat/data-access";
import { initialNextAccrualDueAt } from "@moat/domain";
import type { SqliteDbClient } from "../db-client";

type InvestmentRow = {
	id: string;
	userId: string;
	type: string;
	name: string;
	startingBalance: number;
	monthlyContribution: number;
	annualReturnRate: number;
	notes: string | null;
	autoUpdateBalance: boolean | number;
	lastBalanceAccruedAt: Date | null;
	nextBalanceAccrualDueAt: Date | null;
	createdAt: Date;
	updatedAt: Date;
};

function toInvestment(row: InvestmentRow): Investment {
	return {
		id: row.id,
		userId: row.userId,
		type: row.type as InvestmentType,
		name: row.name,
		startingBalance: row.startingBalance,
		monthlyContribution: row.monthlyContribution,
		annualReturnRate: row.annualReturnRate,
		notes: row.notes,
		autoUpdateBalance: Boolean(row.autoUpdateBalance),
		lastBalanceAccruedAt: row.lastBalanceAccruedAt,
		nextBalanceAccrualDueAt: row.nextBalanceAccrualDueAt,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
	};
}

export class SqliteInvestmentRepository implements InvestmentRepository {
	constructor(private db: SqliteDbClient) {}

	async list(input: { userId: string }): Promise<Investment[]> {
		const rows = (await this.db.investment.findMany({
			where: { userId: input.userId },
			orderBy: { createdAt: "asc" },
		})) as InvestmentRow[];
		return rows.map(toInvestment);
	}

	async create(
		input: { userId: string } & CreateInvestmentInput,
	): Promise<Investment> {
		const now = new Date();
		const autoUpdateBalance = input.autoUpdateBalance ?? true;
		const row = (await this.db.investment.create({
			data: {
				id: input.id ?? randomUUID(),
				userId: input.userId,
				type: input.type,
				name: input.name,
				startingBalance: input.startingBalance ?? 0,
				monthlyContribution: input.monthlyContribution ?? 0,
				annualReturnRate: input.annualReturnRate ?? 0.07,
				notes: input.notes ?? null,
				autoUpdateBalance,
				nextBalanceAccrualDueAt:
					input.nextBalanceAccrualDueAt !== undefined
						? input.nextBalanceAccrualDueAt
						: autoUpdateBalance
							? initialNextAccrualDueAt(now)
							: null,
				createdAt: now,
				updatedAt: now,
			},
		})) as InvestmentRow;
		return toInvestment(row);
	}

	async update(input: {
		userId: string;
		id: string;
		data: UpdateInvestmentInput;
	}): Promise<Investment> {
		const { userId, id, data } = input;
		const existing = (await this.db.investment.findFirst({
			where: { id, userId },
		})) as InvestmentRow | null;
		if (!existing) {
			throw new Error("Investment not found");
		}

		const now = new Date();
		const nextData: Record<string, unknown> = {
			...(data.type !== undefined && { type: data.type }),
			...(data.name !== undefined && { name: data.name }),
			...(data.startingBalance !== undefined && {
				startingBalance: data.startingBalance,
			}),
			...(data.monthlyContribution !== undefined && {
				monthlyContribution: data.monthlyContribution,
			}),
			...(data.annualReturnRate !== undefined && {
				annualReturnRate: data.annualReturnRate,
			}),
			...(data.notes !== undefined && { notes: data.notes }),
			...(data.autoUpdateBalance !== undefined && {
				autoUpdateBalance: data.autoUpdateBalance,
			}),
			...(data.lastBalanceAccruedAt !== undefined && {
				lastBalanceAccruedAt: data.lastBalanceAccruedAt,
			}),
			...(data.nextBalanceAccrualDueAt !== undefined && {
				nextBalanceAccrualDueAt: data.nextBalanceAccrualDueAt,
			}),
			updatedAt: now,
		};

		if (
			data.autoUpdateBalance === true &&
			!existing.nextBalanceAccrualDueAt &&
			data.nextBalanceAccrualDueAt === undefined
		) {
			nextData.nextBalanceAccrualDueAt = initialNextAccrualDueAt(now);
		}

		if (
			data.startingBalance !== undefined &&
			data.startingBalance !== existing.startingBalance &&
			data.nextBalanceAccrualDueAt === undefined
		) {
			nextData.lastBalanceAccruedAt = now;
			nextData.nextBalanceAccrualDueAt = initialNextAccrualDueAt(now);
		}

		const row = (await this.db.investment.update({
			where: { id, userId },
			data: nextData,
		})) as InvestmentRow;
		return toInvestment(row);
	}

	async delete(input: { userId: string; id: string }): Promise<void> {
		await this.db.investment.deleteMany({
			where: { id: input.id, userId: input.userId },
		});
	}

	async listDueForUser(input: {
		userId: string;
		now: Date;
	}): Promise<Investment[]> {
		const rows = (await this.db.investment.findMany({
			where: {
				userId: input.userId,
				autoUpdateBalance: true,
				nextBalanceAccrualDueAt: { lte: input.now },
				monthlyContribution: { not: 0 },
			},
			orderBy: { nextBalanceAccrualDueAt: "asc" },
		})) as InvestmentRow[];
		return rows.map(toInvestment);
	}

	async listDueForAccrual(input: {
		now: Date;
		take: number;
	}): Promise<Investment[]> {
		const rows = (await this.db.investment.findMany({
			where: {
				autoUpdateBalance: true,
				nextBalanceAccrualDueAt: { lte: input.now },
				monthlyContribution: { not: 0 },
			},
			orderBy: { nextBalanceAccrualDueAt: "asc" },
			take: input.take,
		})) as InvestmentRow[];
		return rows.map(toInvestment);
	}

	async applyAccrual(input: ApplyInvestmentAccrualInput): Promise<Investment> {
		return this.applyAccruals({
			userId: input.userId,
			investmentId: input.investmentId,
			steps: [
				{
					newBalance: input.newBalance,
					lastBalanceAccruedAt: input.lastBalanceAccruedAt,
					nextBalanceAccrualDueAt: input.nextBalanceAccrualDueAt,
					audit: input.audit,
				},
			],
		});
	}

	async applyAccruals(input: ApplyInvestmentAccrualsInput): Promise<Investment> {
		if (input.steps.length === 0) {
			const existing = (await this.db.investment.findFirst({
				where: { id: input.investmentId, userId: input.userId },
			})) as InvestmentRow | null;
			if (!existing) throw new Error("Investment not found");
			return toInvestment(existing);
		}

		return this.db.$transaction(async (tx) => {
			let row: InvestmentRow | null = null;
			for (const step of input.steps) {
				const auditId = randomUUID();
				await tx.$executeRaw`
					INSERT OR IGNORE INTO "ManualInvestmentBalanceAccrual" (
						"id", "userId", "investmentId", "previousBalance", "newBalance",
						"contributionApplied", "returnApplied", "netIncrement",
						"periodStart", "periodEnd", "accruedAt"
					) VALUES (
						${auditId},
						${input.userId},
						${input.investmentId},
						${step.audit.previousBalance},
						${step.audit.newBalance},
						${step.audit.contributionApplied},
						${step.audit.returnApplied},
						${step.audit.netIncrement},
						${step.audit.periodStart.toISOString()},
						${step.audit.periodEnd.toISOString()},
						${step.audit.accruedAt.toISOString()}
					)
				`;

				row = (await tx.investment.update({
					where: { id: input.investmentId, userId: input.userId },
					data: {
						startingBalance: step.newBalance,
						lastBalanceAccruedAt: step.lastBalanceAccruedAt,
						nextBalanceAccrualDueAt: step.nextBalanceAccrualDueAt,
						updatedAt: new Date(),
					},
				})) as InvestmentRow;
			}

			if (!row) throw new Error("Investment not found");
			return toInvestment(row);
		});
	}
}
