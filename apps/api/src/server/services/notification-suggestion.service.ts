import { getNotificationTemplate } from "@moat/monitoring-rules";
import type { Prisma, PrismaClient } from "../../../generated/prisma";
import { syncExpectedRecurringEventsFromSnapshot } from "./expected-recurring-event.service";
import { buildFinancialSnapshot } from "./notification-snapshot.service";

export async function listNotificationSuggestions(
	db: PrismaClient,
	userId: string,
	now: Date = new Date(),
) {
	const existing = await db.notificationSuggestion.findMany({
		where: { userId, dismissedAt: null },
		orderBy: { createdAt: "desc" },
	});
	if (existing.length > 0) {
		return existing.map((row) => ({
			id: row.id,
			suggestionKey: row.suggestionKey,
			title: row.title,
			description: row.description,
			templateId: row.templateId,
			prefill: row.prefill,
			createdAt: row.createdAt.toISOString(),
		}));
	}

	const snapshot = await buildFinancialSnapshot(db, userId, now);
	await syncExpectedRecurringEventsFromSnapshot(db, userId, snapshot);
	const candidates: Array<{
		suggestionKey: string;
		title: string;
		description: string;
		templateId: string;
		prefill: Prisma.InputJsonValue;
	}> = [];

	const rentLike = snapshot.recurring.find((item) =>
		/rent|mortgage|property/.test(item.label.toLowerCase()),
	);
	if (rentLike) {
		const template = getNotificationTemplate("missing_expected_payment");
		if (template) {
			candidates.push({
				suggestionKey: `missing_payment:${rentLike.label}`,
				title: `${rentLike.label} is reliably detected. Monitor for a missing payment?`,
				description:
					"Create an alert if this expected payment does not appear by its usual window.",
				templateId: template.id,
				prefill: {
					...template.defaultRule,
					name: `Missing ${rentLike.label}`,
					trigger: {
						...template.defaultRule.trigger,
						match: {
							recurringLabel: rentLike.label,
							merchantContains: rentLike.merchantName ?? undefined,
							categoryName: rentLike.categoryName ?? undefined,
						},
					},
				} as Prisma.InputJsonValue,
			});
		}
	}

	const checking = snapshot.accounts.find((account) =>
		/check|spend|everyday/i.test(account.name),
	);
	if (
		checking &&
		checking.currentBalance !== null &&
		checking.currentBalance < 3000
	) {
		const template = getNotificationTemplate("low_account_balance");
		if (template) {
			candidates.push({
				suggestionKey: `low_balance:${checking.id}`,
				title: "Your checking balance varies. Add a low-balance threshold?",
				description:
					"Get notified when checking drops below a level you choose.",
				templateId: template.id,
				prefill: {
					...template.defaultRule,
					trigger: {
						...template.defaultRule.trigger,
						accountIds: [checking.id],
						thresholdAmount: 1500,
					},
				} as Prisma.InputJsonValue,
			});
		}
	}

	const incomeLike = snapshot.recurring.find((item) =>
		/payroll|salary|paycheck|direct deposit/.test(item.label.toLowerCase()),
	);
	if (incomeLike) {
		candidates.push({
			suggestionKey: `late_paycheck:${incomeLike.label}`,
			title:
				"Your paycheck usually arrives on a schedule. Notify you if one is late?",
			description: "Watch for a missing expected income deposit.",
			templateId: "missing_expected_payment",
			prefill: {
				name: "Late paycheck",
				signalType: "expected_transaction_missing",
				trigger: {
					signalType: "expected_transaction_missing",
					match: { recurringLabel: incomeLike.label },
					expectedCadence: "biweekly",
					expectedWindowStartDay: 1,
					expectedWindowEndDay: 3,
					missingAfterDay: 5,
				},
				conditions: [{ kind: "does_not_appear_by_date", dayOfMonth: 5 }],
				schedule: { kind: "immediate" },
				channels: ["email", "push", "in_app"],
				urgency: "important",
				source: "suggestion",
				isActive: true,
			} as Prisma.InputJsonValue,
		});
	}

	const horizonMs = 14 * 24 * 60 * 60 * 1000;
	const upcoming = snapshot.recurring.find((item) => {
		if (!item.nextExpectedDateIso) return false;
		const next = new Date(item.nextExpectedDateIso);
		if (Number.isNaN(next.getTime())) return false;
		const delta = next.getTime() - now.getTime();
		return delta >= 0 && delta <= horizonMs;
	});
	if (upcoming) {
		const template = getNotificationTemplate("upcoming_bill");
		if (template) {
			candidates.push({
				suggestionKey: `upcoming_bill:${upcoming.label}`,
				title: `${upcoming.label} is coming up. Want a reminder beforehand?`,
				description: "Get notified before this recurring bill is due.",
				templateId: template.id,
				prefill: {
					...template.defaultRule,
					name: `Upcoming ${upcoming.label}`,
					trigger: {
						...template.defaultRule.trigger,
						daysAhead: 7,
						match: {
							recurringLabel: upcoming.label,
							merchantContains: upcoming.merchantName ?? undefined,
						},
					},
				} as Prisma.InputJsonValue,
			});
		}
	}

	const staleConnection = snapshot.connections.find(
		(connection) => !connection.lastSuccessfulSyncAtIso,
	);
	if (staleConnection) {
		const template = getNotificationTemplate("account_stopped_syncing");
		if (template) {
			candidates.push({
				suggestionKey: `stale_sync:${staleConnection.id}`,
				title: "A connected account may have stopped syncing. Watch for it?",
				description:
					"Get notified when a connection has not synced successfully.",
				templateId: template.id,
				prefill: {
					...template.defaultRule,
					trigger: {
						...template.defaultRule.trigger,
						connectionIds: [staleConnection.id],
					},
				} as Prisma.InputJsonValue,
			});
		}
	}

	const expenseAmounts = snapshot.transactions
		.filter((tx) => tx.amount < 0 || Math.abs(tx.amount) > 0)
		.map((tx) => Math.abs(tx.amount))
		.filter((amount) => amount > 0);
	if (expenseAmounts.length >= 8) {
		const mean =
			expenseAmounts.reduce((sum, value) => sum + value, 0) /
			expenseAmounts.length;
		const variance =
			expenseAmounts.reduce((sum, value) => sum + (value - mean) ** 2, 0) /
			expenseAmounts.length;
		const stdDev = Math.sqrt(variance);
		if (stdDev > mean * 0.75) {
			const template = getNotificationTemplate("large_or_unusual_purchase");
			if (template) {
				const threshold = Math.max(500, Math.round(mean + stdDev));
				candidates.push({
					suggestionKey: `large_tx_variance:${threshold}`,
					title: "Your spending swings a lot. Alert on large purchases?",
					description:
						"Get notified when a non-recurring purchase exceeds your threshold.",
					templateId: template.id,
					prefill: {
						...template.defaultRule,
						trigger: {
							...template.defaultRule.trigger,
							amountThreshold: threshold,
						},
					} as Prisma.InputJsonValue,
				});
			}
		}
	}

	const created = [];
	for (const candidate of candidates.slice(0, 5)) {
		const row = await db.notificationSuggestion.upsert({
			where: {
				userId_suggestionKey: {
					userId,
					suggestionKey: candidate.suggestionKey,
				},
			},
			create: {
				userId,
				suggestionKey: candidate.suggestionKey,
				title: candidate.title,
				description: candidate.description,
				templateId: candidate.templateId,
				prefill: candidate.prefill,
			},
			update: {},
		});
		if (!row.dismissedAt) {
			created.push({
				id: row.id,
				suggestionKey: row.suggestionKey,
				title: row.title,
				description: row.description,
				templateId: row.templateId,
				prefill: row.prefill,
				createdAt: row.createdAt.toISOString(),
			});
		}
	}

	return created;
}

export async function dismissNotificationSuggestion(
	db: PrismaClient,
	userId: string,
	id: string,
) {
	const existing = await db.notificationSuggestion.findFirst({
		where: { id, userId },
	});
	if (!existing) throw new Error("Suggestion not found");
	await db.notificationSuggestion.update({
		where: { id },
		data: { dismissedAt: new Date() },
	});
}
