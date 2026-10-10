import { randomUUID } from "node:crypto";
import { planAccrualSteps } from "@moat/domain";
import { logger } from "~/lib/logger";
import { db } from "~/server/db";
import { recordInvestmentHistory } from "./account-balance-history.service";
import { takeSnapshot } from "./balance-snapshot.service";

const DEFAULT_TAKE = 200;

export type ManualInvestmentAccrualRunResult = {
	processed: number;
	accrued: number;
	monthsApplied: number;
	skipped: number;
	failed: number;
	snapshots: number;
};

export async function runManualInvestmentBalanceAccrual(input?: {
	take?: number;
	now?: Date;
}): Promise<ManualInvestmentAccrualRunResult> {
	const take = input?.take ?? DEFAULT_TAKE;
	const now = input?.now ?? new Date();

	const due = await db.investment.findMany({
		where: {
			autoUpdateBalance: true,
			nextBalanceAccrualDueAt: { lte: now },
			monthlyContribution: { not: 0 },
		},
		orderBy: { nextBalanceAccrualDueAt: "asc" },
		take,
	});

	let accrued = 0;
	let monthsApplied = 0;
	let skipped = 0;
	let failed = 0;
	const usersNeedingSnapshot = new Set<string>();

	for (const investment of due) {
		const steps = planAccrualSteps(investment, now);
		if (steps.length === 0) {
			skipped += 1;
			continue;
		}

		try {
			await db.$transaction(async (tx) => {
				for (const step of steps) {
					await tx.$executeRaw`
						INSERT INTO "ManualInvestmentBalanceAccrual" (
							"id", "userId", "investmentId", "previousBalance", "newBalance",
							"contributionApplied", "returnApplied", "netIncrement",
							"periodStart", "periodEnd", "accruedAt"
						) VALUES (
							${randomUUID()},
							${step.userId},
							${step.investmentId},
							${step.previousBalance},
							${step.newBalance},
							${step.contributionApplied},
							${step.returnApplied},
							${step.netIncrement},
							${step.periodStart},
							${step.periodEnd},
							${step.accruedAt}
						)
						ON CONFLICT ("investmentId", "periodEnd") DO NOTHING
					`;
					await tx.investment.update({
						where: { id: step.investmentId },
						data: {
							startingBalance: step.newBalance,
							lastBalanceAccruedAt: step.lastBalanceAccruedAt,
							nextBalanceAccrualDueAt: step.nextBalanceAccrualDueAt,
						},
					});
					monthsApplied += 1;
				}
			});
			for (const step of steps) {
				try {
					await recordInvestmentHistory(
						step.userId,
						step.investmentId,
						step.newBalance,
						step.periodEnd,
						db,
					);
				} catch (error) {
					logger.logError(
						"Account history failed after investment accrual step",
						error,
						{
							feature: "account-balance-history",
							operation: "accrue",
							investmentId: step.investmentId,
							userId: step.userId,
						},
					);
				}
			}
			accrued += 1;
			usersNeedingSnapshot.add(investment.userId);
		} catch (error) {
			failed += 1;
			logger.error("Manual investment accrual failed", {
				feature: "investment-accrual",
				operation: "accrue",
				investmentId: investment.id,
				userId: investment.userId,
				errorName: error instanceof Error ? error.name : "Unknown",
				errorMessage: error instanceof Error ? error.message : String(error),
			});
		}
	}

	let snapshots = 0;
	for (const userId of usersNeedingSnapshot) {
		try {
			await takeSnapshot(userId, db);
			snapshots += 1;
		} catch (error) {
			logger.logError("Snapshot failed after investment accrual", error, {
				feature: "investment-accrual",
				operation: "snapshot",
				userId,
			});
		}
	}

	return {
		processed: due.length,
		accrued,
		monthsApplied,
		skipped,
		failed,
		snapshots,
	};
}
