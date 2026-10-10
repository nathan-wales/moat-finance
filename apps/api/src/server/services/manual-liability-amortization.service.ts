import {
	FinancialProfileDataSchema,
	type ProfileLiability,
} from "@moat/contracts";
import {
	applyAmortizationStepsToLiability,
	planLiabilityAmortizationSteps,
	toAmortizationInputs,
} from "@moat/domain";
import { logger } from "~/lib/logger";
import { db } from "~/server/db";
import type { Prisma } from "../../../generated/prisma";
import { takeSnapshot } from "./balance-snapshot.service";

const DEFAULT_TAKE = 200;

export type ManualLiabilityAmortizationRunResult = {
	processed: number;
	amortized: number;
	monthsApplied: number;
	skipped: number;
	failed: number;
	snapshots: number;
};

function parseLiabilities(raw: unknown): ProfileLiability[] {
	if (!Array.isArray(raw)) return [];
	const parsed = FinancialProfileDataSchema.shape.liabilities.safeParse(raw);
	return parsed.success ? parsed.data : [];
}

function toPrismaJson(value: unknown): Prisma.InputJsonValue {
	return value as Prisma.InputJsonValue;
}

function isDueLiability(liability: ProfileLiability, now: Date): boolean {
	if (liability.autoUpdateBalance !== true) return false;
	if (!liability.nextBalanceAmortizationDueAt) return false;
	const due = new Date(liability.nextBalanceAmortizationDueAt);
	if (Number.isNaN(due.getTime())) return false;
	return due.getTime() <= now.getTime();
}

export async function runManualLiabilityBalanceAmortization(input?: {
	take?: number;
	now?: Date;
}): Promise<ManualLiabilityAmortizationRunResult> {
	const take = input?.take ?? DEFAULT_TAKE;
	const now = input?.now ?? new Date();

	const profiles = await db.financialProfileData.findMany({
		orderBy: { updatedAt: "asc" },
		take,
	});

	let processed = 0;
	let amortized = 0;
	let monthsApplied = 0;
	let skipped = 0;
	let failed = 0;
	const usersNeedingSnapshot = new Set<string>();

	for (const profile of profiles) {
		const liabilities = parseLiabilities(profile.liabilities);
		const dueLiabilities = liabilities.filter((liability) =>
			isDueLiability(liability, now),
		);
		if (dueLiabilities.length === 0) continue;

		processed += dueLiabilities.length;

		try {
			let nextLiabilities = liabilities;
			let profileAmortized = 0;
			let profileMonths = 0;

			for (const liability of dueLiabilities) {
				const steps = planLiabilityAmortizationSteps(
					toAmortizationInputs(liability),
					now,
				);
				if (steps.length === 0) {
					skipped += 1;
					continue;
				}

				nextLiabilities = nextLiabilities.map((item) =>
					item.id === liability.id
						? applyAmortizationStepsToLiability(item, steps)
						: item,
				);
				profileAmortized += 1;
				profileMonths += steps.length;
			}

			if (profileAmortized === 0) continue;

			await db.financialProfileData.update({
				where: { id: profile.id },
				data: { liabilities: toPrismaJson(nextLiabilities) },
			});

			amortized += profileAmortized;
			monthsApplied += profileMonths;
			usersNeedingSnapshot.add(profile.userId);
		} catch (error) {
			failed += 1;
			logger.error("Manual liability amortization failed", {
				feature: "liability-amortization",
				operation: "amortize",
				userId: profile.userId,
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
			logger.logError("Snapshot failed after liability amortization", error, {
				feature: "liability-amortization",
				operation: "snapshot",
				userId,
			});
		}
	}

	return {
		processed,
		amortized,
		monthsApplied,
		skipped,
		failed,
		snapshots,
	};
}
