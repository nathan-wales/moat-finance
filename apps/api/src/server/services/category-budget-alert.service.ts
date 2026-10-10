import {
	budgetAlertEvaluationWindow,
	budgetAlertMonthKey,
	budgetAlertPercentUsed,
	buildBudgetAlertCopy,
	hasBudgetAlertFiredThisMonth,
	highestFiredBudgetAlertThreshold,
	normalizeBudgetAlertThresholds,
} from "@moat/domain";
import { getZonedParts } from "@moat/monitoring-rules";
import { logger } from "~/lib/logger";
import type { PrismaClient } from "../../../generated/prisma";
import { buildTransactionWhere } from "../../lib/transaction-scope";
import {
	type BudgetAlertEmailInput,
	renderBudgetAlertsDigestEmail,
} from "./budget-alert-email";
import { getOrCreateNotificationPreference } from "./notification-bootstrap.service";
import { recordAndDeliverNotification } from "./notification-delivery.service";
import { buildFinancialSnapshot } from "./notification-snapshot.service";

function calendarMonthBounds(now: Date, timeZone: string) {
	const zoned = getZonedParts(now, timeZone);
	const month = String(zoned.month).padStart(2, "0");
	const from = `${zoned.year}-${month}-01`;
	const daysInMonth = new Date(
		Date.UTC(zoned.year, zoned.month, 0),
	).getUTCDate();
	const to = `${zoned.year}-${month}-${String(daysInMonth).padStart(2, "0")}`;
	return {
		from,
		to,
		start: new Date(`${from}T00:00:00.000Z`),
		end: new Date(`${to}T23:59:59.999Z`),
	};
}

function purchaseLabel(input: {
	merchantName: string | null;
	description: string | null;
}): string {
	const merchant = input.merchantName?.trim();
	if (merchant) return merchant;
	const description = input.description?.trim();
	if (description) return description;
	return "Purchase";
}

async function listTopCategoryPurchases(
	db: PrismaClient,
	input: {
		userId: string;
		categoryId: string;
		startDate: Date;
		endDate: Date;
	},
): Promise<Array<{ label: string; amount: number }>> {
	const rows = await db.transaction.findMany({
		where: buildTransactionWhere({
			userId: input.userId,
			categoryId: input.categoryId,
			type: "EXPENSE",
			startDate: input.startDate,
			endDate: input.endDate,
		}),
		orderBy: { amount: "desc" },
		take: 5,
		select: {
			merchantName: true,
			description: true,
			amount: true,
		},
	});
	return rows.map((row) => ({
		label: purchaseLabel(row),
		amount: Math.abs(toNumber(row.amount)),
	}));
}

function toNumber(value: { toNumber?: () => number } | number): number {
	if (typeof value === "number") return value;
	if (typeof value.toNumber === "function") return value.toNumber();
	return Number(value);
}

type PendingBudgetAlert = {
	categoryId: string;
	categoryName: string;
	spent: number;
	monthlyGoal: number;
	threshold: number;
	percentOfMonthElapsed?: number;
};

