import type { ActiveRule, DashboardTransaction } from "@moat/data-access";

export function localCoverage(accountCount: number) {
	return {
		asOf: new Date().toISOString(),
		accountCount,
		accountsRequiringReconnect: 0,
		staleAccountCount: 0,
		oldestSuccessfulSyncAt: null,
		newestSuccessfulSyncAt: null,
		limitations: [
			"Local desktop data; bank sync coverage metadata is unavailable.",
		],
		isComplete: accountCount > 0,
	};
}

export function formatLocalTransactionCard(transaction: DashboardTransaction) {
	return {
		id: transaction.id,
		date:
			transaction.date instanceof Date
				? transaction.date.toISOString().slice(0, 10)
				: String(transaction.date).slice(0, 10),
		postedDate: null,
		status: "posted" as const,
		amount: transaction.amount,
		type: transaction.type,
		category: transaction.category ?? null,
		merchantName: null,
		description: transaction.description,
		account: transaction.account ?? null,
		accountId: null,
		accountMask: null,
		hashtags: transaction.hashtags ?? [],
	};
}

export function summarizeLocalRule(rule: ActiveRule) {
	return {
		id: rule.id,
		name: rule.name,
		isActive: rule.isActive,
		priority: rule.priority,
		conditions: rule.conditions.map((condition) => ({
			field: condition.field,
			operator: condition.operator,
			value:
				condition.valueText ??
				condition.valueNumber ??
				condition.valueDate?.toISOString().slice(0, 10) ??
				null,
		})),
		actions: rule.actions.map((action) => ({
			type: action.type,
			value: action.hashtagName ?? action.valueText,
		})),
	};
}
