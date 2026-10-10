import type { FinancialSnapshot } from "@moat/monitoring-rules";
import type { Prisma, PrismaClient } from "../../../generated/prisma";

const RECURRING_LABEL_HINT =
	/rent|mortgage|paycheck|payroll|salary|insurance|subscription|stream|netflix|spotify|hulu|gym|utilities|electric|internet|phone|car payment|loan/i;

function isRecurringCandidate(item: {
	label: string;
	cadence?: string;
}): boolean {
	if (item.cadence) return true;
	return RECURRING_LABEL_HINT.test(item.label);
}

function windowDefaultsForCadence(cadence: string): {
	expectedWindowStartDay: number;
	expectedWindowEndDay: number;
	missingAfterDay: number;
} {
	if (cadence === "weekly" || cadence === "biweekly") {
		return {
			expectedWindowStartDay: 1,
			expectedWindowEndDay: 2,
			missingAfterDay: 3,
		};
	}
	return {
		expectedWindowStartDay: 1,
		expectedWindowEndDay: 3,
		missingAfterDay: 5,
	};
}

function matchCriteriaForRecurring(item: {
	label: string;
	merchantName?: string | null;
	categoryName?: string | null;
}): Prisma.InputJsonValue {
	return {
		recurringLabel: item.label,
		...(item.merchantName ? { merchantContains: item.merchantName } : {}),
		...(item.categoryName ? { categoryName: item.categoryName } : {}),
	};
}

export async function listExpectedRecurringEvents(
	db: PrismaClient,
	userId: string,
	options?: { activeOnly?: boolean },
) {
	return db.expectedRecurringEvent.findMany({
		where: {
			userId,
			...(options?.activeOnly === false ? {} : { isActive: true }),
		},
		orderBy: { label: "asc" },
	});
}

export async function syncExpectedRecurringEventsFromSnapshot(
	db: PrismaClient,
	userId: string,
	snapshot: FinancialSnapshot,
): Promise<{ upserted: number }> {
	const candidates = snapshot.recurring.filter(isRecurringCandidate);
	let upserted = 0;

	for (const item of candidates) {
		const cadence = item.cadence ?? "monthly";
		const windows = windowDefaultsForCadence(cadence);
		const matchCriteria = matchCriteriaForRecurring(item);
		const existing = await db.expectedRecurringEvent.findFirst({
			where: {
				userId,
				label: item.label,
			},
		});

		if (existing) {
			await db.expectedRecurringEvent.update({
				where: { id: existing.id },
				data: {
					matchCriteria,
					cadence,
					expectedWindowStartDay:
						existing.expectedWindowStartDay ?? windows.expectedWindowStartDay,
					expectedWindowEndDay:
						existing.expectedWindowEndDay ?? windows.expectedWindowEndDay,
					missingAfterDay: existing.missingAfterDay ?? windows.missingAfterDay,
					amount: item.amount,
					isActive: true,
				},
			});
		} else {
			await db.expectedRecurringEvent.create({
				data: {
					userId,
					label: item.label,
					matchCriteria,
					cadence,
					expectedWindowStartDay: windows.expectedWindowStartDay,
					expectedWindowEndDay: windows.expectedWindowEndDay,
					missingAfterDay: windows.missingAfterDay,
					amount: item.amount,
					accountIds: [],
					isActive: true,
				},
			});
		}
		upserted += 1;
	}

	return { upserted };
}

export async function markExpectedEventMatched(
	db: PrismaClient,
	userId: string,
	labelOrId: string,
	at: Date,
) {
	const byId = await db.expectedRecurringEvent.findFirst({
		where: { id: labelOrId, userId },
	});
	if (byId) {
		return db.expectedRecurringEvent.update({
			where: { id: byId.id },
			data: { lastMatchedAt: at },
		});
	}

	const byLabel = await db.expectedRecurringEvent.findFirst({
		where: {
			userId,
			label: { equals: labelOrId, mode: "insensitive" },
		},
	});
	if (!byLabel) return null;

	return db.expectedRecurringEvent.update({
		where: { id: byLabel.id },
		data: { lastMatchedAt: at },
	});
}