export async function evaluateCategoryBudgetAlertsForUser(
	db: PrismaClient,
	userId: string,
	now: Date,
): Promise<{
	evaluated: number;
	matched: number;
	delivered: number;
	suppressed: number;
	deduped: number;
}> {
	const savedBudgets = await db.categoryBudget.findMany({
		where: { userId, alertsEnabled: true },
		include: { category: { select: { name: true } } },
	});

	if (savedBudgets.length === 0) {
		return {
			evaluated: 0,
			matched: 0,
			delivered: 0,
			suppressed: 0,
			deduped: 0,
		};
	}

	const prefs = await getOrCreateNotificationPreference(db, userId);
	const month = calendarMonthBounds(now, prefs.timezone);
	const monthKey = budgetAlertMonthKey(now, prefs.timezone);
	const snapshot = await buildFinancialSnapshot(
		db,
		userId,
		now,
		prefs.timezone,
	);
	const user = await db.user.findUnique({
		where: { id: userId },
		select: { email: true },
	});
	const existingDeliveries = await db.notificationDelivery.findMany({
		where: {
			userId,
			evaluationWindow: { startsWith: "budget-alert:" },
		},
		select: { evaluationWindow: true },
	});
	const existingWindows = existingDeliveries.map((row) => row.evaluationWindow);

	const spendByCategory = new Map(
		snapshot.budgets.map((budget) => [budget.categoryId, budget]),
	);

	let evaluated = 0;
	let matched = 0;
	let delivered = 0;
	let suppressed = 0;
	let deduped = 0;

	const pending: PendingBudgetAlert[] = [];
	for (const row of savedBudgets) {
		evaluated += 1;
		const snap = spendByCategory.get(row.categoryId);
		const monthlyGoal = toNumber(row.monthlyGoal);
		const spent = snap?.spent ?? 0;
		const threshold = highestFiredBudgetAlertThreshold({
			spent,
			monthlyGoal,
			thresholds: normalizeBudgetAlertThresholds(row.alertThresholds),
		});
		if (threshold == null) continue;
		matched += 1;
		if (
			existingWindows.some((window) =>
				hasBudgetAlertFiredThisMonth(window, row.categoryId, monthKey),
			)
		) {
			deduped += 1;
			continue;
		}
		pending.push({
			categoryId: row.categoryId,
			categoryName: row.category.name,
			spent,
			monthlyGoal,
			threshold,
			percentOfMonthElapsed: snap?.percentOfMonthElapsed,
		});
	}

	if (pending.length === 0) {
		return { evaluated, matched, delivered, suppressed, deduped };
	}

	const sections: BudgetAlertEmailInput[] = [];
	for (const alert of pending) {
		const purchases = await listTopCategoryPurchases(db, {
			userId,
			categoryId: alert.categoryId,
			startDate: month.start,
			endDate: month.end,
		});
		sections.push({
			categoryName: alert.categoryName,
			spent: alert.spent,
			monthlyGoal: alert.monthlyGoal,
			threshold: alert.threshold,
			percentOfMonthElapsed: alert.percentOfMonthElapsed,
			purchases,
			periodFrom: month.from,
			periodTo: month.to,
		});
	}

	const email = renderBudgetAlertsDigestEmail({ sections });

	for (const [index, alert] of pending.entries()) {
		const copy = buildBudgetAlertCopy(alert);
		const isFirst = index === 0;
		const result = await recordAndDeliverNotification(db, {
			userId,
			ruleId: null,
			channels: isFirst ? ["email", "in_app"] : ["in_app"],
			email: user?.email,
			summaryHtml: isFirst ? email : undefined,
			evaluation: {
				fired: true,
				title: copy.title,
				body: copy.body,
				evaluationWindow: budgetAlertEvaluationWindow(
					now,
					alert.categoryId,
					prefs.timezone,
				),
				stateHash: JSON.stringify({
					categoryId: alert.categoryId,
					threshold: alert.threshold,
					percentUsed: Math.round(
						budgetAlertPercentUsed(alert.spent, alert.monthlyGoal),
					),
				}),
				explanation: {
					signalType: "budget_threshold",
					summary: copy.summary,
					facts: [
						{ label: "Category", value: alert.categoryName },
						{
							label: "Percent used",
							value: `${Math.round(budgetAlertPercentUsed(alert.spent, alert.monthlyGoal))}%`,
						},
						{
							label: "Alert",
							value: `${alert.threshold}% of budget`,
						},
					],
					checkedAccountIds: [],
					matchedTransactionIds: [],
					threshold: {
						kind: "percent",
						value: alert.threshold,
						actual: budgetAlertPercentUsed(alert.spent, alert.monthlyGoal),
					},
				},
			},
		});

		if (result.deduped) {
			deduped += 1;
			continue;
		}
		if (result.result === "SUPPRESSED") {
			suppressed += 1;
			continue;
		}
		delivered += 1;
	}

	return { evaluated, matched, delivered, suppressed, deduped };
}

export async function runCategoryBudgetAlertSweep(
	db: PrismaClient,
	now: Date = new Date(),
) {
	const users = await db.categoryBudget.findMany({
		where: { alertsEnabled: true },
		select: { userId: true },
		distinct: ["userId"],
	});

	let evaluated = 0;
	let matched = 0;
	let delivered = 0;
	let suppressed = 0;
	let deduped = 0;

	for (const { userId } of users) {
		const result = await evaluateCategoryBudgetAlertsForUser(db, userId, now);
		evaluated += result.evaluated;
		matched += result.matched;
		delivered += result.delivered;
		suppressed += result.suppressed;
		deduped += result.deduped;
	}

	logger.info("category_budget_alert_sweep", {
		feature: "notifications",
		operation: "evaluate-category-budget-alerts",
		userCount: users.length,
		evaluated,
		matched,
		delivered,
		suppressed,
		deduped,
	});

	return {
		userCount: users.length,
		evaluated,
		matched,
		delivered,
		suppressed,
		deduped,
	};
}
